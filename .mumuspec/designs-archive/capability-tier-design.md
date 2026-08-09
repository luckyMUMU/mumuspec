# 通用基础能力与专用工具分层设计规范

> 创建日期: 2026-08-09
> 状态: Draft
> 作者: MumuSpec Design

---

## 1. 定位声明

### 1.1 本文讨论范围

本文讨论 **MumuSpec 操作能力的分层模型** —— 根据操作的风险等级和业务规则强度，将系统能力划分为"通用基础能力"和"专用工具"两个层级，并为每个层级定义相应的约束强度、用户确认要求和组合自由度。

### 1.2 设计动机

当前 MumuSpec 的所有操作在约束层面是"平铺"的：
- 一些低风险操作（如 `spec parse`、`knowledge search`）和高风险操作（如 `archive`、`contract change`）使用相同的确认流程
- 用户无法直观判断某个操作是否可以自由组合/探索，另一个操作是否需要格外小心
- AI agent 在自主执行时缺乏"这可以自由做" vs "这需要你做判断"的边界信号

**设计目标**：建立明确的能力分层，让通用能力可以灵活组合和探索，让专用工具严格约束高风险操作。

### 1.3 与现有原则的关系

本设计规范是对以下已有原则的**细化和延伸**：
- **双向约束**（SHALL/SHALL NOT）→ 本规范为不同能力定义不同强度的约束
- **Ponytail** → 通用能力遵循"能简单就简单"，专用工具遵循"必须严谨"
- **渐进式披露** → 能力按风险等级渐进式暴露给 agent
- **动态强度** → 不同能力绑定不同的默认强度

---

## 2. 能力分层模型

### 2.1 双轨定义

```
┌─────────────────────────────────────────────────────────────────┐
│                    MumuSpec 能力分层                              │
├──────────────────────────┬──────────────────────────────────────┤
│     通用基础能力          │           专用工具                    │
│   (General Capabilities) │        (Dedicated Tools)             │
├──────────────────────────┼──────────────────────────────────────┤
│ • 灵活组合               │ • 严格约束                            │
│ • 支持探索               │ • 守门操作                            │
│ • 最小用户确认           │ • 强制用户确认                         │
│ • 可逆/幂等              │ • 不可逆/影响广泛                      │
│ • 低风险                 │ • 高风险或强业务规则                    │
└──────────────────────────┴──────────────────────────────────────┘
```

### 2.2 判定标准

| 维度 | 通用基础能力 | 专用工具 |
|------|-------------|----------|
| **可逆性** | 可逆或幂等 | 不可逆或回滚成本高 |
| **影响范围** | 仅影响当前上下文 | 影响项目全局或多个模块 |
| **业务规则** | 无强业务规则 | 受业务规则或契约强约束 |
| **用户确认** | 可选确认（默认跳过） | 强制确认（显式 y/N） |
| **组合自由度** | 高（可自由编排） | 低（预设流程，不可跳转） |
| **探索支持** | 支持 dry-run + 预览 | 必须实际执行才生效 |
| **错误容忍** | 可重试、无副作用 | 错误需人工介入 |

### 2.3 能力映射表

#### Tier 1: 通用基础能力

| 能力 | 命令 | 风险等级 | 确认要求 | 可组合性 |
|------|------|----------|----------|----------|
| 规范上下文获取 | `mumuspec context` | 无 | 无 | 高（可链式调用） |
| 规范校验 | `mumuspec validate` | 低 | 无 | 高 |
| 知识检索 | `mumuspec knowledge search` | 无 | 无 | 高 |
| 代码图谱查询 | `mumuspec search/trace` | 无 | 无 | 高 |
| 漂移检测（只读） | `mumuspec drift --check` | 低 | 无 | 高 |
| 状态查看 | `mumuspec status` | 无 | 无 | 高 |
| 变更列表 | `mumuspec list` | 无 | 无 | 高 |
| 环境诊断 | `mumuspec doctor` | 低 | 无 | 高 |
| 项目审查 | `mumuspec review` | 低 | 无 | 高 |
| 规范同步（只读） | `mumuspec sync --check` | 低 | 无 | 高 |

#### Tier 2: 专用工具

