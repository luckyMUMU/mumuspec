# Todo/Goal 与 MumuSpec 工作流集成方案

> **版本**: 1.1.0  
> **日期**: 2026-08-27  
> **状态**: 设计完善完成

---

## 一、总体架构

### 1.1 定位

Todo/Goal 是 MumuSpec 工作流的**辅助追踪层**，不替代 Change 管理系统，仅提供阶段内的细粒度进度可见性。

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        MumuSpec 工作流                           │
│  open → design → build → verify → archive                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 嵌入关系
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Todo/Goal 辅助层                              │
│                                                                  │
│  Goal（会话级目标）── 1:N ──→ Todo（步骤级任务）                 │
│       │                            │                             │
│       │ 关联                       │ 追踪                        │
│       ▼                            ▼                             │
│  Change（持久化变更）      Phase 内步骤进度                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 核心原则

1. **Todo/Goal 是会话级临时存储**，不持久化到磁盘
2. **Todo/Goal 不影响 mumuspec guard 校验**，Change 归档以 guard 为准
3. **Todo/Goal 增强进度可见性**，不改变 MumuSpec 核心机制
4. **外部征询类 Todo 必须获取用户显式确认**（P0 级约束）

---

## 二、Todo 任务列表设计

### 2.1 触发规则

| 场景 | 是否创建 Todo | 说明 |
|------|--------------|------|
| 单步操作（如读取一个文件） | ❌ | 过细粒度无价值 |
| 2-3 步的简单任务 | ❌ | 对话上下文足够 |
| **阶段内多步骤任务（≥3 步）** | ✅ | 核心场景 |
| 跨模块契约变更 | ✅ | 追踪影响分析、文档同步等 |
| TDD 测试用例编写 | ✅ | 锁定测试清单 |
| 用户决策点等待期间 | ✅ | 记录待确认项 |

### 2.2 各阶段 Todo 模板

#### Open 阶段 Todo 模板

```yaml
todo_write:
  - id: "open-1"
    content: "需求澄清：与用户确认功能边界和验收标准"
    status: pending
  - id: "open-2"
    content: "影响分析：识别 affected_scopes 和依赖模块"
    status: pending
  - id: "open-3"
    content: "PRD 拆分：评估是否需要拆分为多个变更"
    status: pending
  - id: "open-4"
    content: "工件审查：验证 proposal.md 完整性"
    status: pending
  - id: "open-5"
    content: "用户确认：等待用户审查确认提案 [需显式确认]"
    status: pending
```

#### Design 阶段 Todo 模板

```yaml
todo_write:
  - id: "design-1"
    content: "认知框架 Q1：收集已知的已知信息"
    status: pending
  - id: "design-2"
    content: "认知框架 Q2：追问已知的未知"
    status: pending
  - id: "design-3"
    content: "认知框架 Q3：推理未知的已知"
    status: pending
  - id: "design-4"
    content: "认知框架 Q4：扫描未知的未知（≥3 维度）"
    status: pending
  - id: "design-5"
    content: "技术设计：编写 design.md"
    status: pending
  - id: "design-6"
    content: "测试用例：设计并锁定 test-cases/"
    status: pending
  - id: "design-7"
    content: "Hyperplan 审查：对抗式自审设计方案"
    status: pending
  - id: "design-8"
    content: "用户确认：等待用户审查确认设计 [需显式确认]"
    status: pending
```

#### Build 阶段 Todo 模板

```yaml
todo_write:
  - id: "build-1"
    content: "计划准备：编写 tasks.md 实现计划"
    status: pending
  - id: "build-2"
    content: "Ponytail 检查：逐项检查 7 级优先级"
    status: pending
  - id: "build-3"
    content: "TDD Red：编写失败测试"
    status: pending
  - id: "build-4"
    content: "TDD Green：最小实现使测试通过"
    status: pending
  - id: "build-5"
    content: "TDD Refactor：重构优化"
    status: pending
  - id: "build-6"
    content: "契约校验：验证 BOUNDARY.md 同步"
    status: pending
  - id: "build-7"
    content: "范围检查：确认无范围蔓延"
    status: pending
```

#### Verify 阶段 Todo 模板

