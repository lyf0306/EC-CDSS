"""用户鉴权依赖 — 医院 IT 只需在本文件替换 get_current_user() 实现。

三种模式（通过 AUTH_MODE 环境变量切换）：
  mock   — 所有请求视为同一用户（单机演示，默认）
  header — 读取 X-User-Id 请求头作为用户标识
  jwt    — 验证 Authorization: Bearer <token>（需配置 JWT_SECRET_KEY）

部署切换时保持 get_current_user() 签名不变，路由层零改动。
"""

from fastapi import Header, HTTPException

from config import AUTH_MODE, JWT_ALGORITHM, JWT_SECRET_KEY, MOCK_USER_ID


async def get_current_user(
    authorization: str | None = Header(None),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> str:
    """从请求头提取用户标识，返回唯一用户 ID 字符串。

    FastAPI 依赖注入用法:
        @app.get("/api/xxx")
        async def handler(user_id: str = Depends(get_current_user)):
            ...
    """
    if AUTH_MODE == "mock":
        # 单用户模式：恒返回固定 ID
        return MOCK_USER_ID

    if AUTH_MODE == "header":
        # 信任 X-User-Id 请求头（内网隔离 + 反向代理注入场景）
        if x_user_id:
            return x_user_id
        raise HTTPException(status_code=401, detail="缺少 X-User-Id 请求头")

    if AUTH_MODE == "jwt":
        # JWT Bearer Token 验证
        if not JWT_SECRET_KEY:
            raise HTTPException(status_code=500, detail="JWT_SECRET_KEY 未配置")

        if not authorization:
            raise HTTPException(status_code=401, detail="未提供认证令牌")

        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=401, detail="令牌格式无效")

        try:
            import jwt
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload.get("sub") or payload.get("user_id") or "unknown"
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="令牌已过期")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="令牌无效")

    raise HTTPException(status_code=500, detail=f"未知鉴权模式: {AUTH_MODE}")
