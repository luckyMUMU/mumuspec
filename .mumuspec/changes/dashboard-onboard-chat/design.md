# Design — Dashboard + Onboard Chat

> **变更名**: dashboard-onboard-chat
> **工作流**: full / phase: design
> **产出阶段**: Design (Step 3 自顶向下分层设计)
> **参考**: proposal.md, cognitive-map.yaml, Understand-Anything dashboard 结构

---

## 1. 系统定位

在 `mumuspec/dashboard/` 新增一个独立运行的 React 18 + Vite 5 Web 应用，作为 spec / change / knowledge 的**可视化 + 对话入口**。
- **零耦合**: 不调用 mumuspec CLI、不读取 `.mumuspec/` 文件
- **全 mock**: 数据来自 `src/data/mock-*.ts`，形状对标真实 schema
- **纯组件化**: CSS Modules + hand-rolled，无 UI 组件库

---

## 2. 顶层架构 (Layout)

```
+--------------------------------------------------------------+
|  Toolbar (标题 + 视图切换占位 + 搜索)                          |
+------------+-------------------------------------------------+
|  SideNav   |  MainContent                                    |
|  (角色选择 |  +----------------------------+----------------+|
|   + 进度) |  |  StructureGraph            |  DetailPanel   ||
|            |  |  (React Flow canvas)       |  (节点详情 +   ||
|            |  |                            |   change 时间线)||
|            |  +----------------------------+----------------+|
|            +-------------------------------------------------+
|  OnboardChat (浮动对话气泡 / 抽屉 — 可收起)                    |
+--------------------------------------------------------------+
```

**Shell 组件**: `App.tsx` 编排 4 个区域，`zustand store` 共享选中节点 + chat 状态。

---

## 3. 分层设计 (L0 → L3)

### Level 0 — 项目根层 (dashboard/)

| 约束 | 类型 |
|------|------|
| Dashboard 应用 SHALL 作为独立子项目运行（`npm run dev --filter dashboard`） | SHALL |
| Dashboard SHALL 保持与 `mumuspec` CLI 的零依赖（package.json 独立） | SHALL |
| Dashboard 不 SHALL 调用或链接主 CLI 的任何源码 | SHALL NOT |
| Dashboard 不 SHALL 接入真实文件系统 / CLI / LLM | SHALL NOT (MVP) |
|  SHALL 使用 React Flow 进行结构图谱可视化 | SHALL |
|  SHALL 使用 Zustand 管理全局状态（选中节点 + chat 历史 + onboard 进度） | SHALL |
|  SHALL 使用 CSS Modules + CSS Variables（主题切换） | SHALL |
|  SHALL 使用 Vitest + Testing Library 测试 | SHALL |

### Level 1 — 模块层 (src/)

| 模块 | 职责 | 依赖 |
|------|------|------|
| `components/StructureGraph/` | 图谱可视化（力导向布局、交互） | React Flow, Store |
| `components/OnboardChat/` | 分支式引导对话 | Store, mock-onboard-steps |
| `components/QAView/` | 关键词检索问答 | Store, mock-knowledge |
| `components/DetailPanel/` | 节点详情 + change 时间线 | Store, mock-graph |
| `components/Toolbar/` | 顶部工具栏（标题 + 搜索框） | Store |
| `components/SideNav/` | 角色选择 + onboard 进度 | Store |
| `store/` | Zustand store（selectedNode / chatHistory / onboardProgress / role） | mock 数据 |
| `hooks/` | useOnboardFlow / useGraphLayout / useMockData / useKeyboardShortcut | — |
| `data/` | mock-graph.ts / mock-knowledge.ts / mock-onboard-steps.ts | — |
| `types/` | GraphNode / ChatMessage / QARequest / Adapter 预留接口 | — |
| `utils/` | 评分 / 布局常量 / id 生成 | — |

### Level 2 — 组件层

#### StructureGraph 拆为 4 个纯组件（grill-me 共识 split-four）