```yaml
todo_write:
  - id: "verify-1"
    content: "单元测试：运行全部测试套件"
    status: pending
  - id: "verify-2"
    content: "契约漂移检测：mumuspec drift"
    status: pending
  - id: "verify-3"
    content: "规范校验：mumuspec check"
    status: pending
  - id: "verify-4"
    content: "验证报告：编写 verify.md"
    status: pending
  - id: "verify-5"
    content: "分支处理：确认分支合并策略"
    status: pending
```

#### Archive 阶段 Todo 模板

```yaml
todo_write:
  - id: "archive-1"
    content: "规范合并：合并到主规范"
    status: pending
  - id: "archive-2"
    content: "知识提取：更新 knowledge/"
    status: pending
  - id: "archive-3"
    content: "归档确认：用户最终确认 [需显式确认]"
    status: pending
```

### 2.3 Todo 生命周期规则

#### 创建时机（自动初始化规则）

| 触发条件 | 初始化行为 | 说明 |
|---------|-----------|------|
| 进入新阶段（非跳过） | 按模板自动初始化 Todo 列表 | 核心场景 |
| 阶段被跳过（如 hotfix 跳过 design） | 不创建被跳过阶段的 Todo | 避免无意义任务 |
| 复杂任务拆解 | 动态添加 Todo 项 | 用户或 Agent 触发 |
| 预设路径升级 | 冻结旧 Todo，创建新 Goal + Todo | 见冲突 4 |

**自动初始化条件：**
- 当前阶段有对应的 Todo 模板
- 该阶段未被跳过
- 非预设路径升级场景（升级有特殊处理流程）

#### 更新时机
- 完成一个步骤后，立即标记 completed
- 发现新任务时，动态添加 pending 项
- 用户决策阻塞时，标记为 in_progress 并备注等待原因

#### 清理时机
- 阶段完成后，Todo 列表自然归档（会话级，不持久化）
- Change 归档时，Todo 列表销毁
- Change discard 时，Todo 列表立即销毁

### 2.4 Todo 完成判定标准

| Todo 类型 | 完成判定 | 备注 |
|-----------|---------|------|
| 代码实现 | 测试通过 + 代码审查 | — |
| 文档编写 | 内容完整 + 格式正确 | — |
| **外部征询** | **用户显式确认（AskQuestion 或文字确认）** | **P0：禁止默认完成** |
| 用户确认 | 用户明确同意 | 同步到 decisions.md |
| 契约校验 | BOUNDARY.md 已更新 + drift 通过 | — |

### 2.5 Todo 与 MumuSpec 工件的关系

| MumuSpec 工件 | Todo 关系 | 同步规则 | 同步命令 |
|--------------|----------|---------|---------|
| tasks.md | Todo 是 tasks.md 的会话级视图 | Todo 完成 → 自动更新 tasks.md 对应任务状态 | 手动或自动写入 |
| cognitive-map.yaml | Todo 追踪 Q1-Q4 进度 | Todo 完成 → 自动更新 cognitive_framework 字段 | `mumuspec state set <name> cognitive_framework.q1_count <N>` |
| test-cases/ | Todo 追踪测试设计 | Todo 完成 → 自动更新 test_cases.design_locked | `mumuspec state set <name> test_cases.design_locked true` |
| BOUNDARY.md | Todo 追踪契约校验 | Todo 完成 → 自动更新 drift 状态 | `mumuspec drift detect --change <name>` |
| decisions.md | Todo 记录决策项 | 用户确认决策时立即同步 | `mumuspec decisions append --phase <phase> --change <name> --text "<决策内容>"` |

**同步原则：**
1. Todo 是会话级缓存，MumuSpec 工件是持久化存储
2. Todo 完成时，必须同步到对应的 MumuSpec 工件
3. 同步失败时，Todo 标记为 in_progress，阻塞后续步骤
4. 归档前强制同步，不一致时阻塞归档

### 2.6 Todo 与 MumuSpec 阻塞点（BP）映射

