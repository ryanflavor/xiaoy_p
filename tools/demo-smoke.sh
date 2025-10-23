#!/usr/bin/env bash
set -euo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
cd "$here"

echo "[demo] bringing up core services (nats, gateway, aggregator, ui)"
docker compose -f compose.demo.yml up -d --quiet-pull nats gateway aggregator ui

echo "[demo] waiting for gateway /healthz"
for i in $(seq 1 50); do
  if curl -fsS http://localhost:8080/healthz | grep -q '"natsConnected":true'; then break; fi
  sleep 0.2
done

echo "[demo] running one-off wsclient to trigger forwarding"
docker compose -f compose.demo.yml --profile test run --rm wsclient >/dev/null 2>&1 || true

echo "[demo] publishing two demo messages"
docker compose -f compose.demo.yml run --rm publisher sh -lc '
  node examples/publish.mjs "smoke-$(date +%s)-A" && \
  node examples/publish.mjs "smoke-$(date +%s)-B"'

echo "[demo] checking /metrics"
curl -fsS http://localhost:8080/metrics | awk '/^xy_ws_messages_forwarded_total|^xy_ws_slow_consumers_total|^ws_msgs_rate/{print}'
echo "[demo] OK"

