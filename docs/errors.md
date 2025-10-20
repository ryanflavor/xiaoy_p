# Error Codes and Acknowledgement Semantics — xiaoy

Updated: 2025-10-20
Status: Accepted (Baseline) — TD‑011/012/013/014

## 1. Acknowledgement Envelope

```json
{
  "type": "ack",
  "request_id": "01JABCDXYZ...",          // ULID, idempotent key
  "status": "ACCEPTED|PARTIAL|FILLED|FAILED",
  "code": 0,                                // 0 on ACCEPTED/PARTIAL, non‑zero on FAILED
  "message": "human readable",
  "ts": "2025-10-20T15:00:00Z",
  "data": { /* optional payload e.g., orderId, fills, remaining */ }
}
```

Notes
- Use the same `request_id` in all subsequent acks for the same order lifecycle.
- PARTIAL can be emitted multiple times; FILLED/FAILED are terminal.
- Idempotent replay: if the same `request_id` is received again within the dedup window, return the last known ack for that id.

## 2. Error Code Ranges

| Range | Category                          |
| ----- | ---------------------------------- |
| 1xxx  | Client validation / permission     |
| 2xxx  | Network / timeout / idempotency    |
| 3xxx  | Server/algo/exchange failures      |

## 3. Canonical Codes

| Code | Name                        | Typical Message                          | Action (Client)          |
| ---- | --------------------------- | ---------------------------------------- | ------------------------ |
| 1001 | INVALID_INPUT               | 参数不合法/缺少字段                      | 修正表单后重试           |
| 1002 | PERMISSION_DENIED           | 无权限或超出账户/主题范围                | 检查权限/账户选择        |
| 1003 | ACCOUNT_UNAVAILABLE         | 账户不可用/离线                          | 切换账户或稍后再试       |
| 1004 | CONFLICTING_PARAMS          | 参数组合冲突（如价格/方向/数量不一致）   | 修正参数                 |
| 1005 | RATE_LIMIT_LOCAL            | 本地限流触发                              | 等待退避                 |
| 2001 | TIMEOUT                     | 请求超时                                  | 自动指数退避重试 ≤3 次  |
| 2002 | IDEMPOTENT_REPLAY           | 幂等命中，返回首次回执                    | 幂等成功（无需处理）     |
| 2003 | RATE_LIMIT_REMOTE           | 服务端限流                                | 等待退避或降低速率       |
| 2004 | BACKPRESSURE                | 慢消费者/背压                              | 触发降级/减载            |
| 3001 | ALGO_REJECTED               | 算法拒绝或参数校验失败                    | 修正参数/选择其他模板    |
| 3002 | EXCHANGE_REJECTED           | 交易所拒单/风控拒绝                        | 查看原因后修正或放弃     |
| 3003 | PARTIAL_FILL_TIMEOUT        | 部分成交超时未完成                        | 允许取消/等待/改价       |
| 3004 | SERVICE_UNAVAILABLE         | 服务不可用/维护                            | 稍后重试                 |
| 3005 | SNAPSHOT_REBUILD_REQUIRED   | 检测到版本/序列不一致，需要重建            | 触发快照重建             |

## 4. Idempotency and Retry Policy

- Idempotency key: ULID (time‑ordered) + user/account/template hash (TD‑012)。
- Dedup window: 2 minutes or last 5000 requests (whichever larger).
- Retry: exponential backoff up to 3 attempts on 2001/2003/3004；do not retry on 1xxx/3001/3002.
- Audit: log all retries and idempotent hits with labels (user, account, request_id).

## 5. Mapping to NATS Subjects

- Requests: `{root}.orders.req.{account}` with headers:
  - `x-idempotency-key`: `<ulid>`
  - `x-user`: `<user>`
  - `x-account`: `<account>`
- Acks: `{root}.orders.ack.{account}.{request_id}` (payload per §1)。

## 6. UI Presentation Rules

- ACCEPTED → 绿色提示；FAILED → 红色错误；PARTIAL/FILLED → 信息/成功。
- 显示 error code + 简短原因，并提供“建议动作”。
- 可复制的“诊断详情”（原始回执 + request_id）。