| Todo ID | 对应阻塞点 | 阻塞点说明 | 显式确认要求 |
|---------|-----------|-----------|-------------|
| open-2 | BP-2 | Open 阶段大型 PRD 需确认拆分 | 是 |
| open-5 | BP-3 | Open 阶段提案/设计/任务审查确认 | 是 |
| design-2 | BP-4 | Brainstorming 中确认设计方向（Q2 追问） | 是 |
| design-3 | BP-5 | Brainstorming 中确认设计方向（Q3 推理） | 是 |
| design-7 | BP-6 | Hyperplan 问题 | 否（自审） |
| design-8 | BP-8 | 测试锁定确认 | 是 |
| build-1 | BP-9 | Build 阶段 plan-ready 暂停选择 | 是 |
| build-7 | BP-13 | Build 阶段范围扩展需重新设计或拆分新变更 | 是 |
| verify-1 | BP-14 | 验证失败时修复或接受偏差 | 是 |
| verify-5 | BP-16 | 分支处理方式选择 | 是 |
| archive-3 | BP-17 | Archive 阶段归档最终确认 | 是 |

**阻塞点规则：**
- 标记为"是"的 Todo 必须获取用户显式确认才能标记 completed
- 阻塞点 Todo 未完成时，不允许进入下一阶段
- 阻塞点 Todo 的完成判定与 MumuSpec guard 校验双重确认

### 2.7 Todo 粒度与 build_mode 的适配规则

| build_mode | Todo 粒度 | 说明 |
|-----------|-----------|------|
| executing-plans | 按 tasks.md 中的任务项追踪 | 细粒度，每个任务一个 Todo |
| subagent-driven-development | 按子代理目标追踪 | 中粒度，每个子代理一个 Todo |
| direct | 按实现步骤追踪 | 灵活粒度，根据复杂度调整 |

**适配规则：**
- `executing-plans` 模式：Todo 与 tasks.md 一一对应，自动同步
- `subagent-driven-development` 模式：Todo 追踪子代理进度，子代理内部步骤由子代理自行管理
- `direct` 模式：Todo 粒度由 Agent 根据任务复杂度自行决定

---

## 三、Goal 目标管理设计

### 3.1 触发规则

| 场景 | 是否创建 Goal | 说明 |
|------|--------------|------|
| 用户明确请求时 | ✅ | 遵循 create_goal 规则 |
| 单会话可完成的简单变更 | ❌ | Todo 足够 |
| **跨会话的大型变更** | ✅ | 如架构重构、多模块改造 |
| **需要预算控制时** | ✅ | 防止任务无限膨胀 |
| 预设路径（hotfix/tweak） | ❌ | 简单任务无需 Goal |

### 3.2 Goal 与 Change 的协作模型

```
┌─────────────────────────────────────────────────────────────┐
│                     Change（持久化）                         │
│  名称: feature-auth                                         │
│  阶段: build                                                │
│  持久化: .mumuspec/changes/feature-auth/                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N 关联
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Goal（会话级）                            │
│  目标: 完成核心认证逻辑                                      │
│  状态: active                                               │
│  预算: 20 turns                                             │
│  关联 Change: feature-auth                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Todo（步骤级）                            │
│  - 实现 JWT 验证                                            │
│  - 编写用户模型                                             │
│  - 添加登录端点                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Goal 创建规范

```yaml
# 创建 Goal 时的标准参数
create_goal:
  objective: "完成 [Change名称] 的 [具体子目标]"
  turn_budget: 20  # 可选，默认 20

# 命名约定
# objective 格式: "[Change名称] - [子目标描述]"
# 示例: "feature-auth - 实现 JWT 认证核心逻辑"
```

### 3.4 Goal 状态与 Change 状态的联动

| Goal 状态 | Change 状态 | 联动规则 |
|-----------|-------------|---------|
| active | 任意 | 正常工作中 |
| active 且 budget 耗尽 | 任意 | 触发预算耗尽处理流程（见冲突 9） |
| complete | 子级全部完成 | 可推进 Change 归档 |
| complete | 子级未完成 | 继续处理下一个 Goal |
| blocked | 任意 | 上报用户，等待解除 |
| cancelled | 任意 | 检查是否所有 Goal 都 cancelled |

### 3.5 Goal 完成判定标准

**Goal 标记 complete 的充要条件：**

必要条件（全部满足）：
1. 关联的 Todo 列表全部 completed
2. 关联的 Change 子级变更全部完成
3. 无未解决的阻塞点

充分条件（任一满足）：
1. 用户明确表示满意
2. 验收标准全部通过

### 3.6 Goal depends_on 依赖机制

#### 依赖声明规则

```
Goal A:
  objective: "实现 JWT 认证"
  depends_on: []  # 无依赖

