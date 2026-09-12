# Test Cases — skill-plugin-standard (Layer 3: src/bundle 清单校验器)

## L3-1 name 正则正负样例

- Given: 候选 name 集合（api-tester / API Tester / code_review / -git-workflow / test- / 9lives）
- When: 调用 validatePluginManifest
- Then: 仅 api-tester 通过；其余各产出一条 name 规则违例（ENF-1）

## L3-2 version 必须语义化

- Given: version 为 "1.0" 与 "1.0.0-alpha.1"
- When: 校验
- Then: "1.0" 违例；"1.0.0-alpha.1" 通过（ENF-1）

## L3-3 description 长度边界

- Given: description 分别为 30 / 80 / 260 字符
- When: 校验
- Then: 30 与 260 违例，80 通过（ENF-1）

## L3-4 author 双形态

- Given: author 为 {name} 对象、纯字符串、缺 name 的对象
- When: 校验
- Then: 前两者通过，第三者违例（ENF-1）

## L3-5 组件路径正负样例

- Given: commands 取值 "./commands" / "commands" / "../shared" / "/abs" / ".\\commands"
- When: 校验
- Then: 仅 "./commands" 通过；其余违例（ENF-2）

## L3-6 source 必须指向存在目录

- Given: 市场条目 source 指向存在目录与不存在目录
- When: validateMarketplaceManifest({ marketplaceRoot })
- Then: 前者通过，后者产出 source 违例（ENF-3）

## L3-7 category 取规范枚举

- Given: category 为 "development" 与 "misc"
- When: 校验市场条目
- Then: 前者通过，"misc" 违例（ENF-1）

## L3-8 包版本无硬编码回退

- Given: 运行时包版本为 X
- When: 构建清单
- Then: 清单 version === X；源码中不出现 '0.12.2' 之类的硬编码回退（ENF-4）
