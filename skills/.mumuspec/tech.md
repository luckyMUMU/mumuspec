---
scope: skills
layer: 1
---
# Technical Design: skills

## SHALL
- Skill 文件必须包含 YAML frontmatter（name, description, phase, workflow）
- 编排器（mumuspec.md）必须包含快速决策区块（阻塞点清单 + 自动阶段检测流程）
- 阶段 Skill 必须包含 10 个统一结构章节（Frontmatter → 领域 Skill 提示）
- workflow.yaml 必须定义编排器入口、阶段 Skill 定义、预设路径与横切关注点
- 阻塞点使用统一编号（BP-N），标注所在阶段与适用工作流
- 所有操作必须幂等可安全重执行

## SHALL NOT
- 禁止 Skill 文件包含具体代码实现（Skill 管 HOW 指导，代码在 src/ 中）
- 禁止外部 Skill 跳过 MumuSpec SHALL NOT 约束（约束优先级 > Skill 指导）
- 禁止预设路径跳过红绿 TDD 循环（TDD 不可豁免）

## 架构决策
- **grill me 风格编排**：一个命令感知全状态，一键驱动全生命周期
- **WHAT/HOW 分离**：MumuSpec 管 WHAT（约束），外部 Skill 管 HOW（实现方法）
- **统一结构模板**：所有 Skill 遵循 10 章节结构，保证一致性与可维护性
- **预设路径**：hotfix/tweak 跳过 Design，但保留 TDD 强制与测试不可变性
- **优先级体系**：用户指令 > SHALL NOT > SHALL > 外部 Skill > 默认行为

## 依赖关系
- workflow.yaml 引用各阶段 Skill 文件
- 编排器调用 mumuspec status/list/doctor 命令（src/cli/）
- 阶段 Skill 调用 mumuspec guard 命令（src/guard/）
- workflow-presets.md 引用 phase-guard.ts 的预设路径守卫
- 子目录：en/（英文版）、mumuspec-workflow/（扩展 Skill）、my-custom-skill/（自定义示例）
