#!/bin/bash
# ── Case Storage API 启动脚本 ───────────────────────────────────
# 用法:  ./start_service.sh [workers]
#        workers 默认 4；单核机器用 1
#
# 日志:  同时输出到终端 + logs/case-storage.log
# 优雅关闭: kill -TERM <pid> → 等待请求完成 → 释放连接池

set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8052}"
HOST="${HOST:-0.0.0.0}"
WORKERS="${1:-4}"
LOG_DIR="logs"
PID_FILE="$LOG_DIR/case-storage.pid"

mkdir -p "$LOG_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Case Storage API"
echo "  Host:    $HOST"
echo "  Port:    $PORT"
echo "  Workers: $WORKERS"
echo "  Log:     $LOG_DIR/case-storage.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 激活虚拟环境（复用 PathoEBM 的 .venv，或使用当前 Python）
if [ -f "../.venv/bin/activate" ]; then
    source ../.venv/bin/activate
elif [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# 确保关键依赖已安装
pip install -q sqlalchemy[asyncio] asyncpg python-dotenv 2>/dev/null || true

# 启动
uvicorn main:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS" \
    --log-level info \
    2>&1 | tee -a "$LOG_DIR/case-storage.log" &

echo $! > "$PID_FILE"
echo "PID: $(cat $PID_FILE)  →  已启动"
echo "文档: http://$HOST:$PORT/docs"
echo ""
echo "停止服务:  kill -TERM $(cat $PID_FILE)"
