# Test Cases — skill-plugin-standard (Layer 2: src/install ∥ src/guard)

## L2-1 安装幂等（登记条目唯一）

- Given: 同一插件包、同一版本安装两次
- When: 读取登记文件
- Then: 键 <plugin>@<market> 的数组长度为 1（ENF-6）

## L2-2 重复安装保留 installedAt 并更新 lastUpdated

- Given: 首次安装后人为推进时钟再次安装
- When: 读取登记条目
- Then: installedAt 与首次相同，lastUpdated 更新（ENF-6）

## L2-3 登记文件非法 JSON 时 fail-closed

- Given: 登记文件内容为 "{ broken"
- When: 调用 installPluginPackage
- Then: 返回 ok:false 且 error 给出理由；不抛未捕获异常、不静默跳过（ENF-7）

## L2-4 安装落到三段布局

- Given: marketplaceName=mumuspec、pluginName=mumuspec、version=X
- When: 安装完成
- Then: cacheRoot/mumuspec/mumuspec/X/.codebuddy-plugin/plugin.json 与 skills/ 均存在（ENF-8）

## L2-5 漂移检测：改正文必报

- Given: 一对 {sourcePath, installPath}，副本正文少一行
- When: detectSkillDrift(pairs)
- Then: 产出一条 code 为 W-SKILL-001 的诊断，含源与安装双路径（ENF-9）

## L2-6 漂移检测：仅改版本行必不报

- Given: 两侧正文一致，仅 frontmatter 的 metadata.version 不同
- When: detectSkillDrift(pairs)
- Then: 无诊断（剥离版本行生效）（ENF-9）

## L2-7 stripFrontmatterVersion 只动版本行

- Given: 含 name/description/metadata.version 的 frontmatter
- When: 调用 stripFrontmatterVersion
- Then: 仅版本行被移除，其余字节不变

## L2-8 伴随能力枚举覆盖技能文本声明的全部外部名称

- Given: 从 skills/** 提取的外部能力名称集合
- When: resolveCompanions()
- Then: 输出项集合等于声明集合；缺失项 resolved 为 null 且不抛错（ENF-12）
