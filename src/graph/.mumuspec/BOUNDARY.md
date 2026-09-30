---
scope: src/graph
layer: 2
---

# Boundary Document: graph

## 职责

把已存在于工件里的图事实（阶段图、契约上下游、约束继承树）渲染为可复现的图示文本。渲染是纯函数：同一输入必得同一字节输出，排序依据题注而非遍历顺序，源数据自相矛盾时失败并给出理由，不以静默修补换取"能画出图"。

## 边界

| 议题 | 处置 |
|------|------|
| 归本模块 | 图输入类型、四视图渲染、格式断言 |
| 不归本模块 | 工件读取与事实装配（`facts.ts` 只做适配，判定归各自源模块）、工作流定义（`change/phase-graph-loader`）、契约注册表（`contract`）、约束树（`spec`） |
| 图形渲染引擎 | 不引入——产物是 mermaid / dot / json 文本，渲染由宿主承担 |
| 视觉布局 | 不判定——节点坐标与美观归渲染宿主，本模块只保证拓扑与事实一致 |

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `renderStateMachine` | `(input, opts) => string` | render.ts | 阶段×转移状态机（含回退计数与不可达态） |
| `renderBpLanes` | `(input, opts) => string` | render.ts | 阻塞点泳道（未把守的边必须可见） |
| `renderContractGraph` | `(input, opts) => string` | render.ts | 契约上下游图 |
| `renderConstraintTree` | `(input, opts) => string` | render.ts | 约束沿目录树的继承树（断链即孤立节点） |
| `buildWorkflowGraphInput` | `(projectRoot, workflow?) => WorkflowGraphInput` | facts.ts | 从工作流定义装配状态机输入 |
| `buildContractGraphInput` | `(projectRoot) => ContractGraphInput` | facts.ts | 从契约注册表装配上下游输入 |
| `buildConstraintTreeInput` | `(projectRoot, targetPath?) => ConstraintTreeInput` | facts.ts | 从规范层装配约束继承树输入 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `RenderFormat` | 输出格式枚举（mermaid / dot / json） |
| `RenderOpts` | 渲染选项（格式与题注） |
| `RenderEdgeInput` | 单条边的输入 |
| `RenderState` | 单个状态节点输入 |
| `WorkflowGraphInput` | 状态机与泳道共用输入 |
| `ContractNodeInput` | 契约节点输入 |
| `ContractGraphInput` | 契约图输入 |
| `ConstraintLayerInput` | 约束层输入 |
| `ConstraintTreeInput` | 约束树输入 |

## 依赖声明

| 依赖 | 来源 | 用途 |
|------|------|------|
| `change/phase-graph-loader` | 兄弟模块 | 读取阶段图与阻塞点 |
| `contract/registry` | 兄弟模块 | 读取契约上下游 |
| `spec/loader` | 兄弟模块 | 读取规范层与约束继承 |
| 无外部渲染依赖 | — | 只产出文本，不解析图形 |

## 数据契约

| 契约 | 说明 |
|------|------|
| 确定性 | 同一输入字节级可复现；排序键为题注文本 |
| 失败优先 | 未知格式 ⇒ E-GRAPH-002；指向未声明节点的边 ⇒ E-GRAPH-003；不返回部分图 |
| 可见性 | 未把守的边、不可达节点、孤立层必须出现在输出中，不由渲染器省略 |
