# Story 1.1: 仓库与 CI 基线

Status: Ready for Review

## Story

作为工程团队（Enabler，服务 Trader），
我希望建立仓库与 CI 骨架（统一构建/格式化/单测与 PR 门禁），
以便团队能一致、可重复地集成与发布，缩短迭代并减少回归风险。

## Acceptance Criteria

1. CI 运行 lint/format/unit 构建；启用主干保护与 PR 检查。
2. 基础目录结构与环境变量、特性开关就绪。
3. 提供模板 README 与 CONTRIBUTING 指南。

## Tasks / Subtasks

- [x] 初始化仓库与工作区（AC2）
  - [x] 建立基础目录：`apps/`, `services/`, `packages/`, `tools/`（与架构一致）
  - [x] 添加 `.editorconfig`、`.gitattributes`、`.gitignore`
  - [x] 初始化 `pnpm` workspace（`package.json` + `pnpm-workspace.yaml`）
  - [x] 约定 Node 版本（`package.json#engines`）

- [x] 配置 CI 门禁（AC1）
  - [x] 选择 CI（GitHub Actions `.github/workflows/ci.yml` 或 GitLab CI `.gitlab-ci.yml`）
  - [x] 步骤（与架构一致，pnpm）：`setup-node` → `corepack enable && corepack prepare pnpm@9.12.2 --activate` → `pnpm install` → `pnpm run lint` → `pnpm run lint:eslint` → `pnpm run format:check` → `pnpm -r run test:cov` → `pnpm -r test`
  - [x] 失败即阻断合并；生成基础测试覆盖率报告（c8 text-summary + lcov）
  - [x] 启用主干保护与必须通过的状态检查（至少 lint/format/test）

- [x] 环境与特性开关基线（AC2）
  - [x] 提供 `.env.example`（不提交敏感值）
  - [x] 预置 `FEATURE_FLAGS` 配置（tools/feature-flags.*）

- [x] 文档基线（AC3）
  - [x] `README.md`：项目简介、运行/构建/测试命令
  - [x] `CONTRIBUTING.md`：提交规范、分支策略、PR 流程

- [x] 测试与格式化基线（支撑 AC1）
  - [x] ESLint + Prettier 基线配置与 CI 校验
  - [x] 前端：`vitest` 占位示例测试（packages/core/spec/vitest.spec.js）
  - [x] 后端：Go `go test` 占位测试（services/gocore）
  - [x] Python（uv）测试基线：packages/pycore + pytest（CI 通过 uv 执行）
  - [x] JS/TS 覆盖率：c8 生成 text-summary 与 lcov（CI 打印）

## Dev Notes

- 需求与上下文摘要（requirements_context_summary）
  - 目标：建立仓库与 CI 骨架，确保构建/格式化/单测一致并为变更设置门禁（PR/主干保护）。
  - 关联 PRD：
    - FR019 环境与发布、特性开关（docs/PRD.md#L181-L199 及“Requirements/FR019”语境）。
    - FR011 契约治理与 CI 兼容检查（后续故事落地，此处预留 CI 任务入口）（docs/PRD.md 概要“契约治理”）。
  - 关联架构：采用 Node 22 + pnpm 工作区、TypeScript、Go/Python 服务分层；统一以 monorepo 管理、GitHub/GitLab CI 运行 lint/format/test（docs/solution-architecture.md: 技术栈与组件）。
  - 成功标准：合并请求需通过 lint/format/unit，主干受保护；默认分支生成构建产物与基础报告。

### Project Structure Notes

- （structure_alignment_summary）
  - 当前未检测到 unified-project-structure.md；按照架构文档建议的目录逐步成型：
    - apps/: 前端与可执行应用（如 apps/web）
    - services/: 后端/网关/聚合器（如 services/ws-gateway, services/aggregator-go）
    - packages/: 共享库与契约（如 packages/contracts）
    - tools/: CI/脚本
  - 命名与路径遵循 kebab-case；语言工作区：`pnpm` 用于 JS/TS，`uv`/`pip` 用于 Python，`go mod` 用于 Go。
  - 待补：统一 lint/format 配置与测试约定文档。

### References

- docs/epics.md: Epic 1 → Story 1.1（验收标准与动机）
- docs/PRD.md: Goals/Requirements（FR019、FR011 相关）
- docs/solution-architecture.md: 技术栈与组件目录建议

## Change Log

| Date | Change | Author |
| ---- | ------ | ------ |
| 2025-10-20 | 初始化草案（create-story 自动生成） | ryan |
| 2025-10-20 | dev-story：建立工作区与最小 CI/测试，提交基础文档与脚本 | ryan |
| 2025-10-20 | dev-story：新增 c8 覆盖率、ESLint/Prettier、Python(uv+pytest) 基线与 CI | ryan |
| 2025-10-20 | 标记为 Ready for Review | ryan |

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->
 - docs/stories/story-context-1.1.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-10-20 Plan & Implementation
  - 读取 Story/AC 与 Dev Notes，选取首个未完成任务：初始化仓库与 CI 骨架。
- 方案：使用 npm workspaces（Node 22 已就绪），最小化依赖；使用 Node 内置测试；自定义 lint/format 检查以避免额外依赖。
  - 实施：创建目录与配置文件；新增 `packages/core` 与示例测试；配置 CI（GitHub Actions）。加入 ESLint/Prettier 与 c8 覆盖率；新增 Python（uv+pytest）基线 `packages/pycore`。
  - 校验：`npm run lint`、`npm run format:check`、`npm test --workspaces` 通过；CI 将运行 `npm run -ws test:cov` 并打印覆盖率 summary；Python 侧 `uv run -m pytest`。
  - 风险：
    - 分支保护：需在远端仓库设置必须通过的状态检查。
    - 分支保护：需在远端仓库设置必须通过的状态检查。

### Completion Notes List

- 2025-10-20 完成“仓库与 CI 基线”落地；建议下一个提交中：
  - 已在 CI 中加入 JS/TS 覆盖率（c8 text-summary + lcov）。
  - 已引入 ESLint/Prettier；若后续需要更严格规则，可扩展配置。

### File List

- .editorconfig
- .gitattributes
- .gitignore
- package.json
- pnpm-workspace.yaml
- .github/workflows/ci.yml
- README.md
- CONTRIBUTING.md
- .env.example
- tools/lint.mjs
- tools/format-check.mjs
- tools/build.mjs
- tools/feature-flags.json
- packages/core/package.json
- packages/core/index.js
- packages/core/test/index.test.js
\- packages/core/spec/vitest.spec.js
\- services/gocore/go.mod
\- services/gocore/sum.go
\- services/gocore/sum_test.go
\- .eslintrc.cjs
\- .eslintignore
\- .prettierrc.json
\- .prettierignore
\- packages/pycore/pyproject.toml
\- packages/pycore/requirements-dev.txt
\- packages/pycore/README.md
\- packages/pycore/src/pycore/__init__.py
\- packages/pycore/tests/test_core.py