Goal B:
  objective: "实现 OAuth 认证"
  depends_on: ["Goal A"]  # 依赖 Goal A

Goal C:
  objective: "实现权限控制"
  depends_on: ["Goal A", "Goal B"]  # 依赖多个 Goal
```

#### 依赖类型

| 依赖类型 | 说明 | 示例 |
|---------|------|------|
| 强依赖 | 被依赖方必须 complete，依赖方才能启动 | Goal B 依赖 Goal A（B 需要 A 的输出） |
| 弱依赖 | 被依赖方完成后，依赖方可以启动，但非必须 | Goal B 参考 Goal A（B 可以独立实现） |

#### 依赖规则

| 规则 | 说明 |
|------|------|
| 传递性 | A→B→C 意味着 A→C（传递依赖） |
| 循环检测 | 禁止循环依赖（A→B→A），创建时检测并拒绝 |
| 失败传播 | 被依赖方 cancelled 时，依赖方自动 blocked |
| 部分完成 | 弱依赖场景下，被依赖方 cancelled 不影响依赖方 |

#### 依赖声明格式

```yaml
# Goal 创建时声明依赖
create_goal:
  objective: "实现 OAuth 认证"
  turn_budget: 20
  depends_on:  # 可选，默认为空
    - goal: "Goal A"
      type: strong  # strong | weak
```

### 3.7 Goal 回退与 rollback_count 的关系

#### 回退前检查

```
Goal 触发回退时（如验证失败需要修复）：
  1. 检查 Change 的 rollback_count
  2. 若 rollback_count >= rollback_limit：
     - 禁止回退
     - 向用户报告："已达回滚上限（rollback_limit），无法继续回退"
     - 提供选项：a) 接受当前状态 b) 创建新 Change 处理
  3. 若 rollback_count < rollback_limit：
     - 允许回退
     - rollback_count + 1
     - 创建修复 Goal
```

#### 回退与 Goal 状态

| 回退类型 | Goal 处理 | rollback_count |
|---------|----------|----------------|
| 阶段回退（build→design） | 当前 Goal 标记 blocked | 不变 |
| 修复回退（verify→build） | 创建修复 Goal，原 Goal 标记 blocked | +1 |
| 范围扩展回退 | 当前 Goal 标记 blocked，创建新 Goal | 不变 |

---

## 四、冲突处理规则

### 4.1 职责边界矩阵

| 职责 | MumuSpec Change | Goal | Todo |
|------|----------------|------|------|
| 代码变更版本化管理 | ✅ 主责 | ❌ | ❌ |
| 阶段门禁控制 | ✅ 主责 | ❌ | ❌ |
| 契约漂移检测 | ✅ 主责 | ❌ | ❌ |
| 会话级目标追踪 | ❌ | ✅ 主责 | ❌ |
| 预算控制 | ❌ | ✅ 主责 | ❌ |
| 步骤级进度追踪 | ❌ | ❌ | ✅ 主责 |
| 测试用例清单锁定 | ✅ design_locked | ❌ | ✅ 辅助 |

### 4.2 数据存储边界

**持久化存储（MumuSpec 管理）：**
- `.mumuspec/changes/<name>/.mumuspec.yaml`
- `.mumuspec/changes/<name>/design.md`
- `.mumuspec/changes/<name>/tasks.md`
- `.mumuspec/contracts/`
- `.mumuspec/knowledge/`

**临时存储（会话级，CatPaw 管理）：**
- Todo 列表（内存/会话上下文）
- Goal 状态（内存/会话上下文）
- 对话历史

**禁止操作：**
- 不得将 Todo/Goal 写入 `.mumuspec/` 目录
- 不得将 Todo/Goal 持久化到磁盘
- 不得让 Todo/Goal 影响 `mumuspec guard` 校验

---

### 4.3 冲突处理规则详表

#### 冲突 1：Goal 完成但 Change 未完成

```
触发条件：
  - Goal 标记为 complete
  - 但关联的 Change 还有其他未完成子级

处理流程：
  1. 标记 Goal 为 complete
  2. 检查 Change 状态
  3. 若 Change 未完成：
     a. 询问用户是否创建新 Goal 继续
     b. 或接受当前进度，后续再处理
  4. 不允许直接归档 Change

