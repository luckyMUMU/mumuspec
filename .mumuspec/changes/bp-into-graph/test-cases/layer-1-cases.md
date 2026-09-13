# Test Cases — Layer 1（消费层：graph verify 报告与一致性检查）

> 测试用例是设计产出，Build 阶段锁定后不可变更（W-GUARD-004）。

## TC-L1-01：graph verify 报告 phase_bps 清单
- 前置：workflow.default.yaml 含 full/hotfix/tweak/loop 的 phase_bps
- 动作：解析配置，取 full workflow 的 phase_bps
- 预期：输出含 open/design/build/verify/archive-in-progress 五个 phase 的 BP 清单

## TC-L1-02：全 workflow 并集覆盖 BP-1..BP-18
- 动作：收集所有 workflows 的 phase_bps 并集
- 预期：包含 BP-1 至 BP-18 每一个 id（BP-18 仅出现于 hotfix/tweak 的 build）

## TC-L1-03：skill 侧声明一致时 0 告警
- 前置：skills/mumuspec/workflow.yaml 与引擎 phase_bps 集合一致（design 已补 BP-4.5）
- 动作：运行一致性对比
- 预期：不产生 W-GRAPH-001

## TC-L1-04：skill 侧缺声明触发 W-GRAPH-001
- 前置：从 skill 侧声明集合中移除一个 BP（如 BP-4.5）
- 动作：运行一致性对比
- 预期：产生 W-GRAPH-001，message 含缺失 id，severity 为 WARN（非 error）

## TC-L1-05：skill 侧文件缺失时跳过检查
- 前置：skills/mumuspec/workflow.yaml 不存在
- 动作：运行 graph verify
- 预期：不抛异常、不产生 W-GRAPH-001，phase_bps 报告照常输出（fail-open）

## TC-L1-06：W-GRAPH-001 已注册
- 动作：检查 src/core/errors.ts ERROR_CODES
- 预期：含 W-GRAPH-001，severity WARN，可被 gen-error-codes-doc 收录
