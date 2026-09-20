# legacy_lexical_channel 翻闸决策文档（engine-consolidation L3）

> 状态：**决策未作出，本轮默认值保持 true**。本文档为翻闸 breaking 变更的准备面。

## 翻闸含义
`specs.legacy_lexical_channel: false` 时，无注解、无 `ast:`/`lex:` 标记的 SHALL NOT 文本不再静默进入词法兜底（R2），直接落 R4 unverifiable——对含此类条目的项目即 E-SPEC-015 恒阻断（strict）/ 恒可见告警。

## Breaking 面
- 对本仓库：现余 20 条在册兜底条目（migration/gate-mapping.md 逐条归类），翻闸前须全部挂 gate/显式标记/显式 manual，否则 check 转红。
- 对下游用户：任何升级版本默认翻闸都是 schema 级行为变更——**不应搭车收口变更**，需独立 minor/major 决策与迁移指南。

## 回退路径
翻闸后单项目可 `legacy_lexical_channel: true` 退回观察态（既有配置键，行为零变化面受红线保护）。

## 建议时序
1. 后续变更建 roadmap validator / 共存门禁语料 / loader 行为语料；
2. 逐条消化 gate-mapping 在册项至 0；
3. 独立变更翻默认值，附 CHANGELOG breaking 标记与迁移命令（`mumuspec annotate` + doctor advisory 已就位）。
