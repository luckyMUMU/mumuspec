---
id: KE-skill-plugin-standard-lessons
title: Lessons from skill-plugin-standard decisions
type: lesson
status: confirmed
scope: skill-plugin-standard
created_at: 2026-09-12
tags:
  - auto-extracted
  - lesson
  - decisions
  - skill-plugin-standard
graph_bindings: []
---
> Auto-extracted from skill-plugin-standard/decisions.md

# Decision Log: skill-plugin-standard


## [open] 2026-09-12T15:43:59.473Z

范围裁决：用户选定 全量 P0+P1+P2 + 插件标准（产出侧+安装侧），workflow=full。变更名 skill-plugin-standard 由本次登记提请确认（用户未指定名，取既有 kebab-case 命名惯例）。

## [open] 2026-09-12T15:44:00.569Z

插件标准取自磁盘实证而非猜测：单插件清单 .codebuddy-plugin/plugin.json（name/version/description/description_en/author/repository/homepage/license/keywords）；市场清单 .codebuddy-plugin/marketplace.json（name/description/owner/plugins[].source 相对路径）；内容布局 skills/<name>/SKILL.md、agents、commands、hooks、rules、mcp；落盘 plugins/cache/<marketplace>/<plugin>/<version>/；登记 plugins/installed_plugins.json（version 2，键 name@marketplace）。仓库内无任何既有实现（grep plugin.json/codebuddy-plugin 全库仅命中本次评审报告）。

## [open] 2026-09-12T15:44:01.666Z

Open 阶段新发现两处（不在本变更范围，记录待立项）：D-new-1 contract compat-check 系统性假阳性——src/cli/commands/contract.ts:203 的 idPattern = /\b[A-Z]{2,8}-\d{1,4}\b/g 把变更目录内任何 XXX-N 记号当作契约 ID，于是 ENF-1..16（Enforcement 约定）、BP-9/BP-10（阻塞点编号）、错误码（如 SPEC-015/SKILL-001 片段）全被判为未注册契约，本变更实测 18 条问题全为假阳性。与 60 条 E-GUARD-003 同族：约定无关的模式套在合法含有其它 ID 约定的文本上。D-new-2 技能文本与命令注册表漂移——phase-open 与 workflow-presets 写 contract list --scopes 后接值，而注册表中 --scopes 是无值布尔开关（--help 实证），照做会报 too many arguments；同类漂移还有 knowledge context 缺 path 位置参数。二者均为约束 TD-F-002（skill 指令引用的 CLI 命令必须与命令注册表一致）的现存违反，正是本变更 P2-2 守卫测试要拦截的对象。

## [open] 2026-09-12T15:44:02.773Z

设计裁决（Open 阶段预置，待 Design 阶段确认）：一、交付形态取新增并行路径而非替换——保留 createBundle/validateBundle/installBundle 既有语义以限制爆炸半径，仅 publishBundle 由占位成功改 fail-closed。二、插件包成为分发唯一形式的判定依据是宿主可识别，自研描述符降为内部工件。三、P0-3 编排器单源化在插件包语境下自然收敛：包内含 skills/<name>/SKILL.md 全部技能，入口唯一（入装编排器承载决策核），中文丰富版降为被引用的资源文件，阶段分发规则定义处由四处收敛为一处。四、漂移检测接入点唯一且已就绪：src/cli/commands/spec.ts:325-330 的 driftSources 数组，逐源隔离已在 :331-343 实现，新源抛错只记 W-CHECK-002 不牵连其它源。五、新码 W-SKILL-001 必须注册进 src/core/errors.ts 的 ERROR_CODES，否则静默回退且生成文档不收录。

## [open] 2026-09-12T15:44:03.919Z

插件规范来源升级为官方文档：宿主市场内 plugin-dev 插件含 plugin-structure 技能，其 references/manifest-reference.md 给出完整清单规范（必需位置 .codebuddy-plugin/plugin.json；name 必需且匹配 ^[a-z][a-z0-9]*(-[a-z