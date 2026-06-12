"""Pydantic 请求/响应 schema"""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


# ── 请求 ──────────────────────────────────────────────────


class CaseSaveRequest(BaseModel):
    """POST /api/cases — 创建或 upsert 病例"""
    id: str
    label: str = "未命名"
    data: Optional[Dict[str, Any]] = None


class CaseRenameRequest(BaseModel):
    """PUT /api/cases/{id} — 更新 label"""
    label: str


class CasePatchRequest(BaseModel):
    """PATCH /api/cases/{id} — 局部合并 data"""
    data: Dict[str, Any]


class ActiveCaseRequest(BaseModel):
    """PUT /api/cases/active — 设置当前活跃病例"""
    active_case_id: str


# ── 响应 ──────────────────────────────────────────────────


class CaseIndexItem(BaseModel):
    """GET /api/cases 列表项 — 仅轻量索引字段，不含 data"""
    id: str
    label: str
    saved_at: int
    step: int
    has_result: bool
    figo_stage: str


class CaseFull(BaseModel):
    """GET /api/cases/{id} — 完整病例数据（含 data JSON blob）"""
    id: str
    label: str
    saved_at: int
    step: int
    has_result: bool
    figo_stage: str
    data: Dict[str, Any]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ActiveCaseResponse(BaseModel):
    """GET /api/cases/active"""
    active_case_id: Optional[str] = None


class HealthResponse(BaseModel):
    """GET /api/health"""
    status: str
    database: str = "unknown"


class UserResponse(BaseModel):
    """GET /api/user/me"""
    user_id: str
    display_name: str = ""


class MessageResponse(BaseModel):
    """通用消息"""
    ok: bool = True
    id: Optional[str] = None
