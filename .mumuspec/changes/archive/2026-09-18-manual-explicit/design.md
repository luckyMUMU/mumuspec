# Design: manual-explicit

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

把 manual 路径从"懒惰默认"收口为显式声明 + 可机器校验的证据记录：implicit-manual 给出 advisory 迁移提示（不改变分类与阻断）；verify 证据支持结构化记录（结构校验 + id 匹配，文本锚点回落兜底）；constraints.yaml 条目分类接入统一通道（可提取→weak）。全程零破坏性：不改变既有分类结果、阻断语义与 JSON schema。

## 实现

### 1. implicit-manual 迁移提示（src/core/errors.ts + src/spec/validator.ts）

- 新增 `W-SPEC-017`（advisory）：`MANUAL_IMPLICIT_LEGACY` —— implicit-manual enforcement 提示改写显式 `manual(reason)`。注册 ERROR_CODES（severity WARN，非 always_enforce）。
- validator.ts `emitVerifiabilityFindings`（或 validateSpecMd）对 `item.explicitManual === false && item.cls === 'manual'` 且来源为 legacy free text 的条目追加该警告。注意与既有分类顺序：不改变任何 error/warning 的既有发放点。
- 判定来源：`makeItem` 已带 `explicitManual`（显式 manual 声明）；implicit-manual 时 explicitManual=false。

### 2. 结构化证据（src/spec/verifier-classify.ts missingManualEvidence）

- 新增纯解析 `parseStructuredEvidence(verifyContent): Array<{constraintId, user, verdict, timestamp, evidence_hash}>`：识别 `{constraintId: "ENF-x", ...}` 形式记录行（宽容解析：引号可省略、字段顺序不限、允许行内前缀文本）。
- `missingManualEvidence` 逻辑：条目有 enforcementId 且存在匹配的结构化记录 → 视为已满足；否则回落既有逻辑（标题锚点 enforcementId→文本前 24 字符包含匹配）。
- 结构校验：constraintId 非空 + verdict 非空 + evidence_hash 非空（存在性校验，校验器只验证结构，hash 由写入方计算）。
- 纯函数，无 I/O；既有文本匹配分支零改动（向后兼容）。

### 3. classifyConstraintEntry 统一通道（src/spec/verifier-classify.ts）

- 当前：enforcement 空 → unverifiable；否则 manual。
- 改为：enforcement 空 → `isRegexCheckable(content)` ? `enforced-weak` : `unverifiable`；enforcement 以 `manual(` 开头 → `manual`；其余文本 → `manual`（implicit，行为不变）。
- 延续 lenient 语义：不引入 annotations 到 constraints.yaml（无既有注解源，YAGNI）。

## 错误码

- 新增 `W-SPEC-017`（spec 域，`MANUAL_IMPLICIT_LEGACY`）：implicit-manual enforcement 迁移提示。注册于 src/core/errors.ts，severity WARN。

## 不做什么

- 不写入结构化证据（无 verify writer，证据记录由使用者/CLI 后续承载；本变更只做校验器侧解析）。
- 不为 constraints.yaml 条目引入 annotation 机制（无来源，YAGNI）。
- 不改变 manual/implicit-manual 的分类结果与 E-SPEC-004/015 阻断语义。
- 不加新命令（先命令后文档纪律——写证据命令属后续变更）。

## 测试用例

详见 `test-cases/layer-0-cases.md`（TC-L0-01 ~ TC-L0-05），Design 后经 `test-cases lock-suite` 锁定。