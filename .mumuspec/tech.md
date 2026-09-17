---
scope: .
layer: 0
last_updated: '2026-09-05'
---

# 技术概览: MumuSpec

## 六层架构

MumuSpec 采用六层架构，从上到下依次为：

```
┌─────────────────────────────────────────────────────┐
│  Entry Layer   │ cli.ts / mcp-server.ts / index.ts  │
├─────────────────────────────────────────────────────┤
│  Change Layer  │ manager.ts / state-machine.ts       │
├─────────────────────────────────────────────────────┤
│  Guard Layer   │ checker.ts / phase-guard.ts         │
├─────────────────────────────────────────────────────┤
│  Spec Layer    │ parser / loader / validator / ...    │
├─────────────────────────────────────────────────────┤
│  Knowledge Layer│ manager.ts (PageIndex + LLM-Wiki)   │
├─────────────────────────────────────────────────────┤
│  Core Layer    │ config / utils / errors / types      │
└─────────────────────────────────────────────────────┘
```

### 设计原则

1. **规范驱动** — 规范是行为的唯一真相来源，代码是规范的实现
2. **Ponytail 优先** — 能不写就不写，能复用就复用，能简单就简单
3. **渐进式披露** — 规范按需加载，Layer 0 → 1 → 2 逐步深入
4. **双向约束** — SHALL（正向要求）+ SHALL NOT（反向禁止）
5. **动态强度** — 约束按 high/medium/low 分级，映射到 block/warn/info
6. **零运行时依赖偏好** — install、bundle、i18n、skill-authoring 模块零外部依赖

## 模块分组

| 层 | 模块 | 职责 | 外部依赖 |
|----|------|------|----------|
| Entry | cli.ts | CLI 命令编排 | commander |
| Entry | mcp-server.ts | MCP 工具暴露给 LLM | @modelcontextprotocol/sdk |
| Change | manager.ts | 变更 CRUD + 构建层管理 | — |
| Change | state-machine.ts | 5 阶段状态机 + 回滚 | — |
| Change | phase-graph.ts | workflow 图构建（PHASE_ORDER 同构基准） | — |
| Change | phase-graph-loader.ts | 声明式 workflow YAML 加载 + 项目级 override | yaml |
| Guard | checker.ts | 合规检查 + 漂移检测 + 强度降级 | — |
| Guard | phase-guard.ts | 5 种阶段转换门禁 | — |
| Spec | parser.ts | spec.md 解析/序列化 | yaml |
| Spec | loader.ts | 渐进式上下文加载 | yaml |
| Spec | validator.ts | 全项目规范校验 | — |
| Spec | inheritance.ts | 继承冲突检测 | — |
| Spec | ponytail.ts | Ponytail 约束定义与注入 | — |
| Knowledge | manager.ts | 知识库 CRUD + PageIndex | — |
| Core | config.ts | 配置加载 + 约束树解析 + 强度矩阵 | — |
| Core | utils.ts | FS/YAML/Hash/审计工具 | — |
| Core | errors.ts | 标准化错误码 | — |
| Core | constraint-evaluator.ts | 运行时约束求值 | — |
| Core | constraints-loader.ts | 磁盘 I/O + 树加载 | — |
| Helper | generator.ts | AI 规则文件生成 | — |
| Helper | installer.ts | Skills/MCP/Commands 安装 | 零依赖 |
| Helper | packager.ts | 技能打包/验证 | 零依赖 |
| Helper | feedback.ts | 用户反馈管理 | — |
| Helper | hooks.ts | Git Hooks 管理 | — |
| Helper | eval.ts | 评估场景运行 | — |
| Helper | locales.ts | 国际化 | 零依赖 |
| Helper | protocol.ts | 技能创作协议 | 零依赖 |

## 关键决策

### D-001: 六层架构分离
**Decision**: 采用六层架构，每层有清晰的职责边界。Spec 层只管解析，Guard 层只管检查，Change 层只管状态，Knowledge 层只管存储。
**Consequence**: 各层可独立测试和替换；新增功能只需在对应层添加模块。

