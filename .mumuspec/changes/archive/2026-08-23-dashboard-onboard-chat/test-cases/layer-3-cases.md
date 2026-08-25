# Layer 3 — 叶子层测试用例 (纯函数)

> 文件位置: `dashboard/src/__tests__/*.test.ts`

---

## TC-L3-001: scoring — 关键词命中评分

**被测函数**: `utils/scoring.ts → scoreQuery(query, knowledgeItem)`

| 输入 | 期望 |
|------|------|
| query="ponytail", item.tags=["ponytail","constraint"] | score > 0 |
| query="", item.tags=["any"] | score === 0（空查询不返回）|
| query="不存在的词", item.tags=["spec"] | score === 0 |

---

## TC-L3-002: scoring — 评分排序稳定性

**被测函数**: `scoreQuery` 排序

| 输入 | 期望 |
|------|------|
| 3 个 knowledge items，query 命中其中 2 个 | 返回数组按 score 降序 |
| 全部未命中 | 返回空数组 |

---

## TC-L3-003: id — 唯一性

**被测函数**: `utils/id.ts → generateId(prefix)`

| 输入 | 期望 |
|------|------|
| 连续调用 100 次 | 100 个不重复 |
| prefix="node" | id 前缀为 "node-" |

---

## TC-L3-004: types/adapter.ts — Adapter 接口形状

**验证点**: 编译期检查

| 检查项 | 期望 |
|--------|------|
| `Adapter.fetchGraph()` 返回 `Promise<{nodes, edges}>` | TS 编译通过（接口 shape 定义正确）|
| `Adapter.submitChat()` 接受 `ChatMessage[]` | TS 编译通过 |

---

## TC-L3-005: mock-graph.ts — 数据约束校验

**被测文件**: `data/mock-graph.ts`

| 检查项 | 期望 |
|--------|------|
| 节点总数 | ≥ 12 |
| Change 节点数 | ≥ 3（Q3-002 落地）|
| 边总数 | ≥ 12 |
| 每条边 source/target 指向存在的节点 | 全部合法 |
