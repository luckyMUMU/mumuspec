# Delta Spec: TraeCode / TraeWork agent 支持与 AGENTS.md 规则分发

`trae` 重命名为 `traecode` 并新增 `traework`，两者获得完整 install 支持。TraeCode 与 TraeWork 桌面版均读取项目根 AGENTS.md 与 `.trae/skills/` 目录，因此两者采用同一套技能目录约定与 canonical AGENTS.md 分发。

下列条目均为机器可判定形式，或有显式人工通道声明。

## Requirement: traecode / traework 完整安装支持

Enforcement: 见下方 ### Enforcement 清单（ITA-1 / ITA-2）

### SHALL

- SHALL 使 `traecode` 与 `traework` 均为合法 AgentType，并具备完整 manifest 与 install policy（generic、skill-dir 布局）。
- SHALL 使 traecode / traework 在 workspace 目标安装时联动生成或更新项目根 AGENTS.md（复用 renderRuleFiles 三态策略与 managed 标记）。
- SHALL 使 traecode / traework 的项目技能目录为 `.trae/skills/<skill>/SKILL.md`，与 Trae 官方约定一致。

### SHALL NOT

- SHALL NOT 在迁移后保留 `trae` 的幽灵引用（AgentType、子命令、测试、文档须一次性替换为 traecode/traework）。
- SHALL NOT 为 traecode / traework 引入 registry 之外的 agent-specific 逻辑（保持数据驱动）。

### Enforcement

- ITA-1: manual(代码审阅：AgentType/manifest/policies/rule-targets/conventions 五处同步，无残留 `'trae'` 字面量)
- ITA-2: unit-tests(rules-generator 对 traecode/traework 渲染非空 AGENTS.md plan；installer-ops 的 conventions 表含两新值)