| 能力 | 命令 | 风险等级 | 确认要求 | 业务规则 |
|------|------|----------|----------|----------|
| 项目初始化 | `mumuspec init` | 中 | 强制 | 覆盖现有文件需确认 |
| 创建变更 | `mumuspec new` | 中 | 强制 | 单活跃变更约束 |
| 阶段转换 | `mumuspec guard` | 高 | 强制 | Phase guard 全量校验 |
| 归档变更 | `mumuspec archive` | 高 | 强制 + 二次确认 | 不可逆、delta-merge、知识提取 |
| 丢弃变更 | `mumuspec discard` | 高 | 强制 + 二次确认 | 数据不可恢复 |
| 契约变更 | modify `contracts/` | 高 | 征询 + 逐一确认 | 外部契约四步流程 |
| 规范同步（写入） | `mumuspec sync` | 中 | 强制 | 文件写入、索引更新 |
| 知识导入 | `knowledge import` | 中 | 强制 + dry-run | 来源标记 + 人工审核 |
| 知识导出 | `knowledge export` | 中 | 强制 | 跨 agent 格式校验 |
| 配置修改 | edit `config.yaml` | 高 | 强制 | 强度矩阵影响全局 |

### 2.4 能力流转关系

```
┌──────────────────────────────────────────────────────────────────────┐
│                         用户意图                                      │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
                ┌────────────────────────────────┐
                │    能力路由器 (Capability Router) │
                │    根据操作类型确定能力层级       │
                └────────────────┬───────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                      │
              ▼                                      ▼
   ┌─────────────────────┐              ┌─────────────────────────┐
   │  通用基础能力        │              │     专用工具              │
   │  ─────────────      │              │  ─────────────           │
   │  • 直接执行         │              │  • 前置校验              │
   │  • 结果预览         │              │  • 确认提示              │
   │  • 可自由组合       │              │  • 按预设流程执行         │
   │  • 失败可重试       │              │  • 完成后验证            │
   └─────────────────────┘              │  • 结果不可撤销          │
                                         └─────────────────────────┘
```

---

## 3. 约束强度矩阵

### 3.1 分层与强度的映射

| 能力层级 | 默认强度 | 约束执行方式 | AI 自主度 |
|----------|----------|--------------|----------|
| 通用基础能力 | `info` / `warn` | 提示为主，不阻断 | 高（可自主编排） |
| 专用工具 | `block` | 强制门禁，未通过则拒绝 | 低（每步需确认） |

### 3.2 约束强度定义

```
┌─────────────────────────────────────────────────────────────┐
│                    约束强度光谱                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  通用能力 ◄──────────────────────────────► 专用工具          │
│                                                             │
│  info ──── warn ──── medium* ──── high* ──── block          │
│                                                             │
│  * medium/high 仅在用户显式配置时启用                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 具体约束规则

#### Tier 1: 通用基础能力的约束

| 规则 | 强度 | 说明 |
|------|------|------|
| 输入校验（路径有效、文件存在） | `warn` | 无效输入仅警告，不阻断 |
| 输出格式校验 | `info` | 格式问题记录，不影响执行 |
| 外部服务不可用 | `warn` | 降级为本地模式，告知用户 |
| 结果为空 | `info` | 提示"无结果"，不视为错误 |
| 性能超时 | `warn` | 耗时过长则提示，不强制终止 |

#### Tier 2: 专用工具的约束

| 规则 | 强度 | 说明 |
|------|------|------|
|前置 must-pass 校验 | `block` | 未通过则拒绝执行 |
| 状态一致性校验 | `block` | 状态机冲突时强制修复 |
| 用户显式确认 | `block` | 无确认则不执行不可逆操作 |
| 契约完整性检查 | `block` | 契约变更后不完整则拒绝 |
| 回滚可行性校验 | `block` | 无法保证回滚时警告 + 要求二次确认 |

---

## 4. 专用工具的守门机制

### 4.1 守门模型

```
┌─────────────────────────────────────────────────────────────────┐
│                     专用工具守门模型                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户请求 ──► 前置校验 ──┬─ PASS ──► 确认提示 ──┬─ YES ──► 执行  │
│                         │                      │               │
│                         │                      └─ NO ──► 中止   │
│                         │                                      │
│                         └─ FAIL ──► 阻断 + 修复建议             │
│                                                                 │
│  执行 ──► 后置验证 ──┬─ PASS ──► 完成 + 报告                    │
│                     │                                          │
│                     └─ FAIL ──► 回滚 + 告警                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 专用工具的标准流程

