# Implementation Tasks: dashboard-onboard-chat

> Build mode: direct | TDD: tdd | Isolation: worktree
> Layers: L3 → L2 → L1 → L0 → root (自底向上)

---

## Layer 3: 叶子层 (utils + types + mock 数据约束)

- [x] T3.1 创建 `dashboard/` 项目脚手架（package.json / tsconfig / vite.config / index.html）
  - 文件: `dashboard/package.json`, `dashboard/tsconfig.json`, `dashboard/vite.config.ts`, `dashboard/index.html`, `dashboard/.gitignore`
  - 验收: `npm install` 成功，`npm run dev` 启动

- [x] T3.2 实现 `types/` 模块（graph/chat/onboard/qa/adapter）
  - 文件: `dashboard/src/types/graph.ts`, `chat.ts`, `onboard.ts`, `qa.ts`, `adapter.ts`
  - 验收: tsc --noEmit 通过

- [x] T3.3 实现 `utils/id.ts` + 测试
  - 文件: `dashboard/src/utils/id.ts`, `dashboard/src/__tests__/id.test.ts`
  - RED → GREEN: TC-L3-003

- [x] T3.4 实现 `utils/scoring.ts` + 测试
  - 文件: `dashboard/src/utils/scoring.ts`, `dashboard/src/__tests__/scoring.test.ts`
  - RED → GREEN: TC-L3-001, TC-L3-002

- [x] T3.5 实现 `data/mock-graph.ts` + 测试
  - 文件: `dashboard/src/data/mock-graph.ts`, `dashboard/src/__tests__/mock-graph.test.ts`
  - RED → GREEN: TC-L3-005（≥12 节点 / ≥3 change / ≥12 边）

- [x] T3.6 实现 `data/mock-knowledge.ts`
  - 文件: `dashboard/src/data/mock-knowledge.ts`
  - 验收: ≥6 条知识条目，关键词覆盖 ponytail / spec / change / constraint

- [x] T3.7 实现 `data/mock-onboard-steps.ts`
  - 文件: `dashboard/src/data/mock-onboard-steps.ts`
  - 验收: 3 个 role 分支；每 branch ≥3 步；包含 terminal step

## Layer 2: Hook / Store / 数据集成

- [x] T2.1 实现 `hooks/useMockData.ts` + 测试
  - 文件: `dashboard/src/hooks/useMockData.ts`, `dashboard/src/__tests__/useMockData.test.ts`
  - RED → GREEN: TC-L2-001

- [x] T2.2 实现 `hooks/useOnboardFlow.ts` + 测试
  - 文件: `dashboard/src/hooks/useOnboardFlow.ts`, `dashboard/src/__tests__/useOnboardFlow.test.ts`
  - RED → GREEN: TC-L2-002, TC-L2-003

- [x] T2.3 实现 `store/persist.ts`
  - 文件: `dashboard/src/store/persist.ts`
  - 验收: localStorage + sessionStorage fallback

## Layer 1: Store 主体

- [x] T1.1 实现 `store/useDashboardStore.ts` + 测试
  - 文件: `dashboard/src/store/useDashboardStore.ts`, `dashboard/src/__tests__/store.test.ts`
  - RED → GREEN: TC-L2-004 (focusNode), TC-L2-005 (QA submit)

## Layer 0: 组件层

- [x] T0.1 实现 StructureGraph 4 子组件 + smoke tests
  - 文件: `StructureGraph/{index,GraphCanvas,NodeDetail,EdgeLabel,Minimap}.tsx`
  - 测试: `StructureGraph.test.tsx`
  - RED → GREEN: TC-L1-001, TC-L1-002

- [x] T0.2 实现 OnboardChat 3 子组件 + smoke tests
  - 文件: `OnboardChat/{index,ChatBubble,ChatMessages,ChatInput}.tsx`
  - 测试: `OnboardChat.test.tsx`
  - RED → GREEN: TC-L1-003, TC-L1-004

- [x] T0.3 实现 QAView 2 子组件 + smoke tests
  - 文件: `QAView/{index,SearchBox,QAResultList}.tsx`
  - 测试: `QAView.test.tsx`
  - RED → GREEN: TC-L1-005, TC-L1-006

- [x] T0.4 实现 DetailPanel + Toolbar + SideNav + smoke tests
  - 文件: `DetailPanel/{index,MetadataView,Timeline}.tsx`, `Toolbar/index.tsx`, `SideNav/index.tsx`
  - 测试: `DetailPanel.test.tsx`, `Toolbar.test.tsx`, `SideNav.test.tsx`
  - RED → GREEN: TC-L1-007, TC-L1-008

## Root 编排

- [x] Troot.1 实现 `App.tsx` + `main.tsx` + E2E 集成 tests
  - 文件: `dashboard/src/App.tsx`, `dashboard/src/main.tsx`
  - 测试: `__tests__/e2e/*.test.tsx`
  - RED → GREEN: TC-L0-001, TC-L0-002, TC-L0-003

## 全局收尾

- [x] Tfinal.1 全量测试运行 + 构建
  - 验收: vitest run 全绿; `npm run build` 无 error

