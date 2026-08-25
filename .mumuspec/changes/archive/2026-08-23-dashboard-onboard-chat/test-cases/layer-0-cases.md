# Layer 0 — E2E 关键流 (component-level integration)

> 文件位置: `dashboard/src/__tests__/e2e/*.test.tsx`
> 工具: @testing-library/react + vitest + jsdom
> 说明: E2E 通过 render `<App />` 并模拟用户交互完成

---

## TC-L0-001: 完整 Onboard → 图谱联动流

**场景**: 用户通过 Onboard Chat 选择角色 → 引导提及节点 → 图谱联动高亮

| 步骤 | 期望 |
|------|------|
| render `<App />` | Dashboard 渲染，Chat 默认收起 |
| 点击 ChatBubble 展开 | 显示首条引导消息 |
| 点击 option "Tech Lead" | 系统更新 role，assistant 消息展示 |
| assistant 消息内含节点提及按钮 | 按钮可见（如 "查看 Spec 模块"）|
| 提及按钮 | `store.focusNode` 被调用，GraphCanvas 高亮对应节点（通过 spy）|
| 点击图谱高亮节点 | DetailPanel 渲染节点摘要 |

---

## TC-L0-002: QA → 图谱联动流

**场景**: 用户关键词搜索 → 命中知识条目 → 点击结果 → 图谱高亮

| 步骤 | 期望 |
|------|------|
| Toolbar 搜索框输入 "spec" | 输入值更新 |
| 提交搜索 | QAResultList 展示 ≥ 1 命中 |
| 点击第一个 QA 结果 | store.focusNode(result.nodeId) 被调用 |
| store 更新 | GraphCanvas 高亮该节点 |
| 选中节点为 Change 类型 | DetailPanel 显示 change 时间线区域 |

---

## TC-L0-003: 空数据兜底流

**场景**: mock 数据未加载完成 / 空数据时 Dashboard 表现

| 步骤 | 期望 |
|------|------|
| 使用空 mock（nodes=[]）启动 App | GraphCanvas 区域显示空态文案（"暂无数据"）|
| OnboardChat 在空数据下 | 仍显示引导（引导不依赖图谱数据）|
| QAView 在空数据下 | 搜索无命中 → 显示空态 |
