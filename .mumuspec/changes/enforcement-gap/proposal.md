# Proposal: enforcement-gap

## Why
目标锚定"人与 AI 共建统一设计基准"。当前基准可信度有两个空洞：
1. 引擎机器强制面不完整——`classifyConstraintEntry`（src/spec/verifier-classify.ts）无注解通道，且**零消费点**（产出物无消费者，违反自家红线）；constraints.yaml 中带真实校验器引用的条目恒落 manual。
2. 文档断言无对账——STATUS.md 自称"进度唯一权威来源"，但"Contract Layer 0%"与 src/contract 实存 2543 行实现矛盾，无任何机器核对。
对应 lite-first 计划（review/2026-09-18-lite-first-enforcement-plan.md）A3.3 收尾 + 基准对账缺口。

## What
1. **constraints.yaml 注解通道**：`ConstraintEntry` 追加可选 `annotation?: MachineReadableAnnotation`（复用 spec frontmatter 同一类型，单一权威源）；`classifyConstraintEntry` 判定序对齐 spec 条目（R1 annotation→strong / R2 显式 `lex:`（受 `legacy_lexical_channel` 管辖）/ enforcement 声明→manual / 无→unverifiable）；新增纯函数适配器投影为 `ClassifiedItem` 并入 guard/checker 既有执行流水线（复用 E-GUARD-012），使 coverage 与 check 同时消费。
2. **status-assertion 对账通道**：新模块 `src/guard/status-assertion-checker.ts`（纯函数），只核对四类机械断言（包版本 / 能力层进度 vs 模块实现事实 / 命令与工具数量断言 / last_updated 新鲜度），以 check drift 数组新 type `status_assertion` 承载（schema append-only）；新错误码注册 errors.ts，strict 下矛盾断言升 ERROR（同 E-SPEC-015 门控模式）；解析失败 fail-safe WARN 跳过；接入 `npm run ci:check`；`.eval-corpus/` 增补漏检/误报 fixture。

## Impact Scope
- .

## User Decisions
- [blocking] 对账语义只拦"断言与事实矛盾"，不判进度好坏（密度是信号纪律）。
- [blocking] strong 判据沿用"注解存在且通道真实执行"；引用存在性核验（verification ref）不自动升 strong，保持 manual。

## Workflow
full

## Workflow Path Recommendation

**Recommended Path:** full
**Confidence:** 95%

**Rationale:**
Safety fence triggered: cross_module. Full workflow required.

**Safety Fence Active:** Compression blocked by:
- cross_module