多 Goal 并发补充规则：
  5. 多 Goal 并发时，每个 Goal 独立追踪
  6. Goal 之间声明依赖关系（depends_on）
  7. 被依赖的 Goal 失败时，依赖方自动标记为 blocked
  8. Change 归档条件：
     - 全部 Goal complete，或
     - 用户明确接受部分 Goal cancelled/blocked
```

#### 冲突 2：Todo 全部完成但 Goal 目标未达成

```
触发条件：
  - 所有 Todo 标记为 completed
  - 但 Goal 的验收标准未通过

处理流程：
  1. 不标记 Goal 为 complete
  2. 分析原因：
     a. 遗漏步骤？→ 添加新 Todo
     b. 步骤执行不到位？→ 重新执行
     c. 验收标准变更？→ 更新 Goal objective
  3. 记录分析结果到 decisions.md
```

#### 冲突 3：Change 阶段回退

```
触发条件：
  - 用户或系统触发阶段回退（如 build → design）

处理流程：
  1. 当前 Goal 标记为 blocked
  2. 原阶段 Todo 标记为 suspended（非 cancelled）
  3. 向用户报告回退原因和影响
  4. 重新进入该阶段时，提供选项：
     a. 恢复原有 Todo（推荐）
     b. 创建新 Todo
     c. 混合模式（保留未完成的，重新设计已完成的）
  5. 多次回退时，保留所有历史 Todo 版本
```

#### 冲突 4：预设路径升级

```
触发条件：
  - hotfix/tweak 触发升级条件，需要补充 Design

处理流程：
  1. 暂停当前 Todo
  2. 向用户展示升级影响：
     a. 已完成的 Todo 是否需要重新执行
     b. 新增的 Todo 清单
     c. 预估额外 budget
  3. 等待用户显式确认（P0：禁止自动升级）
  4. 用户确认升级后：
     a. 冻结旧 Todo
     b. 创建新 Goal 对应 full workflow
     c. 新 Goal 关联原 Change
  5. 用户取消升级时：
     a. 恢复旧 Todo
     b. 继续原流程
```

#### 冲突 5：Goal Budget 耗尽

```
触发条件：
  - Goal 的 turn_budget 用完
  - 但 Todo 还有未完成项

处理流程：
  1. 自动暂停 Goal（标记为 blocked）
  2. 向用户报告：
     a. 已完成/未完成的 Todo 数量
     b. 建议续期额度（默认 +10 turns）
     c. 建议拆分方案
  3. 用户选项：
     a. 续期（指定额度）→ Goal 恢复 active
     b. 拆分（将未完成 Todo 拆分为新 Goal）→ 原 Goal 标记 complete
     c. 取消（标记为 cancelled）→ 见冲突 6
     d. 暂停（标记为 blocked，稍后继续）
  4. 用户无响应时，默认标记为 blocked（不自动续期）
```

#### 冲突 6：用户主动取消 Goal

```
触发条件：
  - 用户明确表示"这个目标不做了"或"先放一放"

处理流程：
  1. Goal 标记为 cancelled
  2. 关联的 Todo：
     a. 已完成的：保留历史记录
     b. 未完成的：标记为 cancelled
  3. Change 状态：
     a. 若所有 Goal 都 cancelled，询问用户是否 discard Change
     b. 若还有其他 Goal，Change 状态不变
  4. 已取消的 Goal 可以恢复（恢复后 Todo 重新激活）
```

#### 冲突 7：Change 被 Discard

```
触发条件：
  - 用户执行 `mumuspec discard <name>`

处理流程：
  1. 同步取消关联的 Goal（标记为 cancelled）
  2. Todo 列表立即销毁（无归档价值，因为代码变更被放弃）
  3. 若 Goal 关联多个 Change，仅解除与当前 Change 的关联
```

#### 冲突 8：Todo 与 Change tasks.md 不一致

```
触发条件：
  - Todo 状态与 tasks.md 中的任务状态不匹配

处理流程：
  1. Todo 是 tasks.md 的会话级缓存
  2. 两者不一致时，以 tasks.md 为准
  3. 同步策略：
     a. Todo 完成时，自动更新 tasks.md 对应任务状态
     b. tasks.md 变更时，自动更新 Todo 状态
     c. 同步失败时，Todo 标记为 in_progress，阻塞后续步骤
  4. 归档前强制同步，不一致时阻塞归档