每个专用工具 SHALL 遵循以下标准化流程：

| 阶段 | 名称 | 要求 | 用户交互 |
|------|------|------|----------|
| 1 | **前置校验** | 检查所有 must-pass 条件 | 仅 FAIL 时展示问题 |
| 2 | **影响预览** | dry-run + diff 预览 | 强制展示变更内容 |
| 3 | **显式确认** | 要求用户明确确认 | 等待 y/N/e |
| 4 | **执行** | 按预设流程逐步执行 | 实时进度反馈 |
| 5 | **后置验证** | 验证执行结果符合预期 | FAIL 则回滚 |
| 6 | **报告** | 输出变更摘要 + 后续步骤 | 展示结果 |

### 4.3 特殊守门：不可逆操作

以下操作被标记为**不可逆**，需要**二次确认**：

| 操作 | 不可逆原因 | 二次确认要求 |
|------|-----------|-------------|
| `mumuspec archive` | 变更归档后状态不再活跃 | 要求输入变更名称确认 |
| `mumuspec discard` | 变更工件永久删除 | 要求输入变更名称确认 |
| `knowledge import --merge overwrite` | 覆盖已有知识条目 | 显示被覆盖条目的 diff |
| 删除 `contracts/` 下的文件 | 外部契约断裂 | 影响分析 + 逐一确认 |
| `--force` 覆盖现有文件 | 原始内容不可恢复 | 显示将被覆盖的文件列表 |

---

## 5. 通用基础能力的组合协议

### 5.1 组合原则

通用基础能力 SHALL 支持以下组合模式：

| 组合模式 | 说明 | 示例 |
|----------|------|------|
| **链式调用** | 前一个能力的输出作为下一个的输入 | `context → search → validate` |
| **并行探索** | 多个能力同时执行，结果聚合 | 同时查询 decisions + patterns |
| **迭代深化** | 按需加深查询粒度 | 先看摘要 → 按需展开细节 |
| **回退重试** | 失败后降级重试 | 语义搜索失败 → 全文搜索 → 精确匹配 |

### 5.2 组合约束

虽然通用能力支持自由组合，但 SHALL 遵守以下底线：

1. **无副作用保证**：通用能力组合不得产生副作用（不写入、不修改状态）
2. **只读输出**：组合结果仅用于信息展示，不作为后续专用工具的自动输入
3. **用户确认边界**：从通用能力切换到专用工具时，必须经过用户确认
4. **可中断**：组合执行过程中的任何一步都可以被用户中断

---

## 6. 能力声明与自描述

### 6.1 命令元数据

每个命令 SHALL 在代码中声明自己的能力层级：

```typescript
// 示例：命令元数据接口
interface CommandMetadata {
  name: string;
  tier: 'general' | 'dedicated';
  risk: 'none' | 'low' | 'medium' | 'high';
  confirmRequired: boolean;
  reversible: boolean;
  scope: 'context-local' | 'project-local' | 'global';
  composable: boolean;     // 是否可作为通用能力被组合
  dryRunSupport: boolean;  // 是否支持 --dry-run
}
```

### 6.2 声明示例

```typescript
// 通用基础能力示例
const contextCommand: CommandMetadata = {
  name: 'context',
  tier: 'general',
  risk: 'none',
  confirmRequired: false,
  reversible: true,
  scope: 'context-local',
  composable: true,
  dryRunSupport: true,
};

// 专用工具示例
const archiveCommand: CommandMetadata = {
  name: 'archive',
  tier: 'dedicated',
  risk: 'high',
  confirmRequired: true,
  reversible: false,
  scope: 'project-local',
  composable: false,
  dryRunSupport: true,
};
```

### 6.3 自描述 API

MumuSpec SHALL 提供 `mumuspec capability <command>` 命令查询任意命令的能力属性：

```bash
$ mumuspec capability archive
Command: archive
Tier: dedicated
Risk: high
Confirmation required: YES
Reversible: NO
Scope: project-local
Composable: NO
Dry-run support: YES

$ mumuspec capability context
Command: context
Tier: general
Risk: none
Confirmation required: NO
Reversible: YES
Scope: context-local
Composable: YES
Dry-run support: YES
```

