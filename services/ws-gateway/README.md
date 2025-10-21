# WS Gateway (NATS → WebSocket)

Minimal link from NATS subjects to browser WebSocket clients with TLS, JWT verification, Prometheus metrics, and health checks.

## Features

- JWT verification via JWKS or static public key (RS256/ECDSA)
- Subject ACL whitelist (supports `*` and `>` wildcards), default `xy.md.*`
- Per-connection bounded outbound queue with drops counted
- `/metrics` (Prometheus) and `/healthz`
- Structured logs (pino)

## Quick Start (dev)

```bash
npm --prefix services/ws-gateway install
npm --prefix services/ws-gateway run dev
```

Environment variables (defaults shown):

```
PORT=8080
HOST=0.0.0.0
WS_PATH=/ws
HEALTH_PATH=/healthz
METRICS_PATH=/metrics
NATS_URLS=nats://localhost:4222
WS_SUBJECT_WHITELIST=xy.md.*
ALLOWED_ORIGINS=*
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
```

Security defaults:
- permessage-deflate: disabled by default
- maxPayload: 1 MiB

See `docker-compose.yml` for a local NATS + gateway setup and `examples/publish.mjs` for publishing demo messages.

## Environment Management

- Copy `services/ws-gateway/.env.example` to `.env.local` and adjust non-sensitive variables.
- Place PEM/CRT/KEY files under `services/ws-gateway/.secrets/` and use the overlay compose file:

```
docker compose -f services/ws-gateway/docker-compose.yml \
               -f services/ws-gateway/docker-compose.secrets.yml up
```

Variables of interest:
- Auth: `JWT_JWKS_URL` (preferred) or `JWT_PUBLIC_KEY` (PEM path)
- TLS (gateway): `TLS_ENABLE`, `TLS_CERT_PATH`, `TLS_KEY_PATH`
- NATS TLS: `NATS_TLS_ENABLE`, `NATS_TLS_CA|CERT|KEY`

For Kubernetes, mount secrets to `/run/secrets/...` and point env vars to those paths.
