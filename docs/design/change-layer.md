# Change Layer — 变更驱动的规范生命周期

> 层级: Level 1 设计文档 | 所属层: Change Layer

---

## 1. 变更生命周期

借鉴 OpenSpec + Comet 的工件流水线，增加双向约束、代码图谱集成，并遵循四大工作流规则：

```mermaid
graph LR
    Open["Open<br/>提案+规范<br/>影响分析"]
    Design["Design<br/>技术设计<br/>双向约束<br/>自顶向下"]
    Build["Build<br/>实现+图谱绑定<br/>自下向上+TDD"]
    Verify["Verify<br/>规范校验<br/>漂移检测"]
    Archive["Archive<br/>git提交+合并<br/>归档历史"]

    Open -->|open-complete| Design
    Design -->|design-complete| Build
    Build -->|build-complete| Verify
    Verify -->|verify-pass| Archive

    Build -.->|rollback| Design
    Verify -.->|rollback to design| Design
    Verify -.->|rollback to build| Build
    Archive -.->|ci-fail rollback| Build
```

**状态机特性**：
- 正向流转：Open → Design → Build → Verify → Archive
- 回退路径：Build/Verify 可回退到 Design（计入 `rollback_count`，上限 3）；Verify 可回退到 Build（计入 `rebuild_count`，上限 5）
- 旁路操作：Discard（任意非终态阶段可废弃）、accept-deviations（接受偏差归档）
- 单一活跃变更约束：同时只允许一个活跃变更

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

## 2. Phase 1: Open（提案）

**输入**: 用户描述需求
**输出**: proposal.md + delta-specs/ + 影响分析 + worktree + .mumuspec.yaml

**关键步骤**：
1. 单一活跃变更检查（硬性前置条件）
2. 需求探索与澄清（brainstorming，不可跳过，hotfix/tweak 除外）
3. 通过代码图谱进行影响分析（trace_path + detect_changes）
4. 确定 affected_scopes（受影响规范层级）
5. 加载 affected_scopes 的历史知识（从 Knowledge Layer PageIndex）
6. 创建 proposal.md + delta-specs（ADDED/MODIFIED/REMOVED 语义标记）
7. 创建 worktree 隔离工作区
8. 追加 decisions.md Open 章节
9. 用户确认（阻塞点）

## 3. Phase 2: Design（技术设计 — 自顶向下）

**输入**: proposal.md + delta-specs/ + 影响分析
**输出**: design.md + cognitive-map.yaml + test-cases/（已锁定）+ build_layers

**设计原则**: 自顶向下（Level 0 → Level N 逐层细化），测试用例作为设计的一部分在各层同步定义。

### 3.1 认知框架启动（步骤 0）

Design 阶段首先启动基于乔哈里窗变体的认知框架，系统化地梳理已知信息和未知盲区，为后续设计提供完备的信息地基。详见 [参考：认知框架](../reference/cognitive-framework.md)。

**四阶段递进流程**：

| 阶段 | 名称 | 核心动作 | 产出 |
|------|------|---------|------|
| Stage 1 | 信息采集 | 读取 proposal/spec/impact-analysis/contracts → Q1 锚定声明 | Q1 已知的已知 |
| Stage 2 | 探索激活 | 从 Q1 识别缺口 → 生成 Q2 提问（含选项）→ 用户回答 → 迁移到 Q1 | Q1 更新 + Q2 清空 |
| Stage 3 | 盲区扫描 | 基于 Q1 推导 Q3 隐性需求（推理链，每轮 ≤ 3 条）+ Q4 八维度盲区扫描 | Q3 确认约束 + Q4 兜底策略 |
| Stage 4 | 设计生成 | 基于完整 Q1 生成 design.md 草案 + Q4 兜底写入风险章节 | design.md 草案 + cognitive-map.yaml |

**关键约束**：
- Q2 提问必须附带选项（2-4 个），不可是开放性问题
- Q3 推理链只能引用 Q1 条目，每轮最多 3 条
- Q4 盲区扫描不可跳过（至少扫描 3 个维度）
- Stage 2+3 合计不超过 5 轮，达到上限后强制收敛
- 认知地图（cognitive-map.yaml）每轮更新

### 3.2 自顶向下逐层设计（步骤 1）

基于认知框架的 Q1 锚定声明和 Q3 确认约束，进行自顶向下逐层设计：

