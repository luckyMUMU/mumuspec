# Proposal: skill-plugin-standard

## Why

2026-09-12 的技能组合评价（`review/skill-composition-audit-2026-09-12.md`）确认三条结构性缺陷，它们指向**同一个解法**：

1. **技能副本是单向快照，且漂移不可见。** `installer-ops.ts:338-340` 遇已存在即失败（需 `--force`），副本没有"过期"状态；`stampSkillVersion()`（`installer-ops.ts:346`）把两侧 frontmatter 的 `metadata.version` 都写成运行时包版本，于是 **7/7 已安装件与源内容不一致，版本号却完全一致**——版本号从提示项变成了误导项。自检三件套（check / validate / ci:check）均不覆盖该比对。
2. **声明的 required 依赖可达率 0/28。** 穷举扫描 50,508 文件确认：11 个只在市场目录（市场目录 ≠ 已安装），17 个无任何来源（含 `grill-me`、`hyperplan`）。而技能文本写着"跳过此步骤被禁止"——**强断言在物理上不可执行**，实际 100% 走 fallback，且降级不留痕。
3. **技能分发没有标准。** `src/bundle/packager.ts` 是自研格式（面向不存在的 `.mumuspec/skills/`、版本回退硬编码 `'0.12.2'`），且 `publishBundle` 是占位实现却返回成功——正是项目红线所禁的 fail-open。

宿主平台已有既成事实的插件标准（`.codebuddy-plugin/plugin.json` + `marketplace.json` + `skills/<name>/SKILL.md` 布局 + `plugins/cache/<marketplace>/<plugin>/<version>/` 落盘 + `installed_plugins.json` 登记）。**采用该标准可一次消解三条缺陷**：整包安装使"单一权威源"成立，包版本使漂移可比对，包内自足使 required/companion 的边界可声明、可校验。

## What

**一、技能分发与安装符合宿主插件标准（产出侧 + 安装侧）**

- 产出侧：生成 `.codebuddy-plugin/plugin.json` 与 `marketplace.json`，内容布局为 `skills/<name>/SKILL.md`，版本取自包版本单一源。
- 安装侧：安装到 `plugins/cache/<marketplace>/<plugin>/<version>/`，并幂等登记 `installed_plugins.json`（v2，key 为 `name@marketplace`）。
- 退役自研 bundle 格式中无消费者的部分；`publishBundle` 的占位实现改为 fail-closed。

**二、技能副本漂移可检测（P0-1）**

新增漂移检测，比对源与已安装态，**比对前剥离 frontmatter 版本行**（因版本戳印必然造成差异），结论接入 `mumuspec check` 的 drift 数组与 `ci:check`。

**三、清除幽灵字段三态（P0-2）**

`phase-design/SKILL.md:478`、`phase-open/SKILL.md:340` 的 Red Flags 与 `workflow.yaml:424-427` 仍在引用引擎不存在的字段，而同文件正文已声明删除。逐条裁决为**删**（职责已由 `mumuspec new` / `mumuspec check` 的独立通道承担）。

**四、编排器单源化（P0-3）**

"阶段分发规则"当前有四处定义（中文编排器 / 英文精简版 / `orchestrator-en.md` / `workflow.yaml`）。收敛为：入口唯一（入装编排器承载决策核），中文丰富版降为被引用的资源文件。

**五、依赖声明与可满足性一致（P1-1）**

把 `required: true` 拆为两类——**required**（包内自足、必须执行）与 **companion**（外部增强、可用则用）。companion 的存在性由代码侧探测并枚举（引擎归代码），fallback 从"降级说明"升格为**带编号与产出的显式步骤**，使每次执行留痕。

**六、门禁纪律与文本自洽（P1-2 / P1-3 / P2-1）**

- 收口代码审查门禁唯一的无条件逃逸口（风险更高的 TDD/调试门禁写"跳过被禁止"，风险最高的代码审查反而可静默跳过——强度与风险倒挂）。
- 回填 tweak 静默失败陷阱段（源缺失、旧副本尚存，属内容丢失）。
- 合并相邻阻塞点 BP-9 与 BP-10，减少一次用户往返（仍须显式确认，不得自动选择）。

**七、纪律固化为守卫测试（P2-2）**

新增技能注册表测试：守卫目标阶段合法性、安装包与源路径可命中、已知幽灵字段名不出现在技能文本中。

## Impact Scope

- `src/bundle/` — 插件标准产出（新增清单生成；退役自研格式的死端）
- `src/install/` — 安装目标布局、`installed_plugins.json` 登记、companion 探测
- `src/guard/` — 技能漂移检测（新 drift 源）
- `src/cli/commands/` — bundle / install / check / skill 子命令面
- `skills/mumuspec/**` — 全部技能源文本（单源化、幽灵字段、门禁纪律、tweak 陷阱）
- `.mumuspec/constraints.yaml` — 新约束登记（source_specs 指向新 Requirement）
- `scripts/ci-check.mjs` — 漂移检测进 CI
- `tests/bundle/`、`tests/install/`、`tests/guard/` — 新增与改写

## 非目标

- 不改 18 个人工阻塞点的**存在性**（摩擦是"设计决策权在人"的代价）；仅合并相邻两项。
- 不裁剪平台插件池中与本项目无关的插件（共享资源，无关 ≠ 污染）。
- 不重命名遗留 `E-` 前缀告警码（既有惯例 14 例，属破坏性变更）。
- 不引入"自动重装技能"钩子（会绕过 install 的不覆盖纪律，并把副作用放进不可见时机）。
- 不把市场目录里那 11 件外部 skill 装进包内充数（已安装依赖可做的不引新依赖；且缺失的共识门不在其中）。

## 关键未知

- 安装侧写入宿主 `installed_plugins.json` 是否会被宿主接受（无官方文档，仅磁盘实证）；若无把握，退化为"产出侧 + 独立目录安装 + 报告待手工登记"。
- companion 探测的搜索面（当前实测路径集 + 市场目录）是否稳定。
- 包版本与 `metadata.version` 戳印的关系：改用包清单作版本单一源后，戳印是否仍需保留。

## 验收场景

- **S1**：产出插件包后，`.codebuddy-plugin/plugin.json` 与 `marketplace.json` 均存在，且字段符合平台清单（逐字段比对宿主既有清单样例）。
- **S2**：安装后 `plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md` 存在；重跑安装幂等，`installed_plugins.json` 不产生重复条目。
- **S3**：改动源中任一技能正文一行后，`mumuspec check` 必须出现技能漂移告警（**新建的检查必须对自身生效**）；仅改动 frontmatter 版本行时不得报警。
- **S4**：`mumuspec` 技能文本中不再出现已知幽灵字段名；`workflow.yaml` 的 `open_to_design` 检查项与引擎实际读取的字段集合一致。
- **S5**：companion 枚举能列出全部外部声明及其解析结果；不存在的 companion 只出现在枚举清单中，且不阻断流程。
- **S6**：技能注册表守卫测试通过——把任一阶段技能的守卫目标阶段改回当前阶段时，测试必须失败。

## Workflow

full
