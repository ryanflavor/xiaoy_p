#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

PROJECT_NAME="wsdemo_$(date +%s)"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"
TMP_LOG="/tmp/ws-gateway-e2e.log"
WS_CLIENT_PID_FILE="/tmp/ws-gateway-e2e.pid"

cleanup() {
  set +e
  if [[ -f "$WS_CLIENT_PID_FILE" ]]; then
    kill "$(cat "$WS_CLIENT_PID_FILE")" >/dev/null 2>&1 || true
    rm -f "$WS_CLIENT_PID_FILE"
  fi
  COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[1/6] Ensuring local deps (jose, ws, nats) installed"
npm install --no-audit --no-fund >/dev/null 2>&1

echo "[2/6] Generating demo JWT keypair/token"
node --input-type=module <<'NODE'
import { generateKeyPair, exportSPKI, exportJWK, SignJWT } from 'jose'
import { writeFileSync } from 'node:fs'
const main = async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const pub = await exportSPKI(publicKey)
  const token = await new SignJWT({ sub: 'demo-user', scope: 'read' })
    .setProtectedHeader({ alg: 'RS256', kid: 'demo-kid-1' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey)
  writeFileSync('.demo_pub.pem', pub.trim() + '\n')
  writeFileSync('.demo_token.txt', token + '\n')
  const jwk = await exportJWK(publicKey); jwk.kid = 'demo-kid-1'; jwk.alg = 'RS256'; jwk.use = 'sig'
  writeFileSync('.demo_jwks.json', JSON.stringify({ keys: [jwk] }) + '\n')
}
await main()
NODE

echo "[3/6] Starting docker compose (NATS + Gateway)"
# Find a free host port if default is taken
if ss -ltn | awk '{print $4}' | grep -q ":$GATEWAY_PORT$"; then
  for p in 18080 18081 18082 18083 18084; do
    if ! ss -ltn | awk '{print $4}' | grep -q ":$p$"; then GATEWAY_PORT=$p; break; fi
  done
fi
echo "Using host port: $GATEWAY_PORT"

# TLS/JWKS switches
if [[ "${DEMO_TLS:-0}" == "1" ]]; then
  echo "[TLS] Enabling WSS with self-signed cert"
  openssl req -x509 -newkey rsa:2048 -nodes -keyout .demo_tls_key.pem -out .demo_tls_cert.pem -subj "/CN=localhost" -days 1 >/dev/null 2>&1
  export TLS_ENABLE=1
  export TLS_CERT_PATH=/app/.demo_tls_cert.pem
  export TLS_KEY_PATH=/app/.demo_tls_key.pem
  export WS_URL="wss://localhost:$GATEWAY_PORT/ws"
else
  unset TLS_ENABLE TLS_CERT_PATH TLS_KEY_PATH
  export WS_URL="ws://localhost:$GATEWAY_PORT/ws"
fi

if [[ "${DEMO_JWKS:-0}" == "1" ]]; then
  echo "[JWKS] Enabling JWKS mode (local jwks service)"
  export JWT_JWKS_URL=http://jwks:8089/jwks.json
else
  unset JWT_JWKS_URL
fi

GATEWAY_PORT="$GATEWAY_PORT" COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose up -d --quiet-pull

echo "[4/6] Waiting for /healthz"
SCHEME=$([[ "${DEMO_TLS:-0}" == "1" ]] && echo https || echo http)
for i in {1..60}; do
  if curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/healthz" || true

echo "[5/6] Starting WS client and publishing demo messages (positive path)"
TOKEN="$(cat .demo_token.txt)" DURATION_SEC=30 \
  NODE_TLS_REJECT_UNAUTHORIZED=$([[ "${DEMO_TLS:-0}" == "1" ]] && echo 0 || echo 1) \
  node examples/ws-client.mjs > "$TMP_LOG" 2>&1 & echo $! > "$WS_CLIENT_PID_FILE"

# Wait until gateway reports NATS connected (triggered by first WS connection)
for i in {1..30}; do
  HC=$(curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/healthz" || echo '{}')
  if echo "$HC" | grep -q '"natsConnected":true'; then break; fi
  sleep 1
done
COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose exec -T -e NATS_URL=nats://nats:4222 gateway node /app/examples/publish.mjs "demo-msg-$(date +%H%M%S)-A"
sleep 1
COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose exec -T -e NATS_URL=nats://nats:4222 gateway node /app/examples/publish.mjs "demo-msg-$(date +%H%M%S)-B"
echo "[6/6] Verifying receipt and metrics (positive path)"
# Wait up to ~20s for the message to arrive
for i in {1..20}; do
  if grep -qE "^message: .*demo-msg-" "$TMP_LOG"; then break; fi
  sleep 1
done
if ! grep -qE "^message: .*demo-msg-" "$TMP_LOG"; then
  echo "E2E FAILED: WebSocket client did not receive expected messages" >&2
  echo "--- WS CLIENT LOG ---" >&2
  sed -n '1,200p' "$TMP_LOG" >&2 || true
  exit 2
fi

FWD=$(curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/metrics" | awk '/^xy_ws_messages_forwarded_total/ {print $2}')
if [[ -z "$FWD" || "$FWD" -lt 1 ]]; then
  echo "E2E FAILED: metrics xy_ws_messages_forwarded_total not incremented" >&2
  exit 3
fi

echo "E2E PASS: received messages and metrics ok (forwarded_total=$FWD)"

# ---------- Negative: invalid JWT must fail handshake ----------
echo "[NEG-1] Invalid JWT handshake must fail"
if NODE_TLS_REJECT_UNAUTHORIZED=$([[ "${DEMO_TLS:-0}" == "1" ]] && echo 0 || echo 1) node examples/ws-fail.mjs TOKEN="invalid-token" >/dev/null; then
  echo "NEG-1 PASS"
else
  echo "NEG-1 FAIL" >&2; exit 4
fi

# ---------- Negative: unauthorized subject should not forward ----------
echo "[NEG-2] Unauthorized subject not forwarded"
BASE=$(curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/metrics" | awk '/^xy_ws_messages_forwarded_total/ {print $2}')
TOKEN="$(cat .demo_token.txt)" WS_URL="$SCHEME://localhost:$GATEWAY_PORT/ws" DURATION_SEC=10 node -e '
  import { readFileSync } from "node:fs";
  import { WebSocket } from "ws";
  const url = process.env.WS_URL;
  const token = process.env.TOKEN || readFileSync(".demo_token.txt", "utf8").trim();
  const ws = new WebSocket(url, ["bearer", token]);
  ws.on("open", () => { ws.send(JSON.stringify({ type: "subscribe", subjects: ["forbidden.topic"] })); });
  setTimeout(() => { ws.close(); }, 6000);
  ws.on("error", () => {});
' >/dev/null 2>&1 &
sleep 2
COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose exec -T -e NATS_URL=nats://nats:4222 -e SUBJECT=forbidden.topic gateway node /app/examples/publish.mjs "neg-forbidden-$(date +%H%M%S)"
sleep 3
AFTER=$(curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/metrics" | awk '/^xy_ws_messages_forwarded_total/ {print $2}')
if [[ "$AFTER" -ne "$BASE" ]]; then
  echo "NEG-2 FAIL: forwarded_total changed ($BASE -> $AFTER)" >&2; exit 5
else
  echo "NEG-2 PASS"
fi

# ---------- Optional: try to trigger slow consumer (non-blocking) ----------
echo "[OPT] Attempt to trigger slow consumer (best effort)"
COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose exec -T -e NATS_URL=nats://nats:4222 gateway node /app/examples/publish-bulk.mjs N=200 SIZE=65536 SUBJECT=xy.md.tick.demo || true
SC=$(curl -kfsS "$SCHEME://localhost:$GATEWAY_PORT/metrics" | awk '/^xy_ws_slow_consumers_total/ {print $2}')
echo "slow_consumers_total=$SC (0 is acceptable in fast local loops)"
exit 0
