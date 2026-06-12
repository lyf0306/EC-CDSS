"""SQLAlchemy ORM 模型 — 跨数据库兼容（PostgreSQL / MySQL）

JSON 列使用 SQLAlchemy 泛型 JSON 类型，自动适配：
  - PostgreSQL → JSONB
  - MySQL 8.0+ → JSON
"""

from sqlalchemy import Boolean, Integer, BigInteger, Text, Column, DateTime, func, JSON
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Case(Base):
    """病例主表 — id + 索引元数据 + data JSON 完整快照"""

    __tablename__ = "cases"

    id = Column(Text, primary_key=True)
    user_id = Column(Text, nullable=False, default="default-user-001", index=True)
    label = Column(Text, nullable=False, default="未命名")
    saved_at = Column(BigInteger, nullable=False, index=True)  # Unix epoch ms，列表排序键
    step = Column(Integer, nullable=False, default=1)
    has_result = Column(Boolean, nullable=False, default=False)
    figo_stage = Column(Text, nullable=False, default="")
    data = Column(JSON, nullable=False, default={})  # collectState() 完整输出
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class AppState(Base):
    """键值对表 — 存 active_case_id 等全局状态"""

    __tablename__ = "app_state"

    key = Column(Text, primary_key=True)
    value = Column(Text, nullable=False)
