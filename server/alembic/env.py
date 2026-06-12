"""Alembic 迁移环境 — 从 config.py 注入数据库连接，自动发现 ORM 模型"""

import sys
from pathlib import Path

# 将 server/ 目录加入 sys.path，使 config / models 可导入
_server_dir = str(Path(__file__).resolve().parent.parent)
if _server_dir not in sys.path:
    sys.path.insert(0, _server_dir)

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from config import ALEMBIC_DATABASE_URL
from models import Base

# Alembic Config 对象（读取 alembic.ini）
config = context.config

# 从 config.py 动态注入数据库 URL（覆盖 alembic.ini 中的空值）
config.set_main_option("sqlalchemy.url", ALEMBIC_DATABASE_URL)

# 日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 迁移目标：ORM 模型的全部表
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：生成 SQL 脚本而非直接执行（适合审查后手动执行）。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：直接连接数据库执行迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