同步机制详细说明：
  - 自动同步：Todo 状态变更时，自动写入 tasks.md
  - 手动同步：用户可通过命令手动触发同步
  - 同步失败处理：
     a. 记录失败原因
     b. Todo 标记为 in_progress
     c. 向用户报告同步失败，提供手动修复选项
     d. 修复后重新同步
```

#### 冲突 12：Todo 与 MumuSpec 阻塞点冲突

```
触发条件：
  - Todo 标记为 completed，但对应的阻塞点（BP）未获取用户显式确认

处理流程：
  1. 检查 Todo 是否关联阻塞点（见 2.6 BP 映射表）
  2. 若关联阻塞点：
     a. 验证是否获取用户显式确认（AskQuestion 或文字确认）
     b. 未确认 → Todo 回退为 in_progress，要求用户确认
     c. 已确认 → 同步到 decisions.md，Todo 保持 completed
  3. 阻塞点未完成时，不允许进入下一阶段
```

#### 冲突 13：Goal 回退与 rollback_count 冲突

```
触发条件：
  - Goal 触发回退，但 Change 的 rollback_count 已达 rollback_limit

处理流程：
  1. 回退前检查 rollback_count
  2. 若 rollback_count >= rollback_limit：
     a. 禁止回退
     b. 向用户报告已达回滚上限
     c. 提供选项：接受当前状态 / 创建新 Change 处理
  3. 若 rollback_count < rollback_limit：
     a. 允许回退
     b. rollback_count + 1
     c. 创建修复 Goal
```

#### 冲突 14：Todo 粒度与 build_mode 冲突

```
触发条件：
  - build_mode 变更，但 Todo 粒度与新模式不匹配

处理流程：
  1. 检测 build_mode 变更
  2. 根据 2.7 节规则调整 Todo 粒度：
     a. executing-plans → 按 tasks.md 任务项拆分
     b. subagent-driven-development → 按子代理目标合并
     c. direct → 保持灵活粒度
  3. 粒度调整时保留已完成 Todo 的历史记录
```

#### 冲突 9：验证失败回退

```
触发条件：
  - Verify 阶段发现测试失败
  - 需要回到 Build 修复

处理流程：
  1. Verify 失败时，创建修复 Goal（非复用原 build Goal）
  2. 修复 Goal 的 Todo 仅包含失败项（非完整 build Todo）
  3. 修复完成后，仅重跑受影响的 verify Todo（非全部）
  4. 多次修复时，保留每次修复的 Todo 历史
```

#### 冲突 10：契约变更的外部征询（P0）

```
触发条件：
  - Todo 涉及外部契约变更（API、数据库、协议等）

处理流程：
  1. 外部征询类 Todo 的完成判定：
     a. 必须获取用户显式确认（非默认、非不反对）
     b. 确认方式：AskQuestion 工具 或 用户明确文字确认
  2. 征询结果同步到 decisions.md：
     ```bash
     mumuspec decisions append --phase <phase> --change <name> --text "<决策内容>"
     ```
  3. 未确认的征询 Todo 标记为 in_progress，阻塞后续步骤
  4. 违反此规则视为严重违规（违反 MumuSpec Red Flags）
```

#### 冲突 11：Todo/Goal 与决策审计同步（P0）

```
触发条件：
  - Todo 记录了决策项（如"选择方案 A"）

处理流程：
  1. Todo 中的决策项必须同步到 decisions.md
  2. 同步时机：
     a. 用户确认决策时，立即同步
     b. 或阶段结束时批量同步
  3. 同步格式：
     ```bash
     mumuspec decisions append --phase <phase> --change <name> --text "<决策内容>"
     ```
  4. 未同步的决策项视为未完成
```

---

## 五、集成工作流示例

### 5.1 完整工作流（full workflow）示例

```
用户: /mumuspec 实现用户认证功能

[Step 1: 阶段检测]
Agent: 无活跃变更 → 进入 phase-open

[Step 2: Open 阶段]
Agent: 创建 Todo 列表（open-1 ~ open-5）
Agent: 执行需求澄清...
Agent: 用户确认提案（显式确认）
Agent: 同步决策到 decisions.md
Agent: 标记 Todo 全部 completed

