# Oncology Aid — 部署指南

## 架构

```
浏览器 (HTTPS)
  └─ nginx (:443)
      ├─ /                  → Vue SPA 静态文件 (dist/)
      ├─ /api/health        → Case Storage (127.0.0.1:8052)
      ├─ /api/user/*        → Case Storage (127.0.0.1:8052)
      ├─ /api/cases/*       → Case Storage (127.0.0.1:8052)
      ├─ /api/v1/*          → PathoRAG (GPU 服务器 :8050)
      └─ /api/ebm/*         → PathoEBM (GPU 服务器 :8051)
```

## 快速部署

### 1. 前端构建

```bash
cp .env.example .env
# 编辑 .env，填入生产环境 API 地址
npm ci
npm run build
# 产物在 dist/
```

### 2. Case Storage 后端

```bash
cd server
cp .env.example .env
# 编辑 .env，填入 PostgreSQL 连接信息
pip install -r requirements.txt
alembic upgrade head          # 执行数据库迁移
uvicorn main:app --host 0.0.0.0 --port 8052 &
```

### 3. nginx

```bash
# 复制静态文件
cp -r dist /opt/oncology-aid/dist

# 复制 nginx 配置（按实际环境修改 upstream 地址后）
cp deploy/nginx.conf /etc/nginx/sites-available/oncology-aid
ln -s /etc/nginx/sites-available/oncology-aid /etc/nginx/sites-enabled/

# SSL 证书（自签名或医院内部 CA）
mkdir -p /etc/nginx/ssl
# 将 fullchain.pem 和 privkey.pem 放入 /etc/nginx/ssl/

nginx -t && nginx -s reload
```

## 部署检查清单

- [ ] `.env` 已从 `.env.example` 创建，填写了生产环境 API 地址
- [ ] `server/.env` 已从 `server/.env.example` 创建，DATABASE_URL 指向生产 PG
- [ ] `alembic upgrade head` 执行成功
- [ ] `nginx.conf` 中 upstream 地址已替换为实际后端地址
- [ ] SSL 证书已配置（生产环境禁止 HTTP 明文）
- [ ] CORS_ORIGINS 已设置前端域名
- [ ] Rate limiting 已按需调整
- [ ] `/api/health` 返回 `{"status":"ok","database":"connected"}`

## 环境变量参考

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `VITE_API_BASE` | PathoRAG 地址 | `http://localhost:8050` |
| `VITE_EBM_BASE` | PathoEBM 地址 | `http://localhost:8051` |
| `VITE_CASE_API_BASE` | Case Storage 地址 | 空（走 nginx 同源） |
| `DATABASE_URL` | PG 连接串 | 必填，无默认值 |
| `CORS_ORIGINS` | 允许的前端域名 | `http://localhost:5173` |
| `AUTH_MODE` | 鉴权模式 | `mock` |
| `RATE_LIMIT_REQUESTS` | 速率限制 | `120` |