| 组件 | 职责 | Props |
|------|------|-------|
| `GraphCanvas` | React Flow 渲染 + 事件 nodeId 选中回调 | `nodes, edges, onNodeClick` |
| `NodeDetail` | 当前选中节点的 metadata 显示 nodeId |  |
| `EdgeLabel` | 边标签（GOVERNED_BY / DEPENDS_ON / DERIVED_FROM 展示） | 内置样式 |
| `Minimap` | React Flow Minimap（<50 节点时启用） | 跟随 GraphCanvas |

#### OnboardChat 拆为 3 个

| 组件 | 职责 |
|------|------|
| `ChatBubble` | 浮动入口 / 抽屉切换 |
| `ChatMessages` | 消息列表渲染（user/assistant/system-progress） |
| `ChatInput` | 输入框 + 发送按钮 |

#### QAView 拆为 2 个

| 组件 | 职责 |
|------|------|
| `SearchBox` | 输入 + 提交 |
| `QAResultList` | 命中列表（命中评分排序），click 联动 focusNode |

### Level 3 — 叶子层（hooks/utils）

- `useOnboardFlow(role)` → 引导步骤状态机，按 role 读写 localStorage
- `useGraphLayout(nodes, edges)` → 力导向位置初始化（React Flow 内置）
- `useMockData()` → 加载 mock-graph / mock-knowledge
- `useKeyboardShortcut()` → Esc 关闭详情面板 / `/` 聚焦搜索

---

## 4. 状态模型 (Zustand Store)

```typescript
interface DashboardStore {
  // 图谱
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  focusNode: (id: string) => void;       // Chat / QA 调用 → 居中+选中
  setSelectedNode: (id: string | null) => void;

  // Chat
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  appendMessage: (m: ChatMessage) => void;
  toggleChat: () => void;

  // Onboard
  role: 'new-member' | 'lead' | 'solo' | null;
  onboardProgress: Record<string, number>;  // role → step index
  setRole: (r: Role) => void;
  advanceOnboard: (step: number) => void;
  persistOnboard: () => void;               // 调 localStorage

  // QA
  qaQuery: string;
  qaResults: QAResult[];
  submitQA: (q: string) => void;            // 关键词匹配 + 评分

  // Detail
  detailTimeline: ChangeEvent[];            // 选中节点的 change 时间线
}
```

**Q3-001 落地**: `onboardProgress` 按 role 分区 key (`onboard:role:new-member`) 持久化到 localStorage。

**Q3-003 落地**: Chat 提及节点 → 调用 `store.focusNode(id)`，不允许直接 ref 调用图谱实例。

---

## 5. 数据契约 (Mock)

### GraphNode

```typescript
type NodeKind = 'SpecModule' | 'Constraint' | 'Change' | 'Knowledge';

interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  summary: string;          // 详情面板展示
  metadata: Record<string, string>;
  changeEvents?: ChangeEvent[];  // kind=Change 时
}
```

### ChangeEvent

```typescript
interface ChangeEvent {
  id: string;
  changeName: string;       // 如 "dashboard-onboard-chat"
  timestamp: string;        // ISO
  type: 'created' | 'phased' | 'archived';
}
```

### 初始 mock 数据约定（Q3-002 落地）

- 节点总数 ≥ 12（4 kind × 3 个）
- Change 节点 ≥ 3（满足时间线展示）
- 边总数 ≥ 12（每节点至少 1 入/1 出）
- 知识条目 ≥ 6（QA 可检索）

### Onboard step 定义

```typescript
interface OnboardStep {
  id: string;
  role: Role;
  prompt: string;            // 展示给用户的文案
  options?: { label: string; next: string; focusNode?: string }[];
  terminal?: boolean;
}
```

线性步骤 ≥ 3；分支步骤根据 role 定。

---

## 6. 事件流

### 6.1 Chat 引导 → 图谱联动

```
用户点击 ChatBubble → Chat 展开
Chat 推送 system-progress："你是谁？" [3 个 role 选项]
用户点 option → store.setRole(role) + store.advanceOnboard(1)
Chat 推送 assistant 消息（含 node 提及）
  → store.focusNode(mentionNodeId)
    → GraphCanvas 居中 + 高亮该节点
用户点节点 → DetailPanel 渲染 + 时间线（如有）
```

### 6.2 QA → 图谱联动

