## Versioning & Evolution Rules (Append‑Only)

- Only additive changes are allowed to released messages:
  - Add new optional/nullable fields at the end
  - Do not remove or rename existing fields
  - Do not change field numbers or types
- Deprecation process:
  - Mark a field as deprecated in docs/comments
  - Keep reading the field for ≥ 2 minor versions
  - Consumers must tolerate unknown/extra fields
- CI:
  - `buf breaking` runs on pull requests to block incompatible changes

### Directory Layout

- `proto/` — Protobuf schemas for snapshot streams
- `fbs/` — FlatBuffers schemas for tick/incremental streams

