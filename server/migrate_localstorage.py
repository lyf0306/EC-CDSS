"""
一次性迁移脚本：将浏览器 localStorage 导出的病例数据迁移到 PostgreSQL。

用法：
  1. 在浏览器 console 执行：
     copy(JSON.stringify({
       index: localStorage.getItem('oncology_case_index'),
       active: localStorage.getItem('oncology_aid_active'),
       cases: Object.keys(localStorage)
         .filter(k => k.startsWith('oncology_case_'))
         .map(k => localStorage.getItem(k))
     }))

  2. 将剪贴板内容保存为 migration_input.json

  3. 确保 server/.env 中的 DATABASE_URL 正确

  4. 运行：python server/migrate_localstorage.py migration_input.json

  5. 确认输出 "迁移完成: N 个病例已导入"
"""

import json
import os
import sys
from datetime import datetime, timezone

import psycopg2

from config import ALEMBIC_DATABASE_URL


# ── 解析 DATABASE_URL ──────────────────────────────────────


def _parse_db_url(url: str) -> dict:
    """将 postgresql://user:pass@host:port/db 拆分为 psycopg2 连接参数"""
    url = url.replace("postgresql://", "").replace("postgresql+asyncpg://", "")
    auth_host, _, dbname = url.partition("/")
    user_pass, _, host_port = auth_host.partition("@")
    user, _, password = user_pass.partition(":")
    host, _, port_str = host_port.partition(":")
    return {
        "host": host,
        "port": int(port_str) if port_str else 5432,
        "user": user,
        "password": password,
        "dbname": dbname,
    }


# ── 主逻辑 ─────────────────────────────────────────────────


def migrate(input_path: str) -> None:
    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    index_str = raw.get("index", "[]")
    index = json.loads(index_str) if isinstance(index_str, str) else index_str

    active_id = raw.get("active", "")

    case_blobs = []
    for item in raw.get("cases", []):
        if isinstance(item, str):
            case_blobs.append(json.loads(item))
        else:
            case_blobs.append(item)

    print(f"索引中有 {len(index)} 条记录，{len(case_blobs)} 个完整槽位")

    conn_params = _parse_db_url(ALEMBIC_DATABASE_URL)
    print(f"连接 PostgreSQL: {conn_params['host']}:{conn_params['port']}/{conn_params['dbname']}")

    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                id          TEXT PRIMARY KEY,
                label       TEXT NOT NULL DEFAULT '未命名',
                saved_at    BIGINT NOT NULL,
                step        INTEGER NOT NULL DEFAULT 1,
                has_result  BOOLEAN NOT NULL DEFAULT FALSE,
                figo_stage  TEXT NOT NULL DEFAULT '',
                data        JSONB NOT NULL DEFAULT '{}',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS app_state (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        conn.commit()

        imported = 0
        for blob in case_blobs:
            if not blob or "data" not in blob:
                continue

            data = blob["data"]
            case_id = data.get("_caseId") or blob.get("id") or ""
            if not case_id:
                label = blob.get("label", "")
                for meta in index:
                    if isinstance(meta, dict) and meta.get("label") == label:
                        case_id = meta["id"]
                        break

            if not case_id:
                import hashlib
                case_id = "c" + hashlib.md5(
                    json.dumps(data, sort_keys=True).encode()
                ).hexdigest()[:12]
                print(f"⚠ 无法确定病例 ID，自动生成: {case_id}")

            label = blob.get("label", data.get("label", "未命名"))
            saved_at = blob.get("savedAt", 0)
            step = data.get("currentStep", 1)
            has_result = bool(
                data.get("analysisResult")
                or data.get("ebmReport")
                or data.get("profileResult")
            )
            figo_stage = (
                data.get("profileResult", {}).get("figo_stage", "")
                or data.get("clinicalInfo", {}).get("figo_stage", "")
                or ""
            )

            cur.execute(
                """
                INSERT INTO cases (id, label, saved_at, step, has_result, figo_stage, data)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    label = EXCLUDED.label,
                    saved_at = EXCLUDED.saved_at,
                    step = EXCLUDED.step,
                    has_result = EXCLUDED.has_result,
                    figo_stage = EXCLUDED.figo_stage,
                    data = EXCLUDED.data,
                    updated_at = NOW()
                """,
                (case_id, label, saved_at, step, has_result, figo_stage, json.dumps(data)),
            )
            imported += 1
            print(f"  ✓ {case_id} — {label}")

        if active_id:
            cur.execute(
                """
                INSERT INTO app_state (key, value)
                VALUES ('active_case_id', %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                (active_id,),
            )
            print(f"  ✓ active_case_id = {active_id}")

        conn.commit()
        print(f"\n迁移完成: {imported} 个病例已导入")

    except Exception as e:
        conn.rollback()
        print(f"❌ 迁移失败: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python migrate_localstorage.py <migration_input.json>")
        sys.exit(1)
    migrate(sys.argv[1])
