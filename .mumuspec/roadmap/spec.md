---
layer: 0
scope: ".mumuspec/roadmap"
last_updated: "2026-08-09"
version: "v2"
based_on: "v1 (2026-08-04 .. 2026-08-09, R-0001~R-0005)"
type: roadmap
---

# Roadmap Spec

> 规范驱动的近期目标管理。覆盖全局规则定义、模块级目标注册、跨模块冲突检测。

---

## Roadmap 架构

```
.mumuspec/
├── roadmap/                          # 全局 Roadmap 入口
│   ├── spec.md                       # 本文档：规则定义 + 跨模块冲突检测
│   ├── items/                        # 当前活跃目标条目
│   │   └── R-0001.md .. R-0013.md
│   ├── template/                     # Item 模板目录
│   │   └── item.md
│   ├── archive/                      # 已归档的历史版本
│   │   └── 2026-Q3/                  # 按归档批次分目录
│   │       └── R-0001.md .. R-0005.md
│   └── BOUNDARY.md                   # 本目录边界文档
│
└── [module]/
    └── .mumuspec/
        └── roadmap/                  # 模块级 Roadmap（可选）
            ├── items/
            │   └── R-XXXX.md
            └── status.yaml
```

---

## Requirement: 模块级 Roadmap 注册

### SHALL
- 每个模块的 `.mumuspec/` 目录下**可选择性**创建 `roadmap/` 子目录管理本模块近期目标
- 全局 `.mumuspec/roadmap/` 负责定义规则、提供模板、执行跨模块冲突检测
- 创建模块级 roadmap 时，必须在本模块的 `BOUNDARY.md` 中声明 `has_roadmap: true`

### SHALL NOT
- 禁止 `roadmap/` 目录存在于根 `.mumuspec/` 以外的位置（非 `.mumuspec/` 管辖区域）
- 禁止模块级 roadmap item 直接引用其他模块的内部实现细节（仅可引用公开契约 / 边界）

### SHOULD
- 优先在全局 `.mumuspec/roadmap/items/` 创建跨模块目标，模块级 items 仅用于完全内聚的目标

### Enforcement
- ROADMAP-0: 检查 `roadmap/` 目录仅存在于 `.mumuspec/` 内部
- ROADMAP-1: 检查模块 BOUNDARY.md 中 `has_roadmap` 与实际目录一致性

---

## Requirement: 目标条目定义

### SHALL
- 每个 Roadmap Item 必须是独立的 `.md` 文件，文件名格式为 `R-<NNNN>.md`（4 位零填充序号）
- 每个 Item 文件必须包含有效的 frontmatter

#### Frontmatter 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识，格式 `R-<NNNN>` |
| `title` | string | 简明描述（<= 60 字符） |
| `status` | enum | `planning` / `planned` / `active` / `blocked` / `completed` / `deprecated` |
| `priority` | enum | `P0` / `P1` / `P2` |
| `scope` | string | 模块作用域路径（如 `src/core` 或 `.`） |
| `created_at` | date | ISO8601 创建日期 |
| `target_date` | date | ISO8601 目标完成日期 |

#### Frontmatter 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `owner` | string | 负责人标识 |
| `depends_on` | list[string] | 依赖的其他 Roadmap Item ID（不可同时 active） |
| `mutex_with` | list[string] | 互斥的 Roadmap Item ID（不可同时 active） |
| `excludes` | list[string] | 明确排除的范围声明 |
| `capacity_cost` | number | 占用的容量预算单位（默认 1） |
| `supersedes` | string | 替代的旧版本 Item ID（跨版本重编号时使用） |
| `completed_at` | date | 完成日期（仅 status=completed 时填写） |
| `scope_expanded` | string | 范围变更说明（实际实施与原始 scope 不同时填写） |

### SHALL NOT
- 禁止 Item 文件使用非 `R-` 前缀的文件名
- 禁止省略 frontmatter 中 `id` / `status` / `priority` / `scope` 任一字段
- 禁止 `depends_on` / `mutex_with` 引用不存在的 Item ID

### Enforcement
- ROADMAP-10: 校验文件名格式 `R-\d{4}\.md`
- ROADMAP-11: 校验 frontmatter 必填字段完整
- ROADMAP-12: 校验 `depends_on` / `mutex_with` 引用的 ID 存在性

---

## Requirement: 优先级规则

### SHALL
- 优先级分为三级：`P0`（必须完成）、`P1`（应该完成）、`P2`（可以延后）
- **同一模块内，同时处于 `active` 的 P0 Item 最多 1 个**
- **`planning` 状态的 Item 不参与优先级约束**（规划期可自由调整）
- 全局同时 `active` 的 P0 Item 总数不超过 3 个

### SHALL NOT
- 禁止未经评审将 P2 提升为 P0（需先降级/完成现有 P0）
- 禁止同一模块有超过 3 个 `active` P1 Item（避免资源分散）

### SHOULD
- P0 Item 应该对应到具体的 `target_date`，不允许空挂
- P1 Item 应该在有 P0 完成后被评估是否提升

