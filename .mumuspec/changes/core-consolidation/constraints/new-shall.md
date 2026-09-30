# Delta SHALL — core-consolidation

来源：R-0014–R-0019，`review/2026-09-30-core-consolidation-plan.md`。

## Requirement: 起草覆盖面判定

### SHALL
- 覆盖维度枚举 SHALL 由代码常量单一持有，design-schema、阶段门禁与 skill 文本三处引用同源。
- Q4 盲区扫描的收敛判定 SHALL 以维度身份为准：同一维度的多条记录不构成多维度覆盖。
- full 工作流的 design.md SHALL 含安全与隐私节，缺失由既有章节完备性校验通道报出。
- 安全与隐私节的每个检查项 SHALL 在不适用时显式标注未决，不得以留空通过校验。

### Enforcement
- ASPECT-1: 维度身份判定由覆盖维度分类器测试锁定
- ASPECT-2: 安全节缺失判定由阶段守卫测试锁定（full 触发、hotfix/tweak 不触发）

## Requirement: 架构决策落点

### SHALL
- 每个架构选型条目 SHALL 具备议题、选定、备选集合与理由四字段，缺任一项按格式缺陷报出。
- 仅有选定而无备选与理由的条目 SHALL 视同缺失。
- 偏好包候选集 SHALL 含"暂不约束"合法态，使未决策可被显式记录。
- 缺输入时的引导 SHALL 报错并列出可选值，不得静默套用默认。

### Enforcement
- SELECT-1: 四字段完备性判定由骨架渲染与校验测试锁定
- SELECT-2: E-SPEC-006 修复步骤所指命令的存在性由回归锁定

## Requirement: 图数据渲染

### SHALL
- 同一输入的渲染输出 SHALL 字节一致。
- 节点、边、阻塞点与计数标签 SHALL 全部取自图数据，调用方不得注入字面标签。
- 无边可达的节点与未挂阻塞点的转移 SHALL 在输出中可见。
- 渲染命令与工具 SHALL 为纯只读：不写状态工件、不触发阶段转换、可重复执行。

### Enforcement
- RENDER-1: 字节一致性与可见性反向用例由渲染测试锁定
- RENDER-2: manual(图样式与可读性由人工评审，机械通道只核对结构与来源一致性)

## Requirement: 复用与来源

### SHALL
- 复用而来的契约与约束条目 SHALL 携带上游来源声明并落入来源集合。
- 复用与导入 SHALL 只可收紧本层约束，放宽请求 SHALL 被拒绝。
- 来源范围或对象不存在时 SHALL 失败并列出可选项，不得返回空集合。

### Enforcement
- REUSE-1: 来源声明缺失与空集合行为由复用测试锁定

## Requirement: Worktree 门与路径成对

### SHALL
- 工作树隔离处于强制档时，阶段守卫 SHALL 校验工作树存在性并阻断缺失。
- 允许降档时 SHALL 降级并留痕，降级事实 SHALL 可被查询。
- 工作树创建失败 SHALL 中断转换并记录原因，不得吞异常继续。

### Enforcement
- WT-1: 强制档阻断与降档留痕由阶段守卫测试锁定

## Requirement: 声明一致率

### SHALL
- 声明一致率 SHALL 由代码遍历配置声明、命令注册表、错误码表与进度断言确定性推导。
- 该指标 SHALL 作为独立上报面接入，不并入收敛评估的权重、阈值与稳定窗口。
- 断言核对 SHALL 双向拦截：实际低于声称与声称低于实际均报出。

### Enforcement
- CONF-1: 三比值违反用例由指标测试与语料断言锁定