### D-002: 树状约束系统
**Decision**: 实现 ConstraintTreeNode，支持继承 + 收紧 + 冲突检测。根层 ConstraintStrength 由 config.yaml 控制，子层可覆盖。
**Consequence**: 灵活的分层约束；收紧合法；放松非法（产生冲突）。

### D-003: 动态强度映射
**Decision**: high→block, medium→warn, low→info。9 条 always_enforce 异常始终阻断。
**Consequence**: 通过切换 strict/balanced/hotfix 预设适应不同场景。

### D-004: 零运行时依赖偏好
**Decision**: install、bundle、i18n、skill-authoring 四个模块仅使用 Node.js 内置模块。
**Consequence**: 更小的安装体积、更快的启动、更少的 breaking changes。

### D-005: 5 阶段变更生命周期
**Decision**: open → design → build → verify → archive。支持回退（build→design, verify→design, verify→build）和热修复跳过设计。
**Consequence**: 清晰的进度追踪；阶段门禁保证质量；回滚机制提供安全感。

### D-006: Workflow 声明式外化（CHG-6 / CHG-7）
**Decision**: 阶段状态机的 phases / edges / breakpoints 以声明式 YAML 定义（`src/change/workflow.default.yaml` 为单一事实源，由 phase-graph-loader.ts 加载，AC-01 测试锁定与 PHASE_ORDER 同构）；项目可通过 `.mumuspec/workflow.yaml` override，在 guard 入口由 activateProjectWorkflow() 加载——存在且合法即生效，损坏/非法时 WARN 并回退内置默认。
**Consequence**: 流程定义与引擎代码分离（KP-0060 规则-实现分离）；项目可裁剪 BP、调整回退边而无需改代码；非法 override 被 loader 校验拒绝。

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 语言 | TypeScript (ESM) | 全栈类型安全 |
| 运行时 | Node.js >= 20.0.0 | 唯一运行时依赖 |
| CLI 框架 | commander | 命令行解析 |
| MCP SDK | @modelcontextprotocol/sdk | AI 工具集成 |
| YAML | yaml 库 | spec.md / config.yaml 解析 |
| 测试 | vitest | 单元测试 + 集成测试 |
| 构建 | tsc (TypeScript compiler) | ESM 编译 |
| Lint | ESLint + Prettier | 代码风格检查 |
| 零依赖模块 | Node.js 内置模块 | install/bundle/i18n/skill-authoring |


<!-- constraint-merged from 2026-09-09-completeness-artifacts-freedom-metrics/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from 2026-09-09-completeness-artifacts-freedom-metrics/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from 2026-09-09-review-followup-hardening/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from 2026-09-09-review-followup-hardening/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from freedom-metrics-loop-closure/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from freedom-metrics-loop-closure/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from archive-prune-safety/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from archive-prune-safety/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from archive-state-integrity/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from archive-state-integrity/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from self-improvement-loop-p0/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from self-improvement-loop-p0/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from evaluator-weight-single-source/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from evaluator-weight-single-source/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from loop-convergence-judgment/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from loop-convergence-judgment/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from evaluator-data-source-fix/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from evaluator-data-source-fix/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from loop-signal-bandwidth/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from loop-signal-bandwidth/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from skill-plugin-standard/new-shall-not.md -->
- 清单中的 source 不得指向不存在的目录
- 不得以自研清单格式作为分发的唯一形式——宿主无法识别的格式等于不可分发
- 不得以占位实现返回成功——动作未实现时的正确行为是失败并给出理由
- 不得覆盖目标位置中非本包管理的内容
- 不得只比对存在性而不比对内容（存在即被信任）
- 不得让技能源目录的高频编辑与副本之间不存在任何到期校验
- 不得声明无实体来源的必须加载项——强断言与可满足性脱钩时，断言恒为空转
- 不得以静默替换代替降级留痕
- 不得保留引擎不存在的字段名作为守卫检查项
- 不得让同一语义的既有正确内容在迁移中丢失
- 不得以技能不可用为由静默跳过高风险门禁
- 不得因合并询问而减少用户可选项或自动选默认值



