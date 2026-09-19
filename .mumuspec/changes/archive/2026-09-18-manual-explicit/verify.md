# Verify Report: manual-explicit

## 验证结果：pass（全量验证）

| 检查 | 结果 |
|---|---|
| check（合规+漂移+术语，exit code） | 0 error；[drift] OK |
| validate（格式+Enforcement 覆盖） | 通过；371 约束 declared_ratio 100.0%，unverifiable=0 |
| test-cases verify（hash + 套件） | 通过（lock-suite，suites_locked=true，hash d1e7b1f5cd35504e） |
| guard verify | 通过（0 errors / advisory warnings） |
| lint / build | tsc --noEmit 0 error；error-codes 文档重建 116 码 / 21 域 |
| 新增测试 | tests/spec/manual-explicit.test.ts(8) 全绿；verifier-classify 既有 25 例全绿 |
| 全量回归 | spec+guard（39 文件 514 例）全绿；残余失败（git.test / hooks / cli.test git init / metadata-alignment STATUS.md 版本漂移）均环境性或既有漂移，与本变更无关 |

## Enforcement 覆盖（通道验证记录）

- MANUAL_EXPLICIT（ENF-1）：TC-L0-01（implicit-manual → W-SPEC-017 advisory，分类与阻断不变）、TC-L0-02（显式 manual(reason) 无提示）、TC-L0-03（结构化证据按 id 命中）、TC-L0-04（无结构化记录回落文本锚点）、TC-L0-05（classifyConstraintEntry 三分：weak / unverifiable / manual）→ tests/spec/manual-explicit.test.ts

## 过程裁决记录

- W-SPEC-017 发放点裁决：validateSpecMd 与 validateSpecFile 双侧发放（按 requirement 级 kind==='implicit-manual' 精确命中，避免对全部 manual 项噪声告警；不放入 emitVerifiabilityFindings 以保持既有警告面零变化）。
- 结构化证据实现裁决：仅校验器侧解析（parseStructuredEvidence，宽容解析）+ 三字段完整性门槛（verdict + evidence_hash + constraintId）；无 verify 写入命令（先命令后文档，写入方待后续变更）。
- legacy 锚点匹配修正：缺失判定先剥离 `{...}` 记录块——结构不完整记录不再借自身 enforcementId 文本自证，防止"文本包含即豁免"。
- classifyConstraintEntry：空 enforcement 按 isRegexCheckable(content) 判 enforced-weak / unverifiable；`manual(...)` 或 legacy 文本均 manual（行为不变）；不引入 yaml 条目的 annotation 机制（无来源，YAGNI）。

## 分支处理

- 待归档：本机无 git（`git init` 无法执行），归档的分支提交/合并步骤需在 git 可用环境完成；按状态机 isolation=branch（mumuspec/manual-explicit），归档时 git 步骤失败则按手动处理留痕。