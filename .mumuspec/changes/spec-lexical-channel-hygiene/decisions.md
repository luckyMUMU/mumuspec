# Decision Log: spec-lexical-channel-hygiene


## [open] 2026-09-11T14:31:01.475Z

范围裁定：本变更为 freedom-metrics-loop-closure 归档后由 mumuspec check 暴露的回归修复（E-GUARD-003 59→68，新增 9 条经逐行核验全为误报），属用户『执行复评建议』指令的延续，范围限于该缺陷，不扩大

## [open] 2026-09-11T14:31:05.864Z

设计裁决：修法落点采用『约束文本 + 作者侧纪律』，不改词法兜底通道派生逻辑。理由——(1) 行内代码标记在本规范的既有约定中即表示通道字面量（--force / .cursorrules / decisions.md 等均为通道承载者），本次两条约束把对象标识符写进标记属作者侧误用，改写即回到约定；(2) 给兜底通道加『对象引用型引号词』亲和规则需要新的判定边界（命令名/配置键 vs 行为），边界模糊且会削弱合法通道，违反 YAGNI 与『不新增引擎』(N1)；(3) 重复约束的删除本身是既有『单一权威源』纪律的落实

## [verify] 2026-09-11T14:37:01.913Z

verify 结论 pass：tsc --noEmit 0 错误；受影响测试 15 文件/195 用例全 PASS；全量回归 256 文件 4969 用例（1 FAIL，与变更前基线逐项一致，仍为既有 59 条 E-GUARD-003 导致的 cli-smoke dogfooding 门槛）；validate 通过（299 条约束，unverifiable 0）；drift 无漂移；check 的 E-GUARD-003 由 68 回到 59，E-AGENTS-001 随 Rules 重新生成消失

## [verify] 2026-09-11T14:37:05.291Z

实现期裁决：spec.md 的两处修订以原位改写方式完成（档案合并为纯追加，无修订原语），修订意图与理由记录于本 decisions.md 与 proposal.md；新增的『约束通道与约束语义一致』Requirement 走 delta-specs 追加路径，归档时合并入 spec.md
