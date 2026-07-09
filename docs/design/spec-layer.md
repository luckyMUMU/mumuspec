# Spec Layer — 树状分布的双向约束规范

> 层级: Level 1 设计文档 | 所属层: Spec Layer

---

## 1. 核心设计：正向 + 反向并重

每个规范单元包含两类硬性约束：

```yaml
## Requirement: API 响应格式

### SHALL (正向要求 — 必须做到)
- 所有 API 响应必须使用统一信封格式 `{ code, message, data }`
- 分页接口必须返回 `total`、`page`、`pageSize` 字段

### SHALL NOT (反向禁止 — 绝不能做)
- 禁止在 API 响应中直接返回数据库实体对象（必须经过 DTO 转换）
- 禁止使用 HTTP 状态码 200 表示业务错误

### Enforcement (可执行校验)
- SHALL-1: lint 规则 `enforce-response-envelope` 检查所有 Controller 返回类型
- SHALL_NOT-1: lint 规则 `no-raw-entity-return` 检查返回类型不含 `@Entity` 注解类
```

**禁止项优先级**：SHALL NOT 优先于 SHALL。冲突时以 SHALL NOT 为准。

## 2. 树状目录结构 — 渐进式披露

规范按项目目录结构分层存放。**每个目录的 `.mumuspec/` 包含该目录及其直接子目录的规范概要**。

```
my-project/
├── .mumuspec/                          # 根层规范 (Level 0)
│   ├── spec.md                         # 全局架构规范 + 正向/反向约束
│   ├── design.md                       # 根层设计文档（架构决策、技术选型）
│   ├── prohibitions.md                 # 全局禁止清单（汇总）
│   ├── config.yaml                     # MumuSpec 配置
│   ├── index.yaml                      # 规范索引（指向各子层）
│   └── contracts/                      # 契约层（见 contract-layer.md）
│
├── src/
│   ├── .mumuspec/                      # src 层规范 (Level 1)
│   │   ├── spec.md + design.md + prohibitions.md + index.yaml
│   ├── auth/
│   │   └── .mumuspec/                  # auth 模块规范 (Level 2)
│   ├── api/
│   │   ├── .mumuspec/                  # api 层规范 (Level 2)
│   │   └── controllers/
│   │       └── .mumuspec/              # controllers 层规范 (Level 3)
│   └── lib/
│       └── .mumuspec/                  # lib 模块规范 (Level 2)
└── tests/
    └── .mumuspec/                      # 测试规范 (Level 1)
```

> 完整目录结构见 [附录：目录结构](../appendix/directory-structure.md)。

## 3. 渐进式披露加载策略

当 AI 从某个目录切入工作时，**只加载三层规范 + 设计文档**：

```mermaid
graph TD
    subgraph Loaded["AI 在 src/api/controllers/ 目录工作"]
        L0["Level 0: /.mumuspec/spec.md + design.md"]
        L1["Level 1: /src/.mumuspec/spec.md + design.md"]
        L2["Level 2: /src/api/.mumuspec/spec.md + design.md"]
        L3["Level 3: /src/api/controllers/.mumuspec/spec.md + design.md"]
        IDX["概要: /src/api/.mumuspec/index.yaml"]
        L0 --> L1 --> L2 --> L3
        L2 -.-> IDX
    end
    subgraph NotLoaded["不加载"]
        N1["/src/auth/.mumuspec/*"]
        N2["/tests/.mumuspec/*"]
    end
```

`index.yaml` 记录直接子目录的规范概要，AI 通过索引决定是否深入加载某子目录。

## 4. 规范文件格式

### 4.1 `spec.md` — 规范定义文件

```yaml
---
layer: 2
scope: "src/api"
last_updated: "2026-07-09"
---
## Requirement: RESTful 路由
### SHALL
- 所有端点必须遵循 RESTful 命名规范
### SHALL NOT
- 禁止在 URL 中使用动词
### Enforcement
- SHALL-1: lint `restful-naming`
```

### 4.2 `prohibitions.md` — 禁止清单汇总

汇总本层及子模块所有 SHALL NOT，供 AI 快速加载。包含全局禁止（适用所有子目录）和模块级禁止（仅适用特定子目录）。

### 4.3 `design.md` — 目录级设计文档

记录本层的设计决策、架构原理和上下文。回答"为什么这样设计"，与 `spec.md`（定义"做什么/不能做什么"）互补。

