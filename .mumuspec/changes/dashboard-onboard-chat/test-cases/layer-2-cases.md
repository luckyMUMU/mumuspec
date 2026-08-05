# Layer 2 — Hook / Store / 数据集成测试

> 文件位置: `dashboard/src/__tests__/*.test.ts`

---

## TC-L2-001: useMockData — 加载 mock 数据不报错

**被测 hook**: `useMockData()`

| 步骤 | 期望 |
|------|------|
| hook 首次调用 | 返回 `{nodes, edges, knowledge}` 三个数组 |
| nodes 数组长度 | ≥ 12 |
| edges 数组长度 | ≥ 12 |
| knowledge 数组长度 | ≥ 6 |

---

## TC-L2-002: useOnboardFlow — 按 role 分区

**被测 hook**: `useOnboardFlow('new-member')`

| 步骤 | 期望 |
|------|------|
| 初始状态 | step === 0, progress === 0 |
| 调用 advance(1) | step === 1，localStorage key=`onboard:role:new-member` 被写 |
| 重新实例化 hook (role='lead') | 初始 step === 0（不影响另一 role 进度）|

**Q3-001 落地验证**

---

## TC-L2-003: useOnboardFlow — 分支路径

**被测 hook**: `useOnboardFlow` 的 `answer(stepId, optionId)` 行为

| 步骤 | 期望 |
|------|------|
| 在 step 0 选 role option | 跳转到该 role 对应的 step 1 |
| 在 step 0 选另一个 role option | 跳转到另一 role 的 step 1 |
| 走完所有 terminal step | `isTerminal === true` |

---

## TC-L2-004: store — focusNode 联动

**被测 store action**: `store.focusNode(id)`

| 步骤 | 期望 |
|------|------|
| 调用 focusNode("node-change-1") | store.selectedNodeId === "node-change-1" |
| 调用 focusNode 后触发 GraphCanvas 重绘 | (mock onNodeFocus 回调被调用，参数为 id) |

**Q3-003 落地验证（不通过 ref 调用）**

---

## TC-L2-005: store — QA submit 流程

**被测 store action**: `store.submitQA(query)`

| 步骤 | 期望 |
|------|------|
| submitQA("ponytail") | store.qaResults.length > 0，且结果的 score 降序 |
| submitQA("") | store.qaResults === [] |
| submitQA("不存在的词xyz123") | store.qaResults === [] |
 | 点击 QAResult 调用 focusNode(nodeId) | store.selectedNodeId === nodeId |
