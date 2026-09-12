# Test Cases — skill-plugin-standard (Layer 1: src/cli 接线)

## L1-1 漂移诊断进入 check 的 drift 数组

- Given: 存在漂移的技能副本
- When: 运行 mumuspec check --json
- Then: payload.drift.warnings 含 code 为 W-SKILL-001 的条目（ENF-10）

## L1-2 drift 源逐源隔离

- Given: skill-drift 源抛错
- When: 运行 check
- Then: 记一条 W-CHECK-002 且其余 drift 源结果存活，exit code 不受影响（不牵连）

## L1-3 ci-check 与 check 消费同一函数

- Given: scripts/ci-check.mjs 与 spec.ts 的漂移检测
- When: 静态检查二者引用同一导出
- Then: 同一 detectSkillDrift 被两处引用（无第二份实现）（ENF-10）

## L1-4 cognitive-map 命令已注册

- Given: src/cli/commands/cognitive-map.ts 导出 registerCognitiveMapCommands
- When: 构建 program 并枚举命令
- Then: 顶层命令集合含 cognitive-map，且含 init / sync 子命令（ENF-17）

## L1-5 命令模块 ↔ 注册表双向闭包

- Given: src/cli/commands/*.ts 中的 register* 导出集合
- When: 与 index.ts 的注册调用集合比对
- Then: 双向差集为空（有模块无注册即失败）（ENF-17）

## L1-6 bundle plugin 子命令产出可用包

- Given: 仓库根
- When: 运行 mumuspec bundle plugin --out <tmp>
- Then: 产出 .codebuddy-plugin/plugin.json 与 marketplace.json，且通过校验器（ENF-1）

## L1-7 install --plugin 干跑不写盘

- Given: 已构建的插件包
- When: 运行 mumuspec install --plugin --dry-run
- Then: 输出待安装路径与待登记条目，磁盘无变化（R1 风险缓解）