<!-- constraint-merged from skill-plugin-standard/new-shall.md -->
- 单插件清单必须位于包根的 .codebuddy-plugin/plugin.json，包含 name / version / description / license 字段
- 市场清单必须位于 .codebuddy-plugin/marketplace.json，其 plugins 条目的 source 必须以相对路径指向包内实际存在的目录
- 包内容布局必须为 skills/<skill-name>/SKILL.md，使宿主无需转换即可加载
- 包版本必须取自包版本单一源（运行时包版本）
- 安装必须落到 plugins/cache/<marketplace>/<plugin>/<version>/ 布局，版本段来自包版本
- 安装必须幂等：同一版本重复安装不得产生重复条目，也不得失败退出
- 安装必须在宿主插件登记文件中登记或更新条目，键为 name@marketplace
- 安装必须在登记文件不可写或格式不可解析时 fail-closed 并给出理由
- 漂移检测必须比对源技能正文与安装副本正文，并在不一致时产出诊断
- 比对必须先剥离 frontmatter 的版本字段再比较
- 漂移诊断必须接入 mumuspec check 的 drift 数组与 CI 检查，作为可强制告警
- 漂移检测必须对自身生效：改动任一技能正文后必须产生诊断
- 技能文本中的外部能力必须分为两类：包内自足的必须步骤，与包外增强的伴随能力
- 伴随能力的可用性必须由代码侧探测并枚举
- 伴随能力缺失必须只出现在枚举清单中，不得阻断阶段流程
- 伴随能力的替代路径必须为带编号与产出的显式步骤
- 阶段分发规则必须只在一处定义，其余位置引用而非复写
- 技能文本引用的状态字段与配置键必须存在引擎消费者
- 每个门禁必须声明其为不可跳过，或声明可降级且降级须留痕
- 高风险门禁（安全、代码审查、调试前置）不得存在无条件跳过表述
- 相邻的人工确认点必须在保持选项集不变的前提下合并为一次询问



<!-- constraint-merged from enforcement-coverage/new-shall-not.md -->
# New SHALL NOT Constraints

## Requirement: Delta Merge Integrity

Enforcement: manual(MRGT-01: verify 阶段以负向测试断言静默丢弃路径已消除)

- SHALL NOT 归档时静默丢弃无法合并的 delta-spec 文件（`E-CHANGE-022` 强制中断，不可静默降级为警告）



<!-- constraint-merged from enforcement-coverage/new-shall.md -->
# New SHALL Constraints

## Requirement: Delta Merge Integrity

归档时的 delta-spec 合并必须留下可判定事实：合并成功、幂等跳过或显式失败三态之一，不允许静默丢弃。

- SHALL: 归档合并 delta-spec 时，对每个无法解析合并目标或读写失败的 delta 文件以 `E-CHANGE-022` 中断归档并留 audit 记录
- SHALL: `mergeDeltaSpecsToMain` 返回包含已合并文件与未解决文件（含原因）的结果对象



<!-- constraint-merged from ci-drift-gate/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from ci-drift-gate/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from shall-structure-lint/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from shall-structure-lint/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from spec-fence-guard/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from spec-fence-guard/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from fail-open-audit/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from fail-open-audit/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from delta-channel-gate/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from delta-channel-gate/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from ready-action-guidance/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from ready-action-guidance/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from drift-delta-preview/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from drift-delta-preview/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from workflow-tier-hint/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from workflow-tier-hint/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from bp-into-graph/new-shall-not.md -->
# New SHALL NOT Constraints

