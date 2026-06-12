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

  3. 运行：python server/migrate_localstorage.py migration_input.json

  4. 确认输出 "迁移完成: N 个病例已导入"
"""

import json
import sys
import os
from datetime import datetime, timezone

# 尝试导入 psycopg2（同步驱动，适合一次性脚本）
try:
    import psycopg2
except ImportError:
    print("请先安装 psycopg2: pip install psycopg2-binary")
    sys.exit(1)

# 如果安装了 dotenv，加载 .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://admin:123456@10.60.146.99:5432/oncology_aid",
)

# ── 解析 DATABASE_URL ──────────────────────────────────────


def parse_db_url(url: str) -> dict:
    """将 postgresql://user:pass@host:port/db 拆分为 psycopg2 连接参数"""
    # 移除协议前缀
    url = url.replace("postgresql://", "").replace("postgresql+asyncpg://", "")
    # 分离认证和主机
    auth_host, _, dbname = url.partition("/")
    user_pass, _, host_port = auth_host.partition("@")
    user, _, password = user_pass.partition(":")
    host, _, port = host_port.partition(":")
    return {
        "host": host,
        "port": int(port) if port else 5432,
        "user": user,
        "password": password,
        "dbname": dbname,
    }


# ── 主逻辑 ─────────────────────────────────────────────────


def migrate(input_path: str) -> None:
    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # 解析 index（localStorage 存的是 JSON 字符串）
    index_str = raw.get("index", "[]")
    index = json.loads(index_str) if isinstance(index_str, str) else index_str

    active_id = raw.get("active", "")

    # 解析 case blobs
    case_blobs = []
    for item in raw.get("cases", []):
        if isinstance(item, str):
            case_blobs.append(json.loads(item))
        else:
            case_blobs.append(item)

    print(f"索引中有 {len(index)} 条记录，{len(case_blobs)} 个完整槽位")

    # 连接数据库
    conn_params = parse_db_url(DATABASE_URL)
    print(f"连接 PostgreSQL: {conn_params['host']}:{conn_params['port']}/{conn_params['dbname']}")

    conn = psycopg2.connect(**conn_params)
    cur = conn.cursor()

    try:
        # 建表（幂等）
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
            # 如果 data 里没有 id，尝试从 index 中匹配
            if not case_id:
                label = blob.get("label", "")
                for meta in index:
                    if isinstance(meta, dict) and meta.get("label") == label:
                        case_id = meta["id"]
                        break

            if not case_id:
                # 最后手段：从 blob 内容生成
                import hashlib
                case_id = "c" + hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()[:12]
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

            # Upsert
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

        # 设置 active case
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
