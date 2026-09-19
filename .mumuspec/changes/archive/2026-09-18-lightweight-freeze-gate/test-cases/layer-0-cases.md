# Test Cases — Layer 0（数据层：freeze-gate 解析 / 最小单元 / skip_specs）

> 测试用例是设计产出，Build 阶段锁定后不可变更（W-GUARD-004）。

## TC-L0-01：无 blocking 声明回归（CHG-5 兼容关键路径）
- 前置：proposal 不含 `## User Decisions` 段，workflow=tweak
- 动作：checkOpenToBuildHotfix
- 预期：0 新增 errors/warnings，结果与改动前一致

## TC-L0-02：blocking 决策未签收报错
- 前置：proposal 含 `## User Decisions` 段的 `- [blocking] 确认新鉴权路由为唯一出口`，decisions.md 无对应签收文本
- 动作：checkOpenToBuildHotfix
- 预期：errors 含 E-GUARD-011 且条目标题出现在报错列表

## TC-L0-03：blocking 决策全部签收通过
- 前置：同上但 decisions.md 已含该条目文本的 open 阶段签收（去空白子串命中）
- 动作：checkOpenToBuildHotfix
- 预期：0 errors

## TC-L0-04：非 blocking 决策不触发门禁
- 前置：proposal 的 `## User Decisions` 段仅含 `- 实现技术选型可自行决定`（无 `[blocking]`）
- 动作：checkOpenToBuildHotfix
- 预期：0 新增约束（与 TC-L0-01 行为一致）

## TC-L0-05：最小可解析单元合法（轻量档）
- 前置：tweak 变更 delta 恰含单条 `## Requirement:` 与一条 `### SHALL` 项
- 动作：isMinParseableUnit / delta 校验
- 预期：谓词 true、校验 0 errors（不要求多需求/Purpose）

## TC-L0-06：full workflow 校验行为不变
- 前置：full 变更 delta 零 requirements（或单 Requirement 无 SHALL 主体）
- 动作：isMinParseableUnit / delta 校验
- 预期：谓词 false；校验按既有规则处理（零 requirements 仍为 E-SPEC-004 warning），结果与改动前逐项一致

## TC-L0-07：--no-spec-delta 逃生舱
- 前置：`mumuspec new X --workflow tweak --no-spec-delta` 成功，state.skip_specs=true，无 delta-specs 目录
- 动作：open→build 守卫
- 预期：无 delta-specs 相关 error/warning；verify 结果约束照常生效（测试未过仍阻断）