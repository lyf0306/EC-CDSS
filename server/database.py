"""数据库连接 — SQLAlchemy 2.0 async engine + session factory"""

from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import (
    DATABASE_URL,
    DB_COMMAND_TIMEOUT,
    DB_MAX_OVERFLOW,
    DB_POOL_RECYCLE,
    DB_POOL_SIZE,
    DB_POOL_TIMEOUT,
)
from models import Base

engine = create_async_engine(
    DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,
    pool_timeout=DB_POOL_TIMEOUT,
    connect_args={
        "timeout": 10,
        "command_timeout": DB_COMMAND_TIMEOUT,
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
        model:           SQLAlchemy ORM 模型类
        values:          INSERT 的完整列值 dict
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
    """启动时建表（幂等：仅创建不存在的表，不修改已有表结构）。

    Schema 变更请通过 Alembic 管理：
      cd server && alembic upgrade head
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入 — 每个请求获取独立 session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