---

## 7. 实施规则（SHALL / SHALL NOT）

### 7.1 SHALL 规则

| ID | 规则 | 理由 |
|----|------|------|
| CAP-1 | 每个命令必须声明自己的 `tier`（`general` 或 `dedicated`） | 能力分层的基础 |
| CAP-2 | 专用工具必须实现前置校验 → 确认 → 执行 → 后置验证的标准流程 | 守门机制保障 |
| 3 | 通用能力必须支持 `--dry-run` 模式 | 探索性操作的前提 |
| CAP-4 | 不可逆操作必须要求二次确认（输入变更名称/key） | 防止误操作 |
| CAP-5 | 能力切换时（general → dedicated）必须经过用户确认 | 防止意外进入高风险操作 |
| CAP-6 | 专用工具的确认提示必须展示影响范围预览 | 用户充分知情 |
| CAP-7 | 通用能力的组合结果不得自动作为专用工具的输入 | 保持用户控制权 |
| CAP-8 | dry-run 输出必须与实际执行输出格式一致 | 预览可信 |
| CAP-9 | 所有能力必须自描述（`mumuspec capability`） | 可发现性 |
| CAP-10 | 能力层级变更（general ↔ dedicated）必须走契约变更流程 | 分层是契约 |

### 7.2 SHALL NOT 规则

| ID | 规则 | 理由 |
|----|------|------|
| CAP-N1 | SHALL NOT 将通用能力标记为专用工具以提高"重要性" | 分层基于风险，非地位 |
| CAP-N2 | SHALL NOT 在执行通用能力时要求用户显式确认（除非用户配置） | 保持灵活性 |
| CAP-N3 | SHALL NOT 跳过专用工具的前置校验（即使"看起来没问题"） | 守门不可绕过 |
| CAP-N4 | SHALL NOT 在用户未确认时执行不可逆操作 | 安全底线 |
| CAP-N5 | SHALL NOT 通用能力组合产生副作用 | 保持纯函数特性 |
| CAP-N6 | SHALL NOT 专用工具的能力降级为 general（除非风险变化经过评估） | 防止规避约束 |

---

## 8. 与现有约束系统的集成

### 8.1 与 Ponytail 的关系

| Ponytail 规则 | 通用能力的体现 | 专用工具的体现 |
|---------------|---------------|---------------|
| YAGNI（不需要则不写） | 按需加载能力 | 仅在必要时引入守门逻辑 |
| 复用已有能力 | 通用能力作为构建块 | 专用工具复用通用能力的校验逻辑 |
| 最小实现 | 通用能力保持简洁 | 专用工具仅实现必要的守门 |

### 8.2 与动态强度的关系

能力分层可以与动态强度预设（strict/balanced/hotfix）叠加：

| 预设 | 通用能力强度 | 专用工具强度 |
|------|-------------|-------------|
| `strict` | `warn` | `block` |
| `balanced` | `info` | `block` |
| `hotfix` | `info` | `warn`（仍要求确认，但前置校验降级） |

### 8.3 与契约层的关系

- 能力分层本身是**内部契约**（MumuSpec 自身的设计规则）
- 能力层级的变更（提升/降低）属于**外部契约变更**，需走四步征询流程
- 每个能力的 SHALL/SHALL NOT 对应 Enforcement 条目

---

## 9. 实施路线

### Phase 1 — 能力声明与元数据（1 周）

| 任务 | 产出 |
|------|------|
| 定义 CommandMetadata 接口 | 新的 core 类型 |
| 为所有现有命令添加 tier 声明 | 代码变更 |
| 实现 `mumuspec capability` 命令 | 新 CLI 命令 |

### Phase 2 — 专用工具守门机制（2 周）

| 任务 | 产出 |
|------|------|
| 实现标准守门流程框架 | core/guarded-tool.ts |
| 为 archive/discard 添加二次确认 | 安全增强 |
> 为 new/init 添加前置校验 | 守门覆盖 |
| 实现不可逆操作的统一处理 | 模式复用 |

### Phase 3 — 能力组合协议（1 周）

