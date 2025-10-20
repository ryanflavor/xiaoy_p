# xiaoy UX/UI Specification

_Generated on 2025-10-20 by ryan_

## Executive Summary

本规范定义 Web 端交易席位的 UX/UI 设计边界与实现约束，为后续“解决方案架构（Phase 3）与实现（Phase 4）”提供稳定、可观测、可降级的交互基础。核心场景：单 WebSocket + SharedWorker 多标签扇出，在 4–5 个窗口并开与峰值约 4k tick/s 条件下保持 UI ≥60 FPS、端到端 P95 < 120ms、P99 < 180ms。

---

## 1. UX Goals and Principles

### 1.1 Target User Personas

- Trader（交易员）— 单一主角；效率与稳定优先。

### 1.2 Usability Goals

- 多窗口并开下的稳定 60 FPS；交互可见延迟 P95 < 500ms（筛选/Top‑K/订阅变更至可见）。
- 单连接一致性：跨标签共享订阅与缓存，切换页面不触发额外连接或重复解码。
- 明确的可观测性：FPS、端到端 p50/p95/p99、带宽、慢消费者事件均在 UI 可见。

### 1.3 Design Principles

- 即时性优先、稳态不抖动；关键面板保真优先，余量面板允许降级（采样降频/字段裁剪/停更）。
- 以交易效率为中心：快捷键、就地编辑、确认清晰的高风险操作（全撤、一键下单）。
- 状态可追溯：订阅/Top‑K/列集可保存与灰度；异常与处置留痕可回放。

---

## 2. Information Architecture

### 2.1 Site Map

- 登录/环境切换 → 主看板（行情/账户/风险） → 策略下单 → 算法监控 → 设置/偏好

### 2.2 Navigation Structure

- 顶部主导航：看板｜策略下单｜算法监控｜设置
- 侧边栏：组搜索/订阅与 Top‑K；状态与指标浮层入口

---

## 3. User Flows

1) 登录与环境选择 → 读取上次布局/订阅 → 进入主看板（3s 内会话恢复）

2) 组订阅/筛选/Top‑K 变更 → SharedWorker 批量合并（16–33ms）→ UI 增量绘制（≤8ms/帧）

3) 策略下单：选择模板 → 参数调整（速度/轮数/追单/持续/比例/偏移/开平/策略）→ 提交 → 回执/错误提示

4) 告警处置：阈值越界 → 跳转详情 → 降级或强制保真 → 记录处置与告警回放

---

## 4. Component Library and Design System

### 4.1 Design System Approach

- 原子化组件 + 组合式片段；数据密集表格与图表优先考虑增量渲染与虚拟化。

### 4.2 Core Components

- DataGrid（增量绘制/虚拟滚动）
- Chart（OffscreenCanvas 增量）
- FilterPanel（订阅/筛选/Top‑K）
- AlgoForm（策略模板与参数）
- MetricsOverlay（FPS/延迟/带宽/慢消费者）

---

## 5. Visual Design Foundation

### 5.1 Color Palette

- 深色主题为主，强调可读性与异常高亮；红/绿用于涨跌且满足对比度。

### 5.2 Typography

- 等宽数字字体用于价格/指标列；标题/正文分级明确。

### 5.3 Spacing and Layout

- 密集信息布局下的 8px 基线网格；面板可拖拽与保存布局。

---

## 6. Responsive Design

### 6.1 Breakpoints

- ≥1920（多列）｜1440｜1280｜1024｜768（最小保障）

### 6.2 Adaptation Patterns

- 面板折叠与优先级裁剪；低宽度状态降级图表细节。

---

## 7. Accessibility

### 7.1 Compliance Target

- 对齐 WCAG 2.1 AA；键盘可达与焦点可见。

### 7.2 Key Requirements

- 表格/图表提供文本替代与可聚焦摘要；高对比度模式；屏幕阅读器友好标签。

---

## 8. Interaction and Motion

### 8.1 Motion Principles

- 动画用于状态过渡与数据变化提示；避免影响读数的过度动效。

### 8.2 Key Animations

- 列更新淡入、告警闪烁（受速率限制）、指标趋势轻微过渡。

---

_File: docs/ux-spec.md_