1. 自顶向下逐层设计（Level 0 根层 → Level 1 模块层 → Level 2 组件层 → Level 3+ 叶子层）
   - 每层定义 SHALL/SHALL NOT 和测试用例
   - Q3 confirmed 的约束自动转化为对应层的 SHALL/SHALL NOT
2. 对抗式设计审查（hyperplan，仅复杂变更触发）
   - 触发条件：`affected_scopes >= 3` OR 新增 SHALL NOT OR `workflow == "full"`
   - 5 个敌对 critic 交叉攻击设计方案
   - 产出 4 类幸存洞察持久化到 `hyperplan_result`
   - **反馈循环**：hyperplan 产出后，若存在 unresolved risks 或 open_questions：
     - hyperplan `risks` → 触发认知框架增量轮次，作为新 Q4 扫描维度
     - hyperplan `open_questions` → 转化为新 Q2 问题，进入认知框架 Stage 2 增量轮
     - 更新 `cognitive-map.yaml` 后继续 Step 3
   - 详见 [参考：Skill 生态](../reference/skill-ecosystem.md#hyperplan)
3. 编写测试用例规格（test-cases/，按 layer 组织）
   - Q4 兜底策略中的测试兜底项须有对应测试用例
4. 代码图谱验证（确认不破坏现有调用链）
5. 生成实现层级计划（build_layers，从深到浅排序）
6. **锁定测试用例**（计算 hash，设置 `design_locked=true`）
7. 追加 decisions.md Design 章节（含认知框架决策记录）
8. 用户确认（阻塞点）

> **认知框架守卫**：`design_to_build` 守卫检查 cognitive-map.yaml 存在性、Q1 非空、Q2/Q3 无待处理项、Q4 扫描完成、认知地图已收敛。详见 [参考：认知框架](../reference/cognitive-framework.md#55-phase-guard-衔接)。
>
> **TDD 不可变性**：Design 完成后，test-cases/ 锁定不可变更。需修改必须回退到 Design。

## 4. Phase 3: Build（实现 — 自下向上 + 红绿 TDD）

**输入**: design.md + test-cases/（已锁定）+ build_layers
**输出**: 代码提交 + 图谱更新 + .mumuspec.yaml 状态更新

**实现原则**: 自下向上（Layer N → Layer 0）+ 红绿 TDD（Red→Green→Refactor）

**每层实现流程**：
```
a. 加载该层规范 + test-cases/layer-N/cases.md
b. RED: 依据 cases.md 编写测试套件 → 验证测试失败
c. 锁定该层测试套件（计算 hash，写入 suite-map.yaml）
d. GREEN: 编写实现代码使所有测试通过
e. REFACTOR: 重构优化（不改测试）
f. 运行该层 Enforcement 检查
g. 标记 build_layers[layer=N].status = done
h. 提交代码（worktree 内 git commit）
```

**回退处理**（Build → Design）：
- 触发条件：规范与实现存在根本性矛盾
- 保存快照 → rollback_count + 1 → build_layers 重置为 pending → test_cases 解锁
- 修改设计后需重新通过 `design_to_build` guard

## 5. Phase 4: Verify（验证 — 自下向上逐层验证）

**输入**: 完成的代码 + 规范 + 图谱 + build_layers（全部 status=done）
**输出**: verify.md（验证报告）

**验证维度**（每层执行）：
1. **完整性**：tasks.md 任务完成，delta-specs requirement 已实现
2. **规范一致性**：SHALL 检查 + SHALL NOT 检查 + Enforcement
3. **代码图谱完整性**：调用链完整，无意外破坏性变更
4. **漂移检测**：规范与代码一致，图谱与实际代码一致
5. **测试不可变性**：test-cases hash + 套件 hash 一致

**回退处理**：
- 情况 A — 回退到 Design（设计层面问题）：rollback_count + 1
- 情况 B — 回退到 Build（实现层面问题）：rebuild_count + 1（不增加 rollback_count）

> hotfix/tweak 走 light verify：仅 SHALL NOT + 图谱完整性 + 测试不可变性。

## 6. Phase 5: Archive（归档 — Git 提交 + 合并请求）

**输入**: verify_result: pass
**输出**: 合并到主分支的代码 + 合并后的主规范 + 归档记录

**三个子流程**（严格 A → B → C 顺序）：

### A. Git 合并流程
1. 最终提交（worktree 中）
2. 推送到远程
3. 创建合并请求（MR/PR）
4. CI 检查（全量 SHALL/SHALL NOT + 漂移检测 + 图谱完整性）
   - CRITICAL 失败 → 回退到 Build
   - 非 CRITICAL → 用户决定 accept-deviations
5. 合并 MR（用户确认 — 阻塞点，选择 squash/merge/rebase）

### B. 规范归档（原子操作 B0-B5）
- B0: 备份受影响规范文件
- B1: delta-specs 合并到主 spec.md（ADDED/MODIFIED/REMOVED/RENAMED 语义）
- B2: 更新 prohibitions.md 汇总
- B3: 更新 index.yaml
- B4: 更新代码图谱快照
- B5: 提交规范变更到主分支（与 B4 同一 commit）

### C. 清理与收尾
- 移动变更到 archive/ 目录
- 清理 worktree
- 释放活跃变更槽位
- 追加 decisions.md Archive 章节

### D. 知识提取（0.9.0 新增）
变更归档时从变更工件中提取持久性设计知识到全局知识库（`.mumuspec/knowledge/`）：
- D1: 从 cognitive-map.yaml 提取 Q1 持久性条目 → `type: rationale` 知识页面
- D2: 从 cognitive-map.yaml 提取 Q3 confirmed 推理 → `type: rationale` 知识页面
- D3: 从 cognitive-map.yaml 提取 Q4 残留风险 → `type: risk` 知识页面
- D4: 从 hyperplan_result 提取幸存洞察 → `type: decision` / `type: risk` 知识页面
- D5: 从 decisions.md 提取关键决策 → `type: decision` 知识页面
- D6: 确认 graph_bindings（知识页面 ↔ 代码图谱节点关联）
- D7: 更新 PageIndex（_index.yaml + _reverse-index.yaml）
- D8: 检查知识冲突（新知识是否 supersede 已有知识）

> 详见 [知识层设计](knowledge-layer.md#54-archive-阶段知识提取核心)。

## 7. Discard 流程

独立于五阶段主流程的旁路操作，允许在任意非终态阶段废弃变更：
1. 用户确认废弃（阻塞点 — AI 不能自动发起）
2. 保存快照 → 清理 worktree → 移动到 archive/discarded/ → 释放槽位
3. 状态机转换：phase → discarded（终态，不可回退）

## 8. 预设路径

| 预设 | 触发条件 | 流程 | 关键约束 |
|------|---------|------|---------|
| **hotfix** | Bug 修复 | open → build → verify → archive | 跳过 Design，但 Open 阶段必须定义并锁定单层 test-cases/；Build 执行红绿 TDD |
| **tweak** | 配置/文案/文档 | open → lightweight build → light verify → archive | 跳过 Design 和完整 Verify，仍须定义 test-cases/ + 红绿 TDD |
| **full** | 新功能/架构变更 | 完整五阶段 | 完整双向约束 + 图谱验证 + 多层 test-cases/ + hyperplan |

> **TDD 不可豁免**：即使 hotfix/tweak 跳过 Design，红绿 TDD 循环和测试不可变性约束仍然强制适用。

**升级条件**（不可降级）：
- hotfix 涉及 3+ 文件 → 升级到 full
- tweak 涉及 5+ 文件或跨模块 → 升级到 full
- 涉及新增 SHALL NOT → 升级到 full

## 9. 错误恢复决策树

### 9.1 rollback_count 超限

```
rollback_count >= rollback_limit (默认 3)
├── 用户选择 accept-deviations
│   ├── verify_result == pass-with-deviations → 走 verify_to_archive_with_deviations
│   └── verify_result != pass → 阻断，提示需先完成 Verify
├── 用户选择 Discard
│   └── 走 discard_change（保存快照，归档到 discarded/）
└── 用户选择手动提升上限
    ├── 记录原因到 decisions.md
    ├── mumuspec config set changes.rollback_limit <N>
    └── 继续回退（不推荐，需 Tech Lead 审批）
```

**CLI 引导输出**:
```
[E-CHANGE-002] 回退次数已达上限 (3/3)

当前变更 "add-user-auth" 已用尽回退次数。请选择：

  [1] 接受偏差归档（推荐）
      → 当前实现通过 SHALL NOT + 测试不可变性检查即可归档
      → 命令: mumuspec change accept-deviations --change add-user-auth

  [2] 废弃变更
      → 保存快照后归档到 discarded/，释放活跃变更槽位
      → 命令: mumuspec change discard --change add-user-auth

  [3] 手动提升上限（需审批）
      → 记录原因到 decisions.md，由 Tech Lead 确认
      → 命令: mumuspec config set changes.rollback_limit 5

详细说明: docs/reference/error-codes.md#E-CHANGE-002
```

### 9.2 rebuild_count 超限

```
rebuild_count >= rebuild_limit (默认 5)
└── 强制升级为 verify_to_design_rollback
    ├── rollback_count + 1
    ├── 若 rollback_count 也超限 → 进入 9.1 决策树
    └── 提示: "实现层面多次修复失败，建议回退到设计阶段重新评估"
```

### 9.3 CI CRITICAL 失败

```
Archive 阶段 CI CRITICAL 失败
├── 自动回退到 Build (archive_ci_fail_rollback)
│   ├── rollback_count + 1
│   └── 若 rollback_count 超限 → 进入 9.1 决策树
└── 用户选择 Discard
    └── 走 discard_change
```

### 9.4 test-cases 锁定后需修改

```
test-cases/ 已锁定 (design_locked == true)
├── 实现中发现测试用例遗漏场景
│   ├── 回退到 Design (build_to_design_rollback)
│   │   ├── rollback_count + 1
│   │   ├── test-cases/ 解锁
│   │   └── 修改后重新锁定
│   └── 若 rollback_count 超限 → 进入 9.1 决策树
└── hyperplan 洞察遗漏
    ├── 回退到 Design
    ├── 重新触发 hyperplan
    └── 新洞察合并后重新设计 test-cases/
```

### 9.5 worktree 创建失败

```
worktree 创建失败
├── 原因: 磁盘空间不足 / 权限问题 / git 异常
├── 降级为 branch 模式
│   ├── 记录降级原因到 decisions.md (Open 阶段)
│   ├── config: changes.default_isolation = branch
│   └── 继续变更流程
└── 若用户拒绝降级
    └── 阻断变更创建，提示修复 worktree 环境
```

### 9.6 hyperplan 执行失败

```
hyperplan 执行中失败
├── subagent 创建失败
│   ├── 重试 1 次
│   ├── 仍失败 → 降级为 4 角色（移除 researcher）
│   └── 4 角色也失败 → 跳过 hyperplan，记录到 decisions.md
├── 单角色执行超时
│   ├── 跳过该角色的 Round 2/3
│   ├── Lead 用已有 Round 1 发现蒸馏
│   └── 标注 hyperplan_result.degraded = true
└── 用户门禁无响应
    ├── 等待用户决策（不超时）
    └── 用户可选择跳过开放问题（记录到 decisions.md，标记为已知风险）
```

### 9.7 Discard 后恢复

```
变更已 Discard
├── 从 snapshots/discard/ 恢复工件
│   ├── mumuspec change restore --from-snapshot <change>
│   └── 创建新变更（不复活旧变更，复用工件）
└── 工件已用于参考
    └── snapshots/discard/ 保留 30 天后清理
```

## 10. 变更工件结构

```
.mumuspec/changes/<change-name>/
├── .mumuspec.yaml              # 变更状态（phase, workflow, build_layers, test_cases, ...）
├── proposal.md                 # 为什么 + 做什么 + 影响范围
├── cognitive-map.yaml          # 认知地图（四象限状态 + 演化历史）
├── design.md                   # 技术设计
├── tasks.md                    # 实现计划（Build 阶段产出）
├── delta-specs/                # 规范变更草案（ADDED/MODIFIED/REMOVED 语义）
├── constraints/
│   ├── new-shall.md            # 新增正向要求
│   └── new-shall-not.md        # 新增反向禁止
├── test-cases/                 # 测试用例规格（Design 阶段锁定）
│   ├── layer-0-cases.md
│   ├── layer-1-cases.md
│   └── layer-N-cases.md
├── suite-map.yaml              # 测试套件映射（Build 阶段锁定）
├── decisions.md                # 决策记录（各阶段 on_exit 追加）
├── code-graph/
│   ├── impact-analysis.json    # 影响分析
│   └── base-ref.txt
├── snapshots/                  # 回退快照
└── verify.md                   # 验证报告
```

> Phase Guard 详细规则见 [参考：Phase Guard](../reference/phase-guards.md)。

---

> **导航**: [← 契约层](contract-layer.md) | [知识层 →](knowledge-layer.md) | [返回概览](../overview.md)
