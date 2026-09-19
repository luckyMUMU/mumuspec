# Test Cases: shall-annotation-channel (Layer 0)

> 对应 delta-spec：`delta-specs/.-tech.md` ｜ 用 `mumuspec test-cases lock-suite` 锁定

## TC-L0-01 分类对称（positive）

- 前置：同一 `ProhibitionAnnotation.text` 分别作为 shall 条目与 shall-not 条目文本，annotation.type = `no-side-effect`。
- 步骤：`classifyRequirements` 分类。
- 期望：两条均 `enforced-strong`。

## TC-L0-02 ast: 前缀 SHALL 执行（positive）

- 前置：SHALL 条目文本 `ast:no-side-effect`。
- 步骤：`checkCompliance` fullCheck 对包含副作用调用的 src 文件的仓库执行。
- 期望：分类 `enforced-strong`；guard 报 `E-GUARD-012`，detail 含文件与行号。

## TC-L0-03 无通道 SHALL 回落（negative / 回归）

- 前置：SHALL 条目无注解、无 `ast:` 前缀。
- 步骤：`checkShall`。
- 期望：`unverifiable`；仅 `E-SPEC-004` 告警（warning），无 errors，行为与变更前一致。

## TC-L0-04 无通道 SHALL NOT strict（回归）

- 前置：SHALL NOT 条目无注解、无可提取文本。
- 步骤：`checkShallNot` + `enforcement_strict=true`。
- 期望：`E-SPEC-015` 以 error 阻断，行为与变更前一致。

## TC-L0-05 测试文件豁免

- 前置：测仓库含 `tests/` 下带副作用文件满足 SHALL `ast:no-side-effect`。
- 步骤：fullCheck。
- 期望：测试文件不产生 `E-GUARD-012`（isTestFile 豁免沿用）。

## TC-L0-06 范围过滤与 agent-behavior 豁免（回归）

- 前置：子目录 spec 的 SHALL 注解；agent-behavior 型 SHALL 文本。
- 步骤：fullCheck。
- 期望：SHALL 执行段与 SHALL NOT 同语义——仅范围内文件被检查；agent-behavior 约束在 src/ 豁免（dogfooding）。