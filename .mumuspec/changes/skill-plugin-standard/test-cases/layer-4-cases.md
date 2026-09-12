# Test Cases — skill-plugin-standard (Layer 4: 技能文本 + 端到端)

## L0-1 幽灵字段名零命中

- Given: skills/** 全部文本
- When: 检索已知幽灵字段名（design_layers_covered / each_layer_shall_defined /
  build_layers_completed_in_bottom_up_order / ponytail_constraints_defined /
  ponytail_compliance_checked / subagent_dispatch）
- Then: 命中数为 0（ENF-14）

## L0-2 阶段技能的守卫目标阶段合法

- Given: 5 份 phase 技能与 workflow-presets 中的 guard 调用
- When: 提取 <phase> 实参并与状态机边比对
- Then: 全部为**目标**阶段（open→design|build、design→build、build→verify、
  verify→archive-in-progress），无一处填当前阶段（ENF-15）

## L0-3 技能文本引用的命令与签名命中注册表

- Given: 技能文本中出现的 mumuspec 命令与参数
- When: 与命令注册表逐条比对
- Then: 全部命中；四类已知漂移（state check 的多余 phase 参数、contract list --scopes
  带值、knowledge context 缺 path、cognitive-map 未注册）均已消失（ENF-16）

## L0-4 代码审查门禁无无条件逃逸口

- Given: phase-build 的代码审查门禁段落
- When: 检索无条件跳过表述
- Then: 不含"若 skill 不可用则跳过"这类表述；高风险门禁改为自审并留痕（ENF-19）

## L0-5 tweak 静默失败陷阱段在位

- Given: skills/mumuspec/workflow-presets/SKILL.md
- When: 检索补救命令
- Then: 含 finalize-archive --keep-old 与"tweak 跳过合并且不报错"的说明（内容未丢失）

## L0-6 编排器分发表定义处唯一

- Given: skills/** 中描述阶段分发规则的文件
- When: 计数
- Then: 为 1（其余位置引用而非复写）（ENF-14）

## L0-7 publish 未实现时 fail-closed

- Given: 调用 publishBundle
- When: 能力未实现
- Then: 返回 success:false 并给出理由（E-BUNDLE-001），不再假成功

## L0-8 端到端自检三件套

- Given: 完成本变更实现后的仓库
- When: 依次运行 mumuspec check / mumuspec validate / npm run ci:check
- Then: check exit 0；validate unverifiable 为 0；ci:check 0 error 0 warning
