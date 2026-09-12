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

插件规范来源升级为官方文档：宿主市场内 plugin-dev 插件含 plugin-structure 技能，其 references/manifest-reference.md 给出完整清单规范（必需位置 .codebuddy-plugin/plugin.json；name 必需且匹配 ^[a-z][a-z0-9]*(-[a-z0-9]+)*$；version 语义化主次修订默认 0.1.0；description 建议 50-200 字符；author 为含 name 对象或字符串；组件路径 commands/agents/hooks/mcpServers 必须以点斜杠开头、不得含上溯段、必须正斜杠；默认发现目录 scope 为 commands agents skills hooks/hooks.json .mcp.json；加载时校验 name 格式、语义化版本、相对路径、URL、引用路径存在性）。plugin-finder 插件的 marketplace-format.md 给出市场清单规范（name/owner.name/plugins 必需；条目必需 name/source/description；source 三种形态：相对路径、github 对象、git 对象含 branch/tag；category 九项枚举；strict 默认 true 表示要求独立 plugin.json）与 installed_plugins.json 结构（version 2，键 插件名@市场名，条目含 scope/installPath/version/installedAt/lastUpdated，允许同插件多版本多 scope 并存）。据此把 delta-spec 第一条 Requirement 由样例反推的宽泛表述改写为 13 条可判定规则并配 ENF-1..5 校验器要求，ENF 编号整体顺延至 ENF-18。

## [design] 2026-09-12T15:50:03.671Z

Design 阶段决策裁决（覆盖 D1-D6，并闭合三个开放问题）：D1 交付形态取新增并行路径不替换既有 bundle 语义；D2 分发唯一形式以宿主可识别为准，自研描述符降为内部工件；D3 编排器单源化——包内含全部技能、入口唯一、中文丰富版降为被引用资源；D4 漂移检测接入点唯一取 spec.ts 的 driftSources 数组；D5 注册已实现但未接线的 cognitive-map 命令（实现它，而非改文本迁就）；D6 修正全部四类命令签名漂移（state check 的 phase 参数、cognitive-map 未注册、contract list --scopes 无值、knowledge context 缺 path）。OQ-1 安装侧写宿主登记文件：默认写入并新增 dry-run，失败 fail-closed 不静默；OQ-2 cognitive-map 处置：注册命令（用户裁决）；OQ-3 frontmatter 版本戳印：保留戳印但漂移比对剥离版本行——戳印服务宿主侧可读性，剥离服务比对正确性，两者不冲突。

## [build] 2026-09-12T16:20:49.675Z

Build 阶段裁决：一、分层编号方向以引擎为准——state layer 的自下而上校验把 L0 当作最底层（拒绝低层未完成先置高层 done），故 build_layers 重编号为 L0 src/core、L1 src/bundle、L2 src/install∥src/guard、L3 src/cli、L4 根层；原编号方向相反属我方约定错误，不加 --force 绕过。二、测试用例文件按同一语义换位并重新锁定。三、接受的假设见 assumptions.yaml（AS-1..AS-7），其中 AS-1（宿主登记文件结构仅有磁盘实证、无官方文档）为残余风险，以 dry-run 与 fail-closed 兜底。

## [verify] 2026-09-12T16:41:37.434Z

Verify 阶段结论：pass，无 CRITICAL、无接受偏差。全部维度实跑通过（check exit 0 / validate unverifiable=0 / drift 0 error 0 warn / graph verify 通过 / test-cases verify 通过 / contract verify 无 critical drift / knowledge 全 fresh / vitest 271 文件全通过 / ci:check 0 error 0 warning）。分支隔离降级记录：isolation=branch 与 branch=mumuspec/skill-plugin-standard 已声明，但该分支实际从未建立，四个提交全部落在 master，隔离降级为就地开发（本平台 git 无法自建嵌套 ref 目录，属已知环境约束）。影响：产物正确性不受影响，但削弱变更隔离防线——期间另一路进程的 git add -A 曾把本变更在途工件扫入其提交并因 merge 静默回退本变更未提交编辑（本轮实际发生两次）。处置：branch_status 置 handled，不做事后补分支（重写已合并提交风险大于收益）。后续建议：isolation 声明缺少与真实 HEAD 的一致性校验，应独立立项。Verify 阶段另发现并修复 9 处 flag 级命令签名漂移（validate --change / drift detect / check --change / test-cases {lock,hash,verify} --change），并新增参数签名守卫断言，使该类缺陷此后可被机械拦住。