```
用户在 SearchBox 输入关键词 → store.submitQA(q)
  → utils 对 mock-knowledge 做关键词匹配 + 评分排序
  → store.qaResults updated
QAResultList 展示结果列表
用户点结果 → store.focusNode(result.nodeId) → GraphCanvas 联动
```

### 6.3 节点选中 → DetailPanel

```
用户点 GraphCanvas 节点 → store.setSelectedNode(id)
  → 根据 id 从 mock-graph 找节点
  → NodeDetail 渲染 metadata
  → 若节点 kind=Change，DetailPanel 渲染 changeEvents 时间线
```

---

## 7. 文件清单

```
dashboard/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── .gitignore
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.module.css
│   ├── components/
│   │   ├── StructureGraph/
│   │   │   ├── index.tsx
│   │   │   ├── GraphCanvas.tsx
│   │   │   ├── NodeDetail.tsx
│   │   │   ├── EdgeLabel.tsx
│   │   │   ├── Minimap.tsx
│   │   │   └── StructureGraph.module.css
│   │   ├── OnboardChat/
│   │   │   ├── index.tsx
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── ChatMessages.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── OnboardChat.module.css
│   │   ├── QAView/
│   │   │   ├── index.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   ├── QAResultList.tsx
│   │   │   └── QAView.module.css
│   │   ├── DetailPanel/
│   │   │   ├── index.tsx
│   │   │   ├── MetadataView.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── DetailPanel.module.css
│   │   ├── Toolbar/
│   │   │   ├── index.tsx
│   │   │   └── Toolbar.module.css
│   │   └── SideNav/
│   │       ├── index.tsx
│   │       └── SideNav.module.css
│   ├── store/
│   │   ├── index.ts
│   │   ├── useDashboardStore.ts
│   │   └── persist.ts          // localStorage 读写
│   ├── hooks/
│   │   ├── useOnboardFlow.ts
│   │   ├── useGraphLayout.ts
│   │   ├── useMockData.ts
│   │   └── useKeyboardShortcut.ts
│   ├── data/
│   │   ├── mock-graph.ts
│   │   ├── mock-knowledge.ts
│   │   └── mock-onboard-steps.ts
│   ├── types/
│   │   ├── graph.ts
│   │   ├── chat.ts
│   │   ├── onboard.ts
│   │   ├── qa.ts
│   │   └── adapter.ts          // 预留 Adapter 接口
│   ├── utils/
│   │   ├── scoring.ts          // QA 评分
│   │   ├── layout.ts           // 力导向初始位置
│   │   └── id.ts
│   └── __tests__/
│       ├── scoring.test.ts
│       ├── useOnboardFlow.test.ts
│       ├── useMockData.test.ts
│       ├── store.test.ts
│       └── components/
│           ├── GraphCanvas.test.tsx
│           ├── OnboardChat.test.tsx
│           ├── QAView.test.tsx
│           └── DetailPanel.test.tsx
```

---

## 8. Ponytail 约束

按 7 级阶梯，本项目的"额外"依赖评估：

| 依赖 | 阶梯 | 理由 |
|------|------|------|
| React | L1 (必须) | 用户请求，生态标准 |
| Vite | L3 (标准库够) → 但 React 工程实际需要 | 构建工具是 React 应用基础设施 |
| Zustand | L6 (能一行？不能) → L7 (最小可工作) | 比 Redux 轻量 |
| React Flow | L7 | 图谱可视化，社区成熟方案 |
| Vitest + Testing Library | L3 已有 Vitest；LL 是 React 测试标准 | — |

**不引入的依赖**: UI 库 (Radix/Mantine/Antd)、路由（单页足够）、i18n 库（MVP 单语言）。

---

## 9. 实现层级计划 (build_layers)