[Step 3: Design 阶段]
Agent: 创建 Todo 列表（design-1 ~ design-8）
Agent: 执行认知框架...
Agent: 用户确认设计（显式确认）
Agent: 同步决策到 decisions.md
Agent: 标记 Todo 全部 completed

[Step 4: Build 阶段 - 需要跨会话]
Agent: 创建 Goal "feature-auth - 实现核心认证逻辑" (budget: 20)
Agent: 创建 Todo 列表（build-1 ~ build-7）
Agent: 执行 TDD...
Agent: 会话中断（budget 耗尽）

[Step 5: 预算耗尽处理]
Agent: 暂停 Goal，向用户报告进度
Agent: 用户选择续期 +10 turns
Agent: Goal 恢复 active，继续执行...

[Step 6: 恢复会话]
Agent: 读取 Goal 状态（active, 剩余 5 turns）
Agent: 读取 Todo 列表（5 completed, 2 pending）
Agent: 继续执行...
Agent: 标记 Todo 全部 completed
Agent: 标记 Goal 为 complete

[Step 7: Verify 阶段]
Agent: 创建 Todo 列表（verify-1 ~ verify-5）
Agent: 执行验证...
Agent: 标记 Todo 全部 completed

[Step 8: Archive 阶段]
Agent: 创建 Todo 列表（archive-1 ~ archive-3）
Agent: 执行归档...
Agent: 用户最终确认（显式确认）
Agent: 同步决策到 decisions.md
Agent: 标记 Todo 全部 completed
Agent: Change 归档
```

### 5.2 预设路径（hotfix）示例

```
用户: /mumuspec 修复登录按钮颜色

[Step 1: 预设检测]
Agent: 匹配 tweak 条件 → 进入 workflow-presets (tweak)

[Step 2: Open 阶段]
Agent: 创建 Todo 列表（简化版，3 项）
Agent: 确认修改范围
Agent: 用户确认（显式确认）

[Step 3: Build 阶段]
Agent: 创建 Todo 列表（简化版，2 项）
Agent: 修改代码
Agent: 无需 Goal（单会话可完成）

[Step 4: Verify 阶段]
Agent: 运行测试
Agent: 用户确认（显式确认）

[Step 5: Archive 阶段]
Agent: 快速归档
```

### 5.3 预设路径升级示例

```
用户: /mumuspec 修复某个 bug（hotfix）

[Step 1: 预设检测]
Agent: 匹配 hotfix 条件 → 进入 workflow-presets (hotfix)

[Step 2: 执行 hotfix...]
Agent: 发现需要修改外部 API 契约 → 触发升级条件

[Step 3: 升级确认]
Agent: 暂停当前 Todo
Agent: 向用户展示升级影响：
  - 已完成：open-1, open-2
  - 需新增：design-1 ~ design-8（完整 Design 阶段）
  - 预估额外 budget: 30 turns
Agent: 用户确认升级（显式确认）

