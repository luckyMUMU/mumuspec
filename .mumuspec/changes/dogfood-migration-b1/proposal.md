# Proposal: dogfood-migration-b1

## Why
基准可信度主线（方案一）的第二半：机器通道与对账已随 enforcement-gap 就位，但 dogfood 存量仍是"判断面整体推给人工"——check --json 实测 total 362 / strong 2 / weak 21（全部 legacy 兜底，零显式注解）/ manual 339。"人与 AI 共建统一设计基准"要求基准本身的红线尽可能机器可执行；strong_ratio 0.5% 意味着当前对 AI 的实际强制面几乎全靠词法兜底与人工签收。

## What
按三分类处置存量约束（数据见 triage-baseline.txt：根 spec.md 248 条 manual、roadmap 35 条、constraints.yaml 12 条）：
1. **可机检迁移**：语义可映射到既有通道者→spec frontmatter 注解（AST 通道）或显式 `lex:` 前缀（词法通道）或 `ast:` 前缀；constraints.yaml 条目补 `annotation` 字段。映射表逐条列明依据，**回写前需人工签收**（F8 错配教训）。
2. **确属人工**：改写为显式 `manual(reason)`，声明核验方式，verify 证据义务机器核对（E-VERIFY-003 已在位）。
3. **legacy weak 升级**：21 条静默词法兜底条目补显式注解或 `lex:` 前缀，脱离 legacy 通道（为 `legacy_lexical_channel=false` 演练铺路）。

批次内不改引擎；KNOWN_PATTERNS 覆盖不到的映射以 frontmatter 手写注解完成（不新增注解类型，守 no-new-engines）。

## Impact Scope
- .

## User Decisions
- [blocking] 迁移映射规则：仅"语义与通道真实对应"才升 strong/weak，映射不了的显式 manual(reason)——不做提升覆盖率的错配注解（F8 教训）。
- [blocking] 回写方式：按文件分批（根 spec.md → roadmap → constraints.yaml），每批附逐条映射清单供签收，不一次性全量重写。

## Workflow
full

## Acceptance（可判定）
- 迁移批完成后：`check --json` strong+显式 weak 数 ≥ 分诊预估且 0 错配抽检回退；`legacy_weak` 计数归零。
- `legacy_lexical_channel: false` 演练下 `check` 仍 exit 0。
- enforcement_coverage 数字同步进 STATUS 运行时字段（对账通道保证其不再漂移）。
- 全量测试与 eval-corpus 聚合不回退。
