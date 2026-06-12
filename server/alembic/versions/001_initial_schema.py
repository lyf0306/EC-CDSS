"""初始 schema — cases + app_state

Revision ID: 001
Revises: None
Create Date: 2026-06-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cases",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False, server_default="default-user-001"),
        sa.Column("label", sa.Text(), nullable=False, server_default="未命名"),
        sa.Column("saved_at", sa.BigInteger(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("has_result", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("figo_stage", sa.Text(), nullable=False, server_default=""),
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cases_saved_at", "cases", ["saved_at"])
    op.create_index("ix_cases_user_id", "cases", ["user_id"])

    op.create_table(
        "app_state",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("app_state")
    op.drop_index("ix_cases_user_id", table_name="cases")
    op.drop_index("ix_cases_saved_at", table_name="cases")
    op.drop_table("cases")
