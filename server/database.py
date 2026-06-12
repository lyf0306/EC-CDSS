"""数据库连接 — SQLAlchemy 2.0 async engine + session factory"""

import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from sqlalchemy import Table
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://admin:123456@10.60.146.99:5432/oncology_aid",
)

engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,            # 常规并发连接数
    max_overflow=20,         # 突发峰值可额外借出 20 个（合计 ≤30）
    pool_recycle=3600,       # 1h 后回收连接，防数据库端主动断开
    pool_pre_ping=True,      # 取出连接前先 SELECT 1 探活
    pool_timeout=10,         # 等待可用连接的超时秒数（超时抛错，不无限挂起）
    connect_args={
        "timeout": 10,       # asyncpg: 建立 TCP 连接超时
        "command_timeout": 30,  # asyncpg: 单条 SQL 执行上限
    },
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def make_upsert_stmt(
    model: type,
    values: Dict[str, Any],
    constraint_cols: List[str],
):
    """生成原子 upsert 语句，自动适配 PostgreSQL / MySQL。

    参数:
        model:     SQLAlchemy ORM 模型类
        values:    要 INSERT 的完整列值 dict
        constraint_cols: 唯一约束列名列表（如 ["id"] 或 ["key"]）

    PostgreSQL → INSERT ... ON CONFLICT ... DO UPDATE
    MySQL      → INSERT ... ON DUPLICATE KEY UPDATE
    """
    dialect_name = engine.dialect.name
    update_cols = {k: v for k, v in values.items() if k not in constraint_cols}

    if dialect_name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        return (
            pg_insert(model)
            .values(**values)
            .on_conflict_do_update(
                index_elements=constraint_cols,
                set_=update_cols,
            )
        )
    elif dialect_name == "mysql":
        from sqlalchemy.dialects.mysql import insert as my_insert

        return (
            my_insert(model)
            .values(**values)
            .on_duplicate_key_update(**update_cols)
        )
    else:
        raise RuntimeError(f"Unsupported database dialect: {dialect_name}")


async def init_db() -> None:
    """启动时建表/迁移（不删数据，仅创建不存在的表/列）"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 为已有表添加 user_id 列（迁移：旧表无此列）
        await conn.execute(
            __import__("sqlalchemy").text(
                "ALTER TABLE cases ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default-user-001'"
            )
        )
        # 为新加的 user_id 列创建索引（如果不存在）
        await conn.execute(
            __import__("sqlalchemy").text(
                "CREATE INDEX IF NOT EXISTS ix_cases_user_id ON cases (user_id)"
            )
        )


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入 — 每个请求获取独立 session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
