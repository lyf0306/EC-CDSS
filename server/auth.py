"""Mock 单用户鉴权 — 单文件替换即可接入真实鉴权

医院 IT 接入步骤：
1. 替换 get_current_user() 函数，验证 JWT / Session / Token
2. 返回值为唯一用户标识字符串
3. Case 表已含 user_id 列，查询自动按 user_id 隔离

当前 Mock 实现：
- 前端每个浏览器生成唯一 workstation_id，通过 X-User-Id 请求头传递
- 后端读取 X-User-Id 作为用户标识
- 病例数据按 user_id 隔离，不同用户互不可见
- 无 X-User-Id 时回退到 MOCK_USER_ID（向后兼容）
"""

from fastapi import Header

# ── Mock 实现（部署时替换此函数即可） ──────────────────────

MOCK_USER_ID = "default-user-001"


async def get_current_user(
    authorization: str = Header(None),
    x_user_id: str = Header(None, alias="X-User-Id"),
) -> str:
    """从请求头提取用户标识。

    当前 Mock 实现：
    1. 优先读取 X-User-Id 请求头（前端每个浏览器生成唯一 ID）
    2. 其次读取 Authorization Bearer token
    3. 回退到固定 MOCK_USER_ID

    替换时保持函数签名和返回值类型不变即可——路由层零改动。
    """
    # ── Mock: X-User-Id 客户端标识 ─────────────────
    if x_user_id:
        return x_user_id

    # ── 示例：接入真实 JWT 鉴权 ────────────────────
    # if not authorization:
    #     raise HTTPException(status_code=401, detail="未提供认证令牌")
    # token = authorization.removeprefix("Bearer ")
    # payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    # return payload["sub"]

    return MOCK_USER_ID
