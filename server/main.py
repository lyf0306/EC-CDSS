"""FastAPI 入口 — 病例持久化 REST API (PG / MySQL 双兼容)

启动:  cd server && uvicorn main:app --port 8052
文档:  http://localhost:8052/docs
"""

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db, init_db, make_upsert_stmt
from models import AppState, Case
from schemas import (
    ActiveCaseRequest,
    ActiveCaseResponse,
    CaseFull,
    CaseIndexItem,
    CasePatchRequest,
    CaseRenameRequest,
    CaseSaveRequest,
    HealthResponse,
    MessageResponse,
    UserResponse,
)

# ── 日志 ────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("case-storage")

load_dotenv()


def _deep_merge(base: dict, override: dict) -> dict:
    """递归深度合并 override 到 base，跨方言替代 JSONB || 操作符。

    用法:  _deep_merge({"a": {"b": 1, "c": 2}}, {"a": {"b": 9}}) → {"a": {"b": 9, "c": 2}}
    """
    result = dict(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


# ── Lifespan ─────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Case Storage API 启动中...")
    await init_db()
    logger.info("数据库初始化完成，开始接收请求")
    yield
    # 优雅关闭
    logger.info("收到关闭信号，释放数据库连接...")
    from database import engine

    await engine.dispose()
    logger.info("数据库连接已释放，服务关闭")


# ── App ──────────────────────────────────────────────────

app = FastAPI(
    title="Oncology Aid — Case Storage API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — 生产部署时收紧 allow_origins 为前端域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 请求追踪中间件 ─────────────────────────────────────


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """每个请求注入 X-Request-ID + 记录耗时 + 异常捕获"""
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = rid
    start = time.monotonic()

    try:
        response = await call_next(request)
        elapsed = (time.monotonic() - start) * 1000
        logger.info(
            "%s %s → %s  %.0fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
        response.headers["X-Request-ID"] = rid
        return response
    except Exception:
        elapsed = (time.monotonic() - start) * 1000
        logger.exception(
            "%s %s → 500  %.0fms  [UNHANDLED]",
            request.method,
            request.url.path,
            elapsed,
        )
        raise


# ── 路由 ────────────────────────────────────────────────


@app.get("/api/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """健康检查 + 数据库连通性"""
    try:
        await db.execute(select(1))
        return HealthResponse(status="ok", database="connected")
    except Exception as exc:
        logger.warning("数据库健康检查失败: %s", exc)
        return HealthResponse(status="degraded", database="disconnected")


@app.get("/api/user/me", response_model=UserResponse)
async def get_current_user_info(
    user_id: str = Depends(get_current_user),
):
    """返回当前用户信息（展示于前端顶栏）"""
    return UserResponse(user_id=user_id, display_name="默认用户")


# ── 病例 CRUD ─────────────────────────────────────────


@app.get("/api/cases", response_model=list[CaseIndexItem])
async def list_cases(
    search: str | None = Query(None, description="搜索 label / figo_stage（跨全部记录）"),
    days: int | None = Query(None, description="仅返回最近 N 天的记录"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户的病例（仅索引元数据，不含 data JSON blob）

    - 不加参数：返回全部病例
    - ?days=7：仅返回最近 7 天
    - ?search=xxx：跨全部记录模糊搜索 label 和 figo_stage（忽略 days）
    """
    base = select(
        Case.id,
        Case.label,
        Case.saved_at,
        Case.step,
        Case.has_result,
        Case.figo_stage,
    ).where(Case.user_id == user_id)

    if search:
        like = f"%{search}%"
        base = base.where(
            Case.label.ilike(like) | Case.figo_stage.ilike(like)
        )
    elif days is not None:
        cutoff_ms = int((time.time() - days * 86400) * 1000)
        base = base.where(Case.saved_at >= cutoff_ms)

    base = base.order_by(Case.saved_at.desc())

    result = await db.execute(base)
    rows = result.all()
    return [
        CaseIndexItem(
            id=row[0],
            label=row[1],
            saved_at=row[2],
            step=row[3],
            has_result=row[4],
            figo_stage=row[5],
        )
        for row in rows
    ]


# ── Active Case 指针（必须在 /{case_id} 之前注册） ──


@app.get("/api/cases/active", response_model=ActiveCaseResponse)
async def get_active_case(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前活跃病例 ID"""
    result = await db.execute(
        select(AppState.value).where(AppState.key == "active_case_id")
    )
    row = result.fetchone()
    return ActiveCaseResponse(active_case_id=row[0] if row else None)


@app.put("/api/cases/active", response_model=MessageResponse)
async def set_active_case(
    body: ActiveCaseRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """设置当前活跃病例 ID（原子 upsert，dialect 自适应）"""
    stmt = make_upsert_stmt(
        AppState,
        values=dict(key="active_case_id", value=body.active_case_id),
        constraint_cols=["key"],
    )
    await db.execute(stmt)
    await db.commit()
    return MessageResponse(ok=True)


# ── /{case_id} 参数化路由 ──────────────────────────────


@app.get("/api/cases/{case_id}", response_model=CaseFull)
async def get_case(
    case_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取病例完整数据（含 data JSON blob）"""
    result = await db.execute(
        select(Case).where(Case.id == case_id, Case.user_id == user_id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"病例 {case_id} 不存在")
    return CaseFull(
        id=case.id,
        label=case.label,
        saved_at=case.saved_at,
        step=case.step,
        has_result=case.has_result,
        figo_stage=case.figo_stage,
        data=case.data,
        created_at=case.created_at,
        updated_at=case.updated_at,
    )


@app.post("/api/cases", response_model=MessageResponse)
async def save_case(
    body: CaseSaveRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建或 upsert 病例（原子操作，dialect 自适应，无竞态）。"""
    data = body.data or {}
    now = int(os.environ.get("MOCK_TS", "0")) or int(__import__("time").time() * 1000)

    label = body.label or data.get("label", "未命名")
    step = data.get("currentStep", 1)
    has_result = bool(
        data.get("analysisResult")
        or data.get("ebmReport")
        or data.get("profileResult")
    )
    figo_stage = data.get("clinicalInfo", {}).get("figo_stage", "")

    stmt = make_upsert_stmt(
        Case,
        values=dict(
            id=body.id,
            user_id=user_id,
            label=label,
            saved_at=now,
            step=step,
            has_result=has_result,
            figo_stage=figo_stage,
            data=data,
        ),
        constraint_cols=["id"],
    )
    await db.execute(stmt)
    await db.commit()
    return MessageResponse(ok=True, id=body.id)


@app.put("/api/cases/{case_id}", response_model=MessageResponse)
async def rename_case(
    case_id: str,
    body: CaseRenameRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新病例 label"""
    stmt = (
        update(Case)
        .where(Case.id == case_id, Case.user_id == user_id)
        .values(label=body.label)
        .returning(Case.id)
    )
    result = await db.execute(stmt)
    if not result.fetchone():
        raise HTTPException(status_code=404, detail=f"病例 {case_id} 不存在")
    await db.commit()
    return MessageResponse(ok=True, id=case_id)


@app.patch("/api/cases/{case_id}", response_model=MessageResponse)
async def patch_case(
    case_id: str,
    body: CasePatchRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """局部合并 data JSON —— 后台写入的核心端点。

    Python 层 deep merge（非数据库方言操作符），
    保证 PostgreSQL / MySQL 双兼容。
    """
    now = int(time.time() * 1000)

    # SELECT ... FOR UPDATE — 锁住该行直至事务提交，并发写串行化，防止丢更新
    result = await db.execute(
        select(Case.data).where(Case.id == case_id, Case.user_id == user_id).with_for_update()
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"病例 {case_id} 不存在")

    existing = row[0] or {}
    merged = _deep_merge(existing, body.data)

    stmt = (
        update(Case)
        .where(Case.id == case_id, Case.user_id == user_id)
        .values(data=merged, saved_at=now)
        .returning(Case.id)
    )
    await db.execute(stmt)
    await db.commit()
    return MessageResponse(ok=True, id=case_id)


@app.delete("/api/cases/{case_id}", response_model=MessageResponse)
async def delete_case(
    case_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除病例"""
    stmt = delete(Case).where(Case.id == case_id, Case.user_id == user_id).returning(Case.id)
    result = await db.execute(stmt)
    if not result.fetchone():
        raise HTTPException(status_code=404, detail=f"病例 {case_id} 不存在")
    await db.commit()
    return MessageResponse(ok=True, id=case_id)
