"""集中配置 — 部署时只需改两处：.env 文件 + 本文件末尾的 Alembic 连接串。

=== 部署清单（按顺序）===
1. cp server/.env.example server/.env
2. 编辑 server/.env，替换 DATABASE_URL / CORS_ORIGINS 等
3. 检查 config.py 末尾的 Alembic DATABASE_URL（用于迁移脚本连接）
4. uvicorn main:app --host 0.0.0.0 --port 8052
"""

import os

from dotenv import load_dotenv

# 优先加载 server/ 目录下的 .env，回退到当前工作目录
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path, override=False)
# 也尝试加载工作目录的 .env（兼容从项目根目录启动）
load_dotenv(override=False)


def _require(key: str) -> str:
    """必须配置的变量，缺失时抛出明确错误（而非静默回退到硬编码默认值）。"""
    val = os.getenv(key)
    if not val:
        raise RuntimeError(
            f"缺少必需的环境变量 {key}，请检查 .env 文件。\n"
            f"  若 .env 不存在，请先执行: cp server/.env.example server/.env"
        )
    return val


# ═══════════════════════════════════════════════════════════════
# 数据库
# ═══════════════════════════════════════════════════════════════

DATABASE_URL = _require("DATABASE_URL")

DB_POOL_SIZE       = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW    = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_RECYCLE    = int(os.getenv("DB_POOL_RECYCLE", "3600"))
DB_POOL_TIMEOUT    = int(os.getenv("DB_POOL_TIMEOUT", "10"))
DB_COMMAND_TIMEOUT = int(os.getenv("DB_COMMAND_TIMEOUT", "30"))

# ═══════════════════════════════════════════════════════════════
# CORS
# ═══════════════════════════════════════════════════════════════

# 逗号分隔的前端域名列表（allow_credentials=True 时不能用 "*"）
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

# ═══════════════════════════════════════════════════════════════
# 鉴权
# ═══════════════════════════════════════════════════════════════

AUTH_MODE = os.getenv("AUTH_MODE", "mock")  # mock | header | jwt

MOCK_USER_ID    = os.getenv("MOCK_USER_ID", "default-user-001")
JWT_SECRET_KEY  = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM   = os.getenv("JWT_ALGORITHM", "HS256")

# ═══════════════════════════════════════════════════════════════
# 速率限制（内存实现，重启后计数清零）
# ═══════════════════════════════════════════════════════════════

RATE_LIMIT_ENABLED  = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))   # 窗口内最大请求数
RATE_LIMIT_WINDOW   = int(os.getenv("RATE_LIMIT_WINDOW", "60"))      # 窗口秒数

# ═══════════════════════════════════════════════════════════════
# 服务
# ═══════════════════════════════════════════════════════════════

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8052"))


# ═══════════════════════════════════════════════════════════════
# Alembic 连接串（同步驱动，用于 offline 迁移脚本）
# ═══════════════════════════════════════════════════════════════

def _async_to_sync_url(async_url: str) -> str:
    """postgresql+asyncpg://... → postgresql://..."""
    return async_url.replace("+asyncpg", "")

ALEMBIC_DATABASE_URL = _async_to_sync_url(DATABASE_URL)
