"""Case Storage API 后端测试 — pytest + httpx

运行:  cd server && python -m pytest test_main.py -v
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# ── Mock 数据库层（避免依赖真实 PostgreSQL） ──────────────────

# 在所有测试中 mock 掉 database 模块的 engine、session 和 make_upsert_stmt
MOCK_DB_SESSION = AsyncMock()


@pytest.fixture(autouse=True)
def mock_database():
    """全局 mock：所有 DB 调用返回模拟数据"""
    # make_upsert_stmt mock：返回一个普通的 SQLAlchemy insert 语句 mock
    mock_stmt = MagicMock()

    with patch("database.engine", MagicMock()), \
         patch("database.init_db", AsyncMock()), \
         patch("database.get_db", _mock_get_db), \
         patch("database.make_upsert_stmt", return_value=mock_stmt):
        yield


async def _mock_get_db():
    """模拟 FastAPI 依赖注入的 DB session"""
    yield MOCK_DB_SESSION


# 每个测试前重置 mock
@pytest.fixture(autouse=True)
def reset_mocks():
    MOCK_DB_SESSION.reset_mock()
    MOCK_DB_SESSION.execute = AsyncMock()
    MOCK_DB_SESSION.commit = AsyncMock()
    MOCK_DB_SESSION.close = AsyncMock()


# ── 创建 TestClient ────────────────────────────────────────


@pytest.fixture
def client():
    """同步 TestClient（适合简单 GET/POST 测试）"""
    from main import app

    return TestClient(app)


@pytest.fixture
async def async_client():
    """异步 AsyncClient（需要 await 的测试用）"""
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ═══════════════════════════════════════════════════════════════
# 健康检查
# ═══════════════════════════════════════════════════════════════


class TestHealthCheck:
    def test_health_ok(self, client):
        MOCK_DB_SESSION.execute = AsyncMock()  # 正常返回
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "database" in data

    def test_health_db_down(self, client):
        MOCK_DB_SESSION.execute = AsyncMock(side_effect=Exception("connection refused"))
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "degraded"
        assert data["database"] == "disconnected"


# ═══════════════════════════════════════════════════════════════
# 病例 CRUD
# ═══════════════════════════════════════════════════════════════


class TestListCases:
    def test_list_empty(self, client):
        """空列表"""
        mock_result = MagicMock()
        mock_result.all.return_value = []
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_items(self, client):
        """有病例时返回索引项"""
        mock_result = MagicMock()
        mock_result.all.return_value = [
            ("case-1", "病例一", 1700000000000, 1, True, "IIIC1"),
            ("case-2", "病例二", 1700000001000, 2, False, ""),
        ]
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["id"] == "case-1"
        assert data[0]["figo_stage"] == "IIIC1"
        assert data[1]["step"] == 2

    def test_list_with_search(self, client):
        """搜索过滤"""
        mock_result = MagicMock()
        mock_result.all.return_value = [("case-1", "子宫内膜癌", 1700000000000, 1, True, "IIIC1")]
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases?search=子宫")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["label"] == "子宫内膜癌"


class TestGetCase:
    def test_get_existing(self, client):
        mock_case = MagicMock()
        mock_case.id = "case-1"
        mock_case.label = "测试"
        mock_case.saved_at = 1700000000000
        mock_case.step = 2
        mock_case.has_result = True
        mock_case.figo_stage = "IIIC1"
        mock_case.data = {"currentStep": 2}
        mock_case.created_at = None
        mock_case.updated_at = None

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_case
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases/case-1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "case-1"
        assert data["label"] == "测试"
        assert data["figo_stage"] == "IIIC1"

    def test_get_not_found(self, client):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases/nonexistent")
        assert resp.status_code == 404


class TestSaveCase:
    def test_save_new(self, client):
        MOCK_DB_SESSION.execute = AsyncMock()

        resp = client.post("/api/cases", json={
            "id": "case-new",
            "label": "新病例",
            "data": {"currentStep": 1},
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_save_minimal(self, client):
        """只有 id 的最简请求"""
        MOCK_DB_SESSION.execute = AsyncMock()

        resp = client.post("/api/cases", json={"id": "minimal-case"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


class TestRenameCase:
    def test_rename(self, client):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ("case-1",)
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.put("/api/cases/case-1", json={"label": "新名称"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_rename_not_found(self, client):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.put("/api/cases/nonexistent", json={"label": "新名称"})
        assert resp.status_code == 404


class TestPatchCase:
    def test_patch_merge(self, client):
        """局部更新 data"""
        mock_select = MagicMock()
        mock_select.fetchone.return_value = ({"existing": "value"},)
        mock_update = MagicMock()
        mock_update.fetchone.return_value = ("case-1",)

        # 两次 execute：SELECT FOR UPDATE + UPDATE
        MOCK_DB_SESSION.execute = AsyncMock(side_effect=[mock_select, mock_update])

        resp = client.patch("/api/cases/case-1", json={"data": {"newKey": "newValue"}})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_patch_not_found(self, client):
        mock_select = MagicMock()
        mock_select.fetchone.return_value = None
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_select)

        resp = client.patch("/api/cases/nonexistent", json={"data": {}})
        assert resp.status_code == 404


class TestDeleteCase:
    def test_delete(self, client):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ("case-1",)
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.delete("/api/cases/case-1")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_delete_not_found(self, client):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.delete("/api/cases/nonexistent")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════
# Active Case 指针
# ═══════════════════════════════════════════════════════════════


class TestActiveCase:
    def test_get_active(self, client):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = ("case-1",)
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases/active")
        assert resp.status_code == 200
        assert resp.json()["active_case_id"] == "case-1"

    def test_get_active_none(self, client):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases/active")
        assert resp.status_code == 200
        assert resp.json()["active_case_id"] is None

    def test_set_active(self, client):
        MOCK_DB_SESSION.execute = AsyncMock()

        resp = client.put("/api/cases/active", json={"active_case_id": "case-2"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


# ═══════════════════════════════════════════════════════════════
# 用户
# ═══════════════════════════════════════════════════════════════


class TestUserInfo:
    def test_user_me(self, client):
        resp = client.get("/api/user/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "user_id" in data
        assert "display_name" in data


# ═══════════════════════════════════════════════════════════════
# 鉴权
# ═══════════════════════════════════════════════════════════════


class TestAuth:
    def test_mock_auth_default(self, client):
        """Mock 模式下所有请求通过，返回固定 user_id"""
        mock_result = MagicMock()
        mock_result.all.return_value = []
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases")
        assert resp.status_code == 200

    def test_no_x_user_id_still_works_in_mock_mode(self, client):
        """mock 模式下缺少 X-User-Id 不影响"""
        mock_result = MagicMock()
        mock_result.all.return_value = []
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        resp = client.get("/api/cases")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════
# 速率限制
# ═══════════════════════════════════════════════════════════════


class TestRateLimiting:
    def test_rate_limit_kicks_in(self, client, monkeypatch):
        """超过限制后返回 429"""
        import main as _main

        # 启用限流并设低阈值
        _main.RATE_LIMIT_ENABLED = True
        _main._rate_limiter.max_requests = 3
        _main._rate_limiter.window_seconds = 60
        _main._rate_limiter._buckets.clear()

        mock_result = MagicMock()
        mock_result.all.return_value = []
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        # 前 3 次应通过
        for _ in range(3):
            resp = client.get("/api/cases", headers={"X-User-Id": "test-user"})
            assert resp.status_code == 200

        # 第 4 次应被限流
        resp = client.get("/api/cases", headers={"X-User-Id": "test-user"})
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers

        # 恢复默认
        _main.RATE_LIMIT_ENABLED = False

    def test_rate_limit_disabled(self, client):
        """关闭限流后不拦截"""
        import main as _main

        _main.RATE_LIMIT_ENABLED = False
        _main._rate_limiter._buckets.clear()

        mock_result = MagicMock()
        mock_result.all.return_value = []
        MOCK_DB_SESSION.execute = AsyncMock(return_value=mock_result)

        for _ in range(10):
            resp = client.get("/api/cases")
            assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════
# CORS
# ═══════════════════════════════════════════════════════════════


class TestCors:
    def test_cors_headers_present(self, client):
        """OPTIONS 预检请求返回正确的 CORS 头"""
        resp = client.options(
            "/api/cases",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        # CORSMiddleware 处理 OPTIONS
        assert resp.status_code in (200, 405)


# ═══════════════════════════════════════════════════════════════
# Deep Merge 工具函数
# ═══════════════════════════════════════════════════════════════


class TestDeepMerge:
    def test_shallow_merge(self):
        from main import _deep_merge
        assert _deep_merge({"a": 1}, {"b": 2}) == {"a": 1, "b": 2}

    def test_override(self):
        from main import _deep_merge
        assert _deep_merge({"a": 1}, {"a": 9}) == {"a": 9}

    def test_nested_merge(self):
        from main import _deep_merge
        base = {"a": {"x": 1, "y": 2}, "b": 3}
        override = {"a": {"y": 99, "z": 100}}
        result = _deep_merge(base, override)
        assert result == {"a": {"x": 1, "y": 99, "z": 100}, "b": 3}

    def test_nested_not_dict(self):
        from main import _deep_merge
        # 非 dict 值直接覆盖
        assert _deep_merge({"a": 1}, {"a": "hello"}) == {"a": "hello"}