| Layer | 内容 | 依赖 |
|-------|------|------|
| L3 叶子 | utils/scoring.ts, utils/id.ts, types/* | — |
| L2 二级 | hooks/*, data/mock-*, store/persist.ts | L3 |
| L1 三级 | store/useDashboardStore.ts | L2 |
| L0 四级 | components/* (纯组件) | L1 |
| 根 | App.tsx + main.tsx 编排 | L0 |

---

## 10. 风险与兜底

| 风险 | 兜底 |
|------|------|
| React Flow + Vite 5 兼容性 | 锁定 @reactflow/react 最新版，lockfile 记录 |
| mock 与真实 schema 偏差 | types 文件按 `src/core/types.ts` 形状构造 |
| localStorage 不可用 | fallback 到 sessionStorage + 内存 |
| 100+ 节点性能 | post-MVP 引入虚拟化 |

---

## 11. Enforcement 检查项

| 检查 | 位置 | 方法 |
|------|------|------|
| store action 单向：Chat → Store → Graph | review | 静态调用图 |
| mock 数据 ≥3 change 节点 | test | `expect(changeNodes.length).toBeGreaterThanOrEqual(3)` |
| 组件导入不跨目录 | ESLint (手动) | 无 ESLint 时走 review |
| 测试用例通过率 100% | vitest run | CI 等价 |

---

## 13. (Reserved)

---

## 14. API Contracts

> Dashboard 不暴露外部 API（MVP），但保留 adapter 契约定义供 post-MVP 使用。

| 接口 | Provider | Consumer | 契约 |
|------|---------|----------|------|
| DashboardAdapter.fetchGraph() | 真实数据适配器 (post-MVP) | `hooks/useMockData.ts` 未来替换 | `Promise<GraphData>` |
| DashboardAdapter.fetchKnowledge() | 真实数据适配器 | QAView 替换 mock | `Promise<KnowledgeItem[]>` |
| DashboardAdapter.submitChat() | LLM 后端 | OnboardChat | `Promise<void>` |

> MVP: adapter 接口已声明于 `types/adapter.ts`，不做实现。

---

## 15. Data Flow

### A. 初始加载

```
App mount → useMockData() 加载 mock 常量 → store.init(nodes, edges)
         → App useEffect 推送 welcome ChatMessage
         → GraphCanvas 渲染 React Flow
         → DetailPanel 监听 selectedNodeId (初始 null → 空态)
```

### B. 用户交互流

```
[Chat/SideNav/GraphCanvas/QAView/Result]
  → 调用 store action (focusNode / setSelectedNode / submitQA / appendMessage)
    → 订阅者（GraphCanvas/DetailPanel）自动 re-render
```

### C. 持久化

```
onboardProgress 变化 → store 内部 writePersisted()
  → 读 localStorage (fallback sessionStorage)
  → key 前缀 mumuspec-dashboard: + onboard:role:{role}
```

### D. 边界流转

```
No graph data (空 mock 组) → GraphCanvas 仍渲染空 React Flow
                         → DetailPanel 显示空态
localStorage 禁用         → 静默 fallback 到 sessionStorage
关键词无命中              → QAView 显示空态
引导走完 terminal          → options 为空
```

---

## 16. Error Specification

| 场景 | 检测方式 | 行为 | 类型 |
|------|---------|------|------|
| mock 数据格式不符 | 单元测试 + 类型检查 | tsc / vitest 失败 → build 阻断 | SHALL |
| localStorage 写失败 | persist.ts try/catch 静默 | 降级 sessionStorage | fallback |
| React Flow 渲染异常 | 测试 mock 覆盖 | UI 不崩溃，显示空态 | fallback |
| 空 query submit 提交 | ChatInput guard | 不 dispatch，state 不变 | SHALL |
| 空 query QA submit | submitQA 提前返回 | qaResults = [] | SHALL |
| mockGraph 节点验证 | TC-L3-005 | 节点 ≥12 / change ≥3 / edges ≥12 | SHALL (Q3-002) |

> 全局兜底：React Error Boundary 未显式添加（MVP <20 节点无崩溃风险，post-MVP 按需补齐）。

---

> **设计状态**: 已收敛

## 12. Test Cases 映射 (详见 test-cases/)

| Layer | 用例 | 数量 |
|-------|------|------|
| L3 单元 | scoring / id 纯函数 | 5 |
| L2 集成 | useOnboardFlow / useMockData / store | 5 |
| L1 组件 smoke | GraphCanvas / OnboardChat / QAView / DetailPanel | 8 |
| L0 E2E 关键流 | 引导→联动；QA→联动；节点选中→详情 | 3 |
| **合计** |  | **≥ 21** |

---

> **设计状态**: 草稿，待用户最终确认 (BP-4) 与测试用例锁定 (BP-8)
