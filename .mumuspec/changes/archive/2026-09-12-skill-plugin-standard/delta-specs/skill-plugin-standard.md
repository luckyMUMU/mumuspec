# Delta Spec: 技能插件标准与单一权威源

分析见 `review/skill-composition-audit-2026-09-12.md`。本变更把技能从"散装文件复制"改为"标准插件包分发"，
并借此消解漂移不可见、依赖不可满足、权威源多处三组缺陷。

清单规则取自宿主官方规范文档（`plugin-structure` 的 manifest-reference 与 `plugin-discovery` 的 marketplace-format），
下列条目均已改写为机器可判定的形式——先有校验器，再有产出物。

## Requirement: 技能分发符合宿主插件标准

技能集合以宿主既成的插件标准打包，使"一份源、一个版本、一次安装"成立。

- 单插件清单 SHALL 位于包根的 `.codebuddy-plugin/plugin.json`——该位置是宿主识别插件的唯一判定依据。
- 清单的 name SHALL 为 kebab-case 且匹配 `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`（字母开头，字母或数字结尾，仅小写字母数字与连字符）。
- 清单的 version SHALL 为语义化版本主次修订三段式，可带预发布后缀。
- 清单的 description SHALL 为 50 至 200 字符。
- 清单的 author SHALL 为含 name 的对象（可另带 email 与 url），或等价字符串形式。
- 市场清单 SHALL 位于 `.codebuddy-plugin/marketplace.json`，含 name、owner.name、plugins 数组三项必需字段。
- 市场清单的每个插件条目 SHALL 含 name、source、description；source SHALL 为以点斜杠开头的相对路径，或为含 source 字段的对象形式。
- source 为相对路径时 SHALL 指向市场根下实际存在的目录。
- 组件路径类字段（commands / agents / hooks / mcpServers）SHALL 为以点斜杠开头的相对路径，不得含上溯段，且使用正斜杠。
- 市场条目中的 category 值 SHALL 取自宿主规范枚举（development / productivity / security / testing / database / deployment / design / monitoring / learning）。
- 包内容布局 SHALL 为 `skills/<skill-name>/SKILL.md`，使宿主无需转换即可加载。
- 包版本 SHALL 取自包版本单一源（运行时包版本），不得回退到配置文件的 schema 版本或硬编码字面量。
- 产出物 SHALL 在写出前通过清单校验器，校验器覆盖本节全部可判定条目。

### SHALL NOT

- 清单中的 source SHALL NOT 指向不存在的目录。
- 组件路径 SHALL NOT 使用绝对路径、上溯段或反斜杠。
- SHALL NOT 以自研清单格式作为分发的唯一形式——宿主无法识别的格式等于不可分发。

### Enforcement

- ENF-1: enforced-strong(单元测试：生成的插件清单逐字段比对官方规则——name 正则、version 语义化、description 长度、author 形态、必需字段集)
- ENF-2: enforced-strong(单元测试：路径正负样例——以点斜杠开头的相对路径通过；绝对路径、上溯段、反斜杠、缺前缀被拒)
- ENF-3: enforced-strong(单元测试：source 指向不存在目录时校验失败)
- ENF-4: enforced-strong(单元测试：包版本等于运行时包版本，不出现硬编码回退值)
- ENF-5: manual(发布核对：产物可被宿主插件目录直接识别)

## Requirement: 插件安装可幂等且可登记

安装动作必须留下可判定的事实，且重复执行不产生漂移。

- 安装 SHALL 落到插件缓存目录的「市场名 / 插件名 / 版本」三段布局，版本段来自包版本。
- 安装 SHALL 幂等：同一版本重复安装不得产生重复条目，也不得失败退出。
- 安装 SHALL 在宿主插件登记文件中登记或更新条目，键为「插件名@市场名」，条目含 scope、installPath、version、installedAt、lastUpdated 字段。
- 安装 SHALL 在登记文件不可写或格式不可解析时 fail-closed 并给出理由，不得静默跳过登记。
- 重复安装时 SHALL 保留首次安装时间戳，仅更新末次更新时间。

### SHALL NOT

- SHALL NOT 以占位实现返回成功——动作未实现时的正确行为是失败并给出理由。
- SHALL NOT 覆盖目标位置中非本包管理的内容。

### Enforcement

- ENF-6: enforced-strong(单元测试：两次安装后登记条目数为 1；版本段等于包版本；installedAt 不变而 lastUpdated 更新)
- ENF-7: enforced-strong(单元测试：登记文件为非法 JSON 时返回失败而非成功)
- ENF-8: enforced-weak(实跑：安装后目标路径存在清单与技能文件)

## Requirement: 技能副本漂移可检测

源与安装态之间的内容差异必须由命令而非人工发现。

