# Global Prohibitions

> Last updated: 2026-09-05
> CHG-5 (0.20): 过程约束降为 advisory，仅保留结果约束为 block

## All Modules

### 流程执行载体（0.20 CLI-first）

- 禁止手工编辑 decisions.md 追加决策（必须 `mumuspec decisions append --text`，手工编辑破坏 content_hash 审计链）
- 禁止手工编辑 `.mumuspec.yaml` 的状态字段（必须 `state set` / `state layer`；受保护字段绕过须审计）
- 禁止 LLM 自行计算或手写 hash 类字段（design_content_hash / suites_hash 须 CLI 命令写入）
- 禁止 skill 指示使用状态机不存在的目标阶段（历史误写：verify-fail、archive-reopen）

### 运行时依赖

- 禁止在 install/、bundle/、i18n/、skill-authoring/ 模块中引入任何外部 npm 包（ponytail: 零运行时依赖偏好决策 D-004）
- 禁止使用 `require()`（仅允许 `import` ESM 语法）
- 禁止引入未被请求的第三方库替代 Node.js 内置功能（ponytail: YAGNI）

### 规范完整性（结果约束 — 恒 block）

- 禁止 SHALL 约束缺少对应的 Enforcement 机制
- 禁止 SHALL NOT 红线无可验证通道（E-SPEC-015 恒 block）
- 禁止 spec.md 包含无具体内容的占位符（如 "定义本层的正向要求"）

### 文档产出（结果导向）

- 禁止在文档中记录思考过程、推理链或生成过程回顾（除非用户明确要求）
- 禁止在文档中记录生成所用到的要求、命令、提示词等元信息
- 禁止在文档中写对齐来源、修改说明类元注释（如"（与 XX 对齐）"、"本次更新了…"）
- 禁止保留过期或无效的文档内容（类比死代码——删除而非注释保留）
- 禁止生成多余的说明性注释

### 代码质量

- 禁止使用 `any` 类型绕过类型检查（必须显式声明或推断）
- 禁止在 error 消息中泄露敏感信息（密钥、token、文件路径）
- 禁止不安全的反序列化（yaml.load 必须指定 schema 或类型断言）

### 变更管理（结果约束 — block；过程约束已降级 advisory）

- 禁止归档未通过 verify 的变更（结果约束：verify_result 必须 pass）
- 禁止在 CI 环境中执行 force_skipped 的 SHALL NOT 检查
- 禁止跳过敏感信息扫描（sensitive_info_scan 为 always_enforce 异常）

### 安全

- 禁止直接使用用户输入拼接文件路径（必须通过 isPathSafe 检查）
- 禁止跳过敏感信息扫描（sensitive_info_scan 为 always_enforce 异常）

### 已降级为 advisory 的约束（0.20 CHG-5）

> 以下约束从 SHALL NOT 降级为 SHOULD NOT，不再 block，仅产生 warning。
> LLM 在这些方面拥有自主决策权，结果约束（verify pass）兜底。

- ~~禁止在 single_active_change 模式下同时存在多个活跃变更~~ → advisory（medium 强度自动关闭）
- ~~禁止跳过设计阶段执行 full workflow 的 build~~ → advisory（LLM 可自主选择设计深度）
- ~~禁止 design.md 为空模板~~ → advisory（结果约束为 verify 通过）



<!-- from finalize-archive -->
# New SHALL NOT Constraints




<!-- from finalize-archive -->
# New SHALL NOT Constraints




<!-- from finalize-archive -->
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



<!-- from finalize-archive -->
# New SHALL NOT Constraints

## Requirement: Delta Merge Integrity

Enforcement: manual(MRGT-01: verify 阶段以负向测试断言静默丢弃路径已消除)

- SHALL NOT 归档时静默丢弃无法合并的 delta-spec 文件（`E-CHANGE-022` 强制中断，不可静默降级为警告）



<!-- from finalize-archive -->
# New SHALL NOT Constraints

- SHALL NOT 在 workflows 段缺少 phase_bps 时改变既有解析与校验行为（缺省合法，向后兼容）。
- SHALL NOT 因 phase_bps 非法而崩溃，必须走既有 fail-safe 路径（console.warn 加内置默认配置）。
- SHALL NOT 让 W-GRAPH-001 以 error 级别发出，也不得在 skill 侧 workflow.yaml 缺失时阻断 graph verify。
- SHALL NOT 改变任何既有 BP 的存在性或人工确认机制。



<!-- from finalize-archive -->
# New SHALL NOT Constraints

- SHALL NOT corpus 聚合与 kill 判定引入 LLM 判定或手写指标值
- SHALL NOT 新评估器改变既有 loop composite 权重之和、收敛阈值与稳定窗口
- SHALL NOT 语料文件位于 tests、temp 等会被规范 walker 递归扫描的路径
- SHALL NOT custom 场景类型落入未知类型分支输出 warning
- SHALL NOT report 输出改变 check 与 validate 命令的既有 JSON schema
- SHALL NOT 将探针启动失败或输出不可解析的 fixture 计为漏检
- SHALL NOT 静默丢弃无 expected.yaml 声明的语料子目录
- SHALL NOT 静默跳过已声明聚合阈值的断言



<!-- from finalize-archive -->
# New SHALL NOT Constraints

## Requirement: SHALL 约束机器可验证性

- SHALL NOT: 禁止为 SHALL 引入新检查引擎（仅复用既有 annotation 类型与 AST provider）。
- SHALL NOT: 禁止改变无通道 SHALL（E-SPEC-004）与无通道 SHALL NOT（E-SPEC-015）的既有判定路径。

Enforcement:

- ENF-1: manual(回归测试：无通道回落与 E-SPEC-004/015 行为不变)


<!-- from finalize-archive -->
# New SHALL NOT Constraints

## Requirement: 词法通道显式化

- SHALL NOT: 禁止改变 `legacy_lexical_channel=true` 时无前缀文本的既有 R2 行为（兼容面与现状一致）。
- SHALL NOT: 禁止为 annotation 主入口引入新检查引擎（仅复用既有类型与 AST 通道）。

Enforcement:

- ENF-1: manual(回归测试：legacy 默认兼容 + 无新引擎)


<!-- from finalize-archive -->
# New SHALL NOT Constraints

## Requirement: manual 显式化

- SHALL NOT: 禁止改变既有 manual 分类结果与 E-SPEC-004/015 阻断语义。
- SHALL NOT: 禁止改变 check/validate 既有 JSON schema（新字段仅追加）。

Enforcement:

- ENF-1: manual(回归测试：旧行为不变)


<!-- from finalize-archive -->
# New SHALL NOT Constraints

（权威正文以 delta-specs/baseline-trust.md 为准；与既有红线重复的条目已删除，保持单一权威源。）
- 禁止为 constraints.yaml 条目另立第二套分类判定逻辑（须复用 verifier-classify 判定序）。
- 禁止对账通道以语义判断决定进度好坏（只核对断言与事实的矛盾）。



<!-- from finalize-archive -->
# New SHALL NOT Constraints

- 禁止悬空的行为门指针进入强制面（无门禁把守而声称被把守）。
- 禁止行为门校验器执行子进程或引入新解析引擎（静态核验归注册表与语料清单）。

