# Layer 1 — 组件 smoke tests

> 文件位置: `dashboard/src/__tests__/components/*.test.tsx`
> 工具: @testing-library/react + vitest + jsdom

---

## TC-L1-001: GraphCanvas — 渲染节点

**被测组件**: `<GraphCanvas nodes={mockNodes} edges={mockEdges} onNodeClick={() => {}} />`

| 步骤 | 期望 |
|------|------|
| render | 节点数量 === mockNodes.length（通过 role="button" 或 React Flow 默认 node selector 断言）|
| 节点可见文本 | 至少一个节点文本命中 "spec" 或 "ponytail" |

---

## TC-L1-002: GraphCanvas — 点击节点触发回调

**被测组件**: `<GraphCanvas />`

| 步骤 | 期望 |
|------|------|
| 模拟点击第一个节点 | onNodeClick 回调被调用，参数为节点 id |

---

## TC-L1-003: OnboardChat — 初始渲染与展开

**被测组件**: `<OnboardChat />`

| 步骤 | 期望 |
|------|------|
| 初始渲染 | ChatBubble 可见（未展开）|
| 点击 ChatBubble | ChatMessages 区域可见 |
| 发送空消息 | 不 state 变化（guard 拒绝空消息）|

---

## TC-L1-004: OnboardChat — 分支回答

**被测组件**: `<OnboardChat />`

| 步骤 | 期望 |
|------|------|
| 第一条 system-progress 消息渲染 | 可见 3 个 role 选项按钮 |
| 点击 "Tech Lead" option | 下一条 assistant 消息展示与 lead 相关引导内容，localStorage 被写 |

---

## TC-L1-005: QAView — 搜索命中

**被测组件**: `<QAView />`

| 步骤 | 期望 |
|------|------|
| 输入 "ponytail" 并提交 | QAResultList 展示 ≥ 1 个结果 |
| 点击首个结果 | 调用 store.focusNode(result.nodeId)（通过 spy 验证）|

---

## TC-L1-006: QAView — 空结果

**被测组件**: `<QAView />`

| 步骤 | 期望 |
|------|------|
| 输入 "xyznotexist" 并提交 | QAResultList 提示 "无匹配结果"（或空态文案）|

---

## TC-L1-007: DetailPanel — 渲染选中节点

**被测组件**: `<DetailPanel />` (给定 store.selectedNodeId 非空)

| 步骤 | 期望 |
|------|------|
| selectedNodeId 对应 Change 节点 | 显示 Timeline 区域 |
| selectedNodeId 对应 Knowledge 节点 | 不显示 Timeline 区域 |
| selectedNodeId === null | 显示空态 "请选择节点" 提示 |

---

## TC-L1-008: Toolbar / SideNav — 初始渲染

**被测组件**: `<Toolbar />` + `<SideNav />`

| 步骤 | 期望 |
|------|------|
| Toolbar | 标题 "MumuSpec Dashboard" 可见，搜索输入框可见 |
| SideNav | 3 个角色选择按钮可见，显示当前 role 状态 |