| 任务 | 产出 |
|------|------|
| 实现通用能力的 pipe/compose 模式 | core/composable.ts |
| 为 context/search/validate 添加链式调用支持 | 增强 CLI |
| 实现 dry-run 输出格式统一 | 一致性保障 |

### Phase 4 — 文档与规范固化（3 天）

| 任务 | 产出 |
|------|------|
| 合并本规范到 spec.md | delta-spec |
| 更新 BOUNDARY.md | 边界文档 |
| 编写能力分层用户文档 | docs/ |

---

## 10. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解 |
|------|--------|------|------|
| 能力分类争议 | 中 | 某些命令层级不清晰 | 提供 `capability override` 配置项 |
| 守门过严导致效率下降 | 中 | hotfix 场景受阻 | `hotfix` 预设降级守门强度 |
| 元数据与实际行为不一致 | 低 | 误导用户/Agent | CI 校验元数据与实现一致性 |
| 组合爆炸 | 低 | 通用能力组合产生意外副作用 | 严格无副作用约束 + 测试 |
| 与现有工作流冲突 | 低 | 习惯用户不适应 | 向后兼容，分层渐进式启用 |

---

## 11. 示例场景

### 11.1 场景 A：探索性任务（通用能力组合）

```bash
# 用户想了解项目的约束情况
$ mumuspec context src/core/
$ mumuspec search "ponytail"
$ mumuspec validate --scope src/core/
$ mumuspec review --module src/core/

# 全部通用能力，无需确认，可自由组合
# 结果用于理解项目现状，不产生副作用
```

### 11.2 场景 B：守门操作（专用工具）

```bash
# 用户想归档一个变更
$ mumuspec archive my-feature

# 输出：
[Pre-check] 前置校验中...
  - Phase guard: PASS
  - Delta-specs merge: PASS
  - No blocking drift: PASS
  - Tests pass: PASS

[Impact Preview] 影响预览：
  - 变更状态: active → archived
  - delta-tech 将合并到 src/core/tech.md
  - 知识提取将产生 3 条新知识条目
  - 活跃变更槽将释放

确认归档 my-feature？(输入变更名称确认)
> my-feature

[Executing] 归档中...
  - ✓ Delta merge completed
  - ✓ Knowledge extracted (3 entries)
  - ✓ Index rebuilt
  - ✓ Worktree cleaned

[Post-verify] 后置验证:
  - ✓ tech.md updated
  - ✓ No orphaned files
  - ✓ Active change slot released

归档完成。变更 my-feature 已归档。
```

### 11.3 场景 C：混合流程（能力切换）

```bash
# 先用通用能力探索
$ mumuspec context .
$ mumuspec drift --check

# 发现漂移，决定修复（切换到专用工具）
$ mumuspec sync

# 输出：
[Capability Switch] 即将从通用能力（context/drift）切换到专用工具（sync）
专用工具 sync 将：
  - 写入 BOUNDARY.md
  - 更新 index.yaml
  - 修改 contracts/ 文件

确认执行 sync？[y/N/d(dry-run)]
> d

[dry-run] 预览变更：
  + 更新 src/core/BOUNDARY.md (3 个章节变更)
  + 更新 .mumuspec/index.yaml (5 个模块变更)
  ~ 保留 contracts/ 内容 (无变更)

确认执行 sync？[y/N]
> y

[Executing] 同步中...
  - ✓ BOUNDARY.md updated
  - ✓ index.yaml updated

[Post-verify] 验证通过。
同步完成，共变更 2 个文件。
```

---

## 12. 开放问题

1. **能力层级边界**：某些操作（如 `sync --check` vs `sync`）具有双重属性 —— 是否按子命令区分层级？
2. **Agent 自主度**：AI agent 在执行通用能力组合时是否需要"预算"限制（如最多 N 步自动执行）？
3. **层级动态调整**：是否允许用户在配置中覆盖某个命令的层级声明？
4. **能力依赖图**：专用工具可能依赖通用能力的输出 —— 如何形式化这种依赖关系？

---

## 13. 参考

- OWASP Risk Assessment Framework —— 风险分级方法论
- Unix Philosophy —— 组合性原则
- Hierarchical Task Network (HTN) —— 任务分层
- CLIR (Command-Line Interface Research) —— 守门与确认模式