[Step 4: 升级执行]
Agent: 冻结旧 Todo
Agent: 创建新 Goal "bugfix-api - 补充 Design" (budget: 30)
Agent: 进入 phase-design...
```

---

## 六、实施建议

### 6.1 渐进式引入策略

| 阶段 | 引入内容 | 验证周期 |
|------|---------|---------|
| 第 1 周 | 仅在 Build 阶段使用 Todo | 验证进度可见性价值 |
| 第 2 周 | 扩展到 Design 阶段 Todo | 验证设计步骤追踪 |
| 第 3 周 | 引入 Goal（跨会话任务） | 验证目标追踪价值 |
| 第 4 周 | 全面集成 + 规则调优 | 验证整体效果 |

### 6.2 成功指标

| 指标 | 目标值 | 测量方式 |
|------|-------|---------|
| 阶段内步骤遗漏率 | < 5% | 对比引入前后 |
| 跨会话恢复时间 | 减少 50% | 读取 Todo/Goal 即可继续 |
| 用户确认等待时间 | 减少 30% | Todo 明确标记待确认项 |
| 任务超预算率 | < 20% | Goal budget 控制 |
| 外部征询违规率 | 0% | P0：零容忍 |

### 6.3 反模式警示

**❌ 反模式 1：Todo 过细**
- 错误：每个文件读取都创建 Todo
- 正确：Todo 粒度 ≥ 一个有意义的步骤

**❌ 反模式 2：Goal 与 Change 重复**
- 错误：每个 Change 都创建 Goal
- 正确：仅跨会话/需要预算控制时创建

**❌ 反模式 3：Todo 替代 Change 状态**
- 错误：用 Todo 状态判断 Change 是否可归档
- 正确：Change 归档以 guard 校验为准

**❌ 反模式 4：持久化 Todo/Goal**
- 错误：将 Todo 写入 `.mumuspec/`
- 正确：Todo/Goal 仅会话级存在

**❌ 反模式 5：外部征询默认完成（严重）**
- 错误：用户未反对就标记征询完成
- 正确：必须获取用户显式确认

**❌ 反模式 6：决策未同步到 decisions.md**
- 错误：Todo 记录了决策但未同步
- 正确：决策确认后立即同步

---

## 七、总结

### 7.1 核心要点

| 维度 | Todo | Goal |
|------|------|------|
| **定位** | 阶段内步骤追踪 | 会话级目标管理 |
| **粒度** | 具体操作步骤 | 子目标/里程碑 |
| **生命周期** | 阶段内有效 | 跨会话有效 |
| **触发条件** | ≥3 步的任务 | 用户明确请求/跨会话/需预算控制 |
| **与 Change 关系** | 辅助阶段执行 | 分解 Change 子目标 |
| **持久化** | 否 | 否 |
| **引入优先级** | **P0（立即）** | **P1（按需）** |

### 7.2 关键约束（P0）

1. **外部征询类 Todo 必须获取用户显式确认**
2. **决策项必须同步到 decisions.md**
3. **Todo/Goal 不得持久化到磁盘**
4. **Todo/Goal 不得影响 mumuspec guard 校验**
5. **阻塞点（BP）Todo 未完成时，不允许进入下一阶段**
6. **回退前必须检查 rollback_count，达上限时禁止回退**

### 7.3 核心原则

**Todo/Goal 是 MumuSpec 工作流的透明辅助层**——它们增强进度可见性，但不改变 MumuSpec 的阶段门禁、契约管理、归档流程等核心机制。

### 7.4 设计完善记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2026-08-27 | 初始版本，包含总体架构、Todo/Goal 设计、11 个冲突处理规则 |
| 1.1.0 | 2026-08-27 | 完善设计：增加 Todo 与工件关系表、BP 映射表、build_mode 适配规则、Goal depends_on 机制、rollback_count 关系、3 个新冲突规则 |

---

## 附录：冲突规则速查表

| 冲突编号 | 场景 | 触发条件 | 处理方式 | 优先级 |
|---------|------|---------|---------|--------|
| 1 | Goal 完成但 Change 未完成 | Goal complete + Change 有未完成子级 | 询问用户是否创建新 Goal | P3 |
| 2 | Todo 完成但 Goal 未达成 | 全部 Todo completed + Goal 验收失败 | 分析原因，添加/重做 Todo | — |
| 3 | 阶段回退 | 用户或系统触发回退 | Goal blocked，Todo suspended | P3 |
| 4 | 预设路径升级 | hotfix/tweak 触发升级条件 | 展示影响，等待用户确认 | P3 |
| 5 | Budget 耗尽 | turn_budget 用完 + Todo 未完成 | 暂停 Goal，提供续期/拆分/取消选项 | P1 |
| 6 | 用户取消 Goal | 用户明确表示不做了 | Goal cancelled，Todo 标记 cancelled | P1 |
| 7 | Change Discard | `mumuspec discard` | Goal cancelled，Todo 销毁 | P2 |
| 8 | Todo 与 tasks.md 不一致 | 状态不匹配 | 以 tasks.md 为准，自动同步 | P1 |
| 9 | 验证失败回退 | Verify 失败 | 创建修复 Goal，仅包含失败项 | P2 |
| 10 | 外部征询 | 涉及外部契约变更 | **必须显式确认** | **P0** |
| 11 | 决策审计同步 | Todo 记录决策 | **必须同步到 decisions.md** | **P0** |
| 12 | Todo 与阻塞点冲突 | Todo completed 但 BP 未确认 | 回退为 in_progress，要求确认 | P1 |
| 13 | Goal 回退与 rollback_count | 回退时已达回滚上限 | 禁止回退，提供替代方案 | P2 |
| 14 | Todo 粒度与 build_mode | build_mode 变更 | 按规则调整 Todo 粒度 | P3 |