- SHALL NOT 在 workflows 段缺少 phase_bps 时改变既有解析与校验行为（缺省合法，向后兼容）。
- SHALL NOT 因 phase_bps 非法而崩溃，必须走既有 fail-safe 路径（console.warn 加内置默认配置）。
- SHALL NOT 让 W-GRAPH-001 以 error 级别发出，也不得在 skill 侧 workflow.yaml 缺失时阻断 graph verify。
- SHALL NOT 改变任何既有 BP 的存在性或人工确认机制。



<!-- constraint-merged from bp-into-graph/new-shall.md -->
# New SHALL Constraints

- SHALL 支持 workflows.<workflow>.phase_bps 可选键（phase 到 BP id 列表的映射），loader 校验键为已知 phase、id 格式 BP-<数字>[.<数字>]、全配置内唯一。
- SHALL graph verify 输出当前 workflow 的 phase_bps 清单，并将 skills/mumuspec/workflow.yaml 声明的 BP 集合与引擎 phase_bps 对比，差异以 W-GRAPH-001 告警（WARN 级）。
- SHALL full workflow 的 phase_bps 并集覆盖 BP-1 至 BP-18 全部 18 个 BP。



<!-- constraint-merged from legacy-cleanup-fix/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from legacy-cleanup-fix/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from eval-corpus/new-shall-not.md -->
# New SHALL NOT Constraints

- SHALL NOT corpus 聚合与 kill 判定引入 LLM 判定或手写指标值
- SHALL NOT 新评估器改变既有 loop composite 权重之和、收敛阈值与稳定窗口
- SHALL NOT 语料文件位于 tests、temp 等会被规范 walker 递归扫描的路径
- SHALL NOT custom 场景类型落入未知类型分支输出 warning
- SHALL NOT report 输出改变 check 与 validate 命令的既有 JSON schema
- SHALL NOT 将探针启动失败或输出不可解析的 fixture 计为漏检
- SHALL NOT 静默丢弃无 expected.yaml 声明的语料子目录
- SHALL NOT 静默跳过已声明聚合阈值的断言



<!-- constraint-merged from eval-corpus/new-shall.md -->
# New SHALL Constraints

- eval runner corpus 场景类型按 corpusDir 下 fixture 子目录独立运行并聚合 recall 与 noise，kill 判定采用多信号 diff（新增码 ∪ coverage 五字段 delta）
- corpus 语料样本输出 Wilson 95% 置信区间，样本数不足 3 时标注置信不足
- custom 场景类型仅执行 assertions 断言，不执行引擎动作
- verifiable-ratio 评估器以 weight 0 注册，value 为 validate coverage 的 strong_ratio
- fail-open-count 评估器以 weight 0 注册，统计 audit.log 中 result 非 success 条目并按 action 分组
- 评测语料库位于 .eval-corpus/ 隐藏目录，位置隔离经 fixture-location 断言验证
- eval 命令提供 --report 汇总输出（文本与 JSON 双形态）
- corpus 聚合区分 killed、missed、errored 三态，探针启动失败或输出不可解析的 fixture 不计入 recall 分母并作为场景 warning 列明
- 未声明 corpusExpect 聚合阈值时输出 report-only 模式 warning，不改变 passed 语义
- 被声明的聚合阈值（minRecall、recallBySeverity、maxNoise）对应分母为 0 时报配置错误（fail-closed）
- corpusDir 下含 .mumuspec 子目录但缺 expected.yaml 的子目录发出 warning 并计数，不计入任何分母
- report 汇总附 corpus 聚合精度（mustContainSatisfied 命中比率），仅展示、不设阈值
- bad-case 语料覆盖可发射集 15 码各至少 1 例（E-SPEC-001、E-SPEC-002、E-SPEC-003、E-SPEC-004、E-SPEC-006、E-SPEC-008、E-SPEC-009、E-SPEC-010、E-SPEC-011、E-SPEC-013、E-SPEC-014、E-SPEC-015、W-SPEC-016、E-GUARD-010、E-CHANGE-022）；E-SPEC-005、E-SPEC-007、E-SPEC-012 为 registered-but-not-emitted（M1 出范围），不建必须命中语料