- 漂移检测 SHALL 比对源技能正文与安装副本正文，并在不一致时产出诊断。
- 比对 SHALL 先剥离 frontmatter 的版本字段再比较——版本戳印会使两侧必然不同，纳入比对等于把噪声当信号。
- 诊断 SHALL 接入 `mumuspec check` 的 drift 数组与 CI 检查，作为可强制（forceable）的告警。
- 漂移检测 SHALL 对自身生效：改动任一技能正文后必须产生诊断。
- 诊断 SHALL 逐技能给出源路径与安装路径，使修复动作可定位。

### SHALL NOT

- SHALL NOT 只比对存在性而不比对内容（存在即被信任）。
- SHALL NOT 让技能源目录的高频编辑与副本之间不存在任何到期校验。

### Enforcement

- ENF-9: enforced-strong(单元测试：改动源正文产生诊断；仅改动版本行不产生诊断)
- ENF-10: enforced-strong(单元测试：漂移诊断出现在 check 的 drift 数组，且 CI 检查消费同一函数)
- ENF-11: enforced-weak(实跑：修复后 `mumuspec check` 无该诊断)

## Requirement: 技能依赖声明与可满足性一致

声明的外部能力必须可枚举、可判定，缺失不得表现为不可执行的强制项。

- 技能文本中的外部能力 SHALL 分为两类：包内自足的必须步骤，与包外增强的伴随能力。
- 伴随能力的可用性 SHALL 由代码侧探测并枚举，不得由模型现场判断。
- 伴随能力缺失 SHALL 只出现在枚举清单中，不得阻断阶段流程。
- 伴随能力的替代路径 SHALL 为带编号与产出的显式步骤，而非"降级说明"。
- 枚举结果 SHALL 经命令出口暴露，使缺失集合可被前置判断而非执行中才发现。

### SHALL NOT

- SHALL NOT 声明无实体来源的必须加载项——强断言与可满足性脱钩时，断言恒为空转。
- SHALL NOT 以静默替换代替降级留痕。

### Enforcement

- ENF-12: enforced-strong(单元测试：伴随能力枚举覆盖技能文本中声明的全部外部名称，且解析结果与实际搜索面一致)
- ENF-13: enforced-weak(实跑：伴随能力全缺失时阶段流程仍可完成并留痕)

## Requirement: 技能权威源单一

同一语义只在一处维护；技能文本不得引用引擎不存在的事实。

- 阶段分发规则 SHALL 只在一处定义，其余位置引用而非复写。
- 技能文本引用的状态字段与配置键 SHALL 存在引擎消费者。
- 技能定义 SHALL 完整存在于源目录，安装副本 SHALL 为可再生的派生物。
- 技能文本引用的 CLI 命令 SHALL 与命令注册表一致（含子命令与参数签名）。
- 引擎已实现的命令模块 SHALL 注册进命令注册表——存在模块而无注册项等于无消费者，指令与实现不得互为悬空。
- 技能文本中每条确定性步骤引用的命令 SHALL 可由命令注册表现场枚举得到，使漂移可被机械检出而非人工比对。

### SHALL NOT

- SHALL NOT 保留引擎不存在的字段名作为守卫检查项。
- SHALL NOT 让同一语义的既有正确内容在迁移中丢失。
- SHALL NOT 保留未被注册的命令模块，也不得以"有测试覆盖"代替"已接线"。

### Enforcement

- ENF-14: enforced-strong(单元测试：技能文本中不出现已知幽灵字段名；分发表定义处唯一)
- ENF-15: enforced-strong(单元测试：阶段技能的守卫目标阶段合法，取值域为状态机实际边)
- ENF-16: enforced-strong(单元测试：技能文本引用的命令及其参数签名逐条命中命令注册表——含正向样例与四类已知漂移的反向样例)
- ENF-17: enforced-strong(单元测试：命令模块集合与注册表条目集合双向闭包——有模块无注册即失败)
- ENF-18: manual(内容核对：源与副本的内容差集逐条裁决为有意变更或缺陷)

## Requirement: 技能门禁强度与风险等级一致

门禁的严厉程度必须与其所防护的风险相称。

- 每个门禁 SHALL 声明其为不可跳过，或声明可降级且降级须留痕。
- 高风险门禁（安全、代码审查、调试前置）SHALL 不得存在无条件逃逸口。
- 相邻的人工确认点 SHALL 在保持选项集不变的前提下合并为一次询问。

### SHALL NOT

- SHALL NOT 以"技能不可用"为由静默跳过高风险门禁。
- SHALL NOT 因合并询问而减少用户可选项或自动选默认值。

### Enforcement

- ENF-19: enforced-strong(单元测试：高风险门禁段落不含无条件跳过表述)
- ENF-20: manual(评审核对：合并后的确认点选项集为原选项集的并集)
