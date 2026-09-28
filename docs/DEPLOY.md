# 部署

1. 配置 `DATABASE_URL`、`REDIS_URL` 和足够长的随机 `JWT_SECRET`
2. 配置公开 HTTPS 地址，例如 `WEB_ORIGIN=https://test.example.com`
3. 配置 `ADMIN_USERNAME` 与足够长的随机 `ADMIN_PASSWORD`
4. 在 `server` 目录执行 `npx prisma migrate deploy`，创建网页身份、可重复验证码和后台所需数据表
5. 执行 `docker compose up -d --build`，或在 Node.js 20+ 环境运行 `npm run build && npm start`
6. 生产环境设置 `NODE_ENV=production`

部署完成后：

- `/`：客户使用的手机自适应 HTML 网页
- `/admin`：运营管理后台
- `/api/health`：服务健康检查

网站与 API 由同一个 Fastify 服务提供，不需要另外部署前端静态站。反向代理应把整个域名转发到服务端端口，并启用 HTTPS。

本地网页直接访问 `http://127.0.0.1:3000/`。
