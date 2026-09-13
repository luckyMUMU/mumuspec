# Test Cases — Layer 0（数据层：phase_bps 类型与 loader 校验）

> 测试用例是设计产出，Build 阶段锁定后不可变更（W-GUARD-004）。

## TC-L0-01：合法 phase_bps 解析
- 前置：workflows.full 含 phase_bps（键为已知 phase，id 形如 BP-1 / BP-4.5）
- 动作：parseWorkflowConfig / collectErrors
- 预期：0 错误，phase_bps 原样保留

## TC-L0-02：缺 phase_bps 向后兼容
- 前置：workflows 段不含 phase_bps
- 动作：collectErrors
- 预期：0 错误（缺省合法，既有行为不变）

## TC-L0-03：未知 phase 键报错
- 前置：phase_bps 含未知 phase 键（如 'launch'）
- 动作：collectErrors
- 预期：报错信息含该 phase 名

## TC-L0-04：BP id 格式非法报错
- 前置：phase_bps 值含不符合 BP-<数字>[.<数字>] 的 id（如 'BP-x'）
- 动作：collectErrors
- 预期：报错信息含该 id

## TC-L0-05：BP id 全局重复报错
- 前置：同一 BP id 出现在两个 phase
- 动作：collectErrors
- 预期：报错信息含重复 id

## TC-L0-06：非法配置 fail-safe
- 前置：phase_bps 结构非法（值非数组）
- 动作：loadWorkflowConfig
- 预期：console.warn 后返回内置默认配置，不抛异常