| 维度 | `spec.md` | `design.md` |
|------|-----------|-------------|
| 回答的问题 | 做什么 / 不能做什么 | 为什么这样设计 |
| 约束类型 | 硬性约束（SHALL / SHALL NOT） | 设计决策与原理（软性指导） |
| 可执行校验 | 有 Enforcement 检查 | 无直接校验，但影响 spec 生成 |

**维护规则**：
1. 每个有 `spec.md` 的目录**必须**同时维护 `design.md`
2. 变更的 Design 阶段产出更新对应层级 `design.md`
3. `design.md` 纳入漂移检测

## 5. 规范层级关系与继承

```mermaid
graph TD
    L0["Level 0 Root<br/>全局架构规范 + 设计文档"]
    L1["Level 1 src<br/>编码规范 + 设计文档"]
    L2A["Level 2 auth"] --> L2B["Level 2 api"]
    L0 -->|继承| L1
    L1 -->|继承| L2A
    L1 -->|继承| L2B
```

**继承规则**：
1. 子层自动继承父层的所有 SHALL 和 SHALL NOT
2. 子层可以收紧父层约束，**但不能放宽**
3. 子层的 SHALL NOT 累加到父层（不覆盖）
4. Enforcement 随 SHALL/SHALL NOT 一并继承，子层可重定义 check 方式但不可降低 severity
5. `design.md` 随规范层级一同继承

### 边界条件

#### 并发操作

| 场景 | 处理策略 |
|------|----------|
| 多人同时编辑同一层 spec.md | 单一活跃变更约束自然序列化；若 Git 合并冲突，CI 阻断并报告冲突 |
| AI 与用户同时操作 .mumuspec.yaml | 文件级锁（`.mumuspec/.lock`），AI 操作前检查锁状态 |
| 并行 CI 触发 | 仅第一个 CI 运行全量检查，后续 CI 检查锁文件并跳过或排队 |

#### 超深目录

| 目录深度 | 处理策略 |
|---------|----------|
| ≤ max_layer_depth (默认 5) | 正常加载 |
| > max_layer_depth | 深层目录共享父层规范，不创建独立 .mumuspec/ |
| 超深目录告警 | `mumuspec validate` 报告 WARN: "目录深度 X 超过 max_layer_depth" |

#### 空项目

| 场景 | 处理策略 |
|------|----------|
| `mumuspec init` 在空目录执行 | 创建最小 .mumuspec/ 结构（spec.md + design.md + config.yaml） |
| 无代码文件的项目 | 图谱功能跳过，规范校验仅检查格式 |
| 无 src/ 目录的项目 | 根层规范直接管理，不创建子层 |

## 6. 文档生成引擎

MumuSpec 根据各目录下的 `spec.md` + `design.md` 自动生成对外文档，确保文档与内部规范一致。

### 文档类型

| 文档类型 | 目标读者 | 数据来源 | 输出目录 |
|---------|---------|---------|---------|
| 技术文档 | 开发者、架构师 | spec.md + design.md | `docs/technical/` |
| 业务文档 | 产品经理、业务方 | spec.md + design.md | `docs/business/` |
| 集成指南 | 外部集成方 | `contracts/outbound/` | `docs/integration/` |
| 外部依赖文档 | 开发者、运维 | `contracts/external/` | `docs/dependencies/` |

### 上下文聚合

生成某层文档时，聚合从根到目标层的所有规范上下文：
- **技术文档**：聚合所有 `spec.md` 的 SHALL + `design.md` 的 Design Decisions
- **业务文档**：聚合 Requirement 描述 + Architecture Overview
- 不加载兄弟模块规范（避免上下文过载）

### 模板系统

模板定义如何从 spec + design 提取信息并组织为文档：
- 项目自定义模板：`.mumuspec/templates/`
- 内置默认模板：`@mumuspec/templates/`
- 可通过 npm 包分发共享

### 与变更生命周期集成

| 阶段 | 文档生成动作 |
|------|------------|
| Design | 更新 design.md 后，标记受影响文档为 stale |
| Build | 实现完成后，自动重新生成受影响文档 |
| Verify | 校验生成文档与 spec/design 的一致性 |
| Archive | 将最终文档提交到主分支 |

> 完整配置项见 [参考：配置文件](../reference/configuration.md)。

---

> **导航**: [← 返回概览](../overview.md) | [契约层 →](contract-layer.md)
