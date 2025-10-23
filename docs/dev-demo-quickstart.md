---
title: 开发 Demo 快速启动（免 Token）
date: 2025-10-22
---

目标
- 在本地/LAN 内快速演示端到端（WS→SharedWorker→UI），避免因 JWT 令牌过期阻断开发。

一键启动（推荐）
- 执行：`bash tools/dev-demo.sh`
  - 启动 Demo 服务（5174）与 Metrics Mock（8081）
  - 启动免鉴权 WS Gateway（默认端口 18080，不占用生产 8080）
  - 控制台会输出可直接打开的 URL：
    - 本机: `http://localhost:5174/demo/index.html?url=ws://localhost:18080/ws`
    - 局域网: `http://<LAN_IP>:5174/demo/index.html?url=ws://<LAN_IP>:18080/ws`

可选参数
- 覆盖端口：`PORT=19090 bash tools/dev-demo.sh`
- 禁用 Demo 页（生产/预发建议）：`DEMO_DISABLE=1 node apps/ui/demo/server.mjs`
- 收紧 Mock CORS：`METRICS_CORS_ORIGIN=http://localhost:5174 node apps/ui/demo/metrics-mock.mjs`

注意
- 免鉴权仅用于本地开发：脚本通过环境变量 `JWT_OPTIONAL=1` 启动网关，禁止在生产环境使用。
- 生产/预发：使用 OIDC/JWKS 校验、短时 Access Token 与刷新机制；见《ops-metrics-json-spec.md》和网关配置说明。