### Enforcement
- ROADMAP-20: 校验同一模块 `active` P0 数量 <= 1
- ROADMAP-21: 校验全局 `active` P0 数量 <= 3
- ROADMAP-22: 校验模块 `active` P1 <= 3

---

## Requirement: 依赖规则

### SHALL
- 依赖关系必须是有向无环图（DAG），禁止循环依赖
- 如果 Item A `depends_on` Item B，则 A 的 `target_date` 必须晚于 B 的 `target_date`
- 被依赖的 Item（B）被标记为 `deprecated` 时，依赖方（A）必须被通知并评估影响

### SHALL NOT
- 禁止 `depends_on` 形成环（A→B→A 或更长环）
- 禁止 Item 依赖自身（自环）

### SHOULD
- 依赖层级不应超过 3 层（避免串行链条过长）
- 优先通过合并 Item 来减少依赖，而非增加依赖链长度

### Enforcement
- ROADMAP-30: 校验依赖图无环（拓扑排序验证）
- ROADMAP-31: 校验依赖方 target_date 晚于被依赖方
- ROADMAP-32: 校验被依赖 Item deprecated 时依赖方状态

---

## Requirement: 互斥规则

### SHALL
- 如果 Item A `mutex_with` Item B，则 A 和 B **不可同时处于 `active` 状态**
- 互斥声明是双向的：A `mutex_with` B 意味着 B 也 `mutex_with` A（系统自动维护对称性）
- 互斥理由必须在 Item 正文中显式声明（为什么不能同时进行）

### SHALL NOT
- 禁止 `mutex_with` 与 `depends_on` 指向同一目标（语义矛盾）
- 禁止互斥 Item 的 `target_date` 相同（如果时间完全不重叠则不构成互斥）

### SHOULD
- 优先使用 `depends_on`（串行）替代 `mutex_with`（并行延后），除非确实存在同时进行的技术风险

### Enforcement
- ROADMAP-40: 校验互斥矩阵对称性
- ROADMAP-41: 校验互斥 Item 无同时 active
- ROADMAP-42: 校验 mutex_with 与 depends_on 无交叠

---

## Requirement: 状态流转

### SHALL
- 状态只能按以下允许的方向流转：
  ```
  planning → planned → active → completed
     ↓          ↓        ↓
  deprecated  blocked  deprecated
                  ↓
              planned (解除阻塞后重新规划)
  ```
- `active` → `blocked` 转换必须声明阻塞原因
- 从 `blocked` 恢复必须重新经过 `planned`
- `completed` 状态不可逆（如需重启，新建 Item）

### SHALL NOT
- 禁止跳过 `planned` 直接从 `planning` 进入 `active`
- 禁止从 `completed` 回退到任何中间状态

### Enforcement
- ROADMAP-50: 校验状态转换合法性

---

## Requirement: 目标条目正文格式

### SHALL
- Item 正文必须包含以下 section：
  1. **背景（Background）**：为什么需要这个目标
  2. **范围（Scope）**：包含什么、不包含什么
  3. **验收标准（DoD）**：至少 2 条可验证的完成条件
- 互斥 Item 必须额外包含 **互斥理由（Mutex Rationale）** section

### SHOULD
- 正文应预估工作量（`capacity_cost` 估算）
- 正文应标识风险点及缓解措施

---

## 跨模块冲突检测

> 以下规则由全局 Roadmap Guard 执行，扫描所有模块级 + 全局级 items 后统一校验。

### SHALL
- 跨模块依赖必须引用目标模块的公开契约（INTERFACE / API），不得引用私有实现
- 跨模块互斥必须经过双方模块 owner 确认
- 全局 Roadmap Guard 每周至少运行一次（或任何 Item 状态变更时触发）

### SHALL NOT
- 禁止跨模块形成更大的循环依赖链（A 模块 P0 → B 模块 P0 → A 模块 P0）

### Enforcement
- ROADMAP-60: 全局依赖图无环（跨模块）
- ROADMAP-61: 全局 active P0 总数上限
- ROADMAP-62: 跨模块互斥对称性

---

## 容量预算

> 容量预算用于防止"过度承诺"冲突。

### SHALL
- 全局同时 `active` 的 Item 总数不超过 5 个
- 单个模块同时 `active` 的 Item 总数不超过 2 个
- `capacity_cost` 总和不可超过活跃容量预算（默认 6 单位）

### Enforcement
- ROADMAP-70: 校验全局 active 数量上限
- ROADMAP-71: 校验模块级 active 数量上限
- ROADMAP-72: 校验容量预算不超支

---

## 归档与版本管理

### SHALL
- 已完成的 Items 必须移至 `.mumuspec/roadmap/archive/<批次>/` 目录，不在 `items/` 中保留
- 归档批次命名格式：`YYYY-QN`（季度）或 `YYYY-MM`（月度）
- 新版 Items 重新编号从 R-0001 开始，通过 `supersedes` 字段引用旧版 ID

### Enforcement
- ROADMAP-80: `items/` 中不允许存在 `status: completed` 的 Item
- ROADMAP-81: 归档 Item 的 `supersedes` 引用链完整性

---

> **导航**: [← 规范](../spec.md) | [模板 →](./template/item.md) | [边界 →](./BOUNDARY.md)
