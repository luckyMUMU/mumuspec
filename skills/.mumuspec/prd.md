---
scope: skills
layer: 1
---
# Product Requirements: skills

## 模块职责
skills 目录是 MumuSpec 原生 Skill 文件集合，作为 AI 开发者的阶段编排器入口。
它提供 grill me 风格的一站式编排器（mumuspec.md）与五阶段 Skill（open/design/build/verify/archive），
以及 hotfix/tweak 预设路径，让 AI 通过 Skill 驱动完成规范驱动的开发工作流。

## 存在理由
AI 开发者需要结构化的指令来执行五阶段工作流。散乱的 prompt 导致行为不一致。
skills 目录通过统一的 Skill 文件格式（Frontmatter + 决策核心 + 执行步骤 + 阻塞点 + 退出条件），
让 AI 感知全状态、一键驱动全生命周期，并在每个阶段分发到外部 Skill 生态获取 HOW 指导。

## 用户场景
1. **启动工作流**：AI 读取 mumuspec.md 编排器，自动检测项目状态与变更阶段
2. **需求探索**：分发到 phase-open.md，执行需求澄清、变更创建、worktree 隔离
3. **技术设计**：分发到 phase-design.md，执行认知框架、自顶向下设计、测试锁定
4. **TDD 实现**：分发到 phase-build.md，执行自下向上实现、红绿 TDD、Ponytail 检查
5. **验证审查**：分发到 phase-verify.md，执行规范校验、漂移检测、分支处理
6. **归档收尾**：分发到 phase-archive.md，执行 Git 合并、规范归档、知识提取
7. **预设路径**：hotfix/tweak 跳过 Design，走轻量路径但保留 TDD 强制

## 验收标准
- mumuspec.md 是主编排器入口，包含自动阶段检测流程与阶段分发表
- 5 个阶段 Skill（phase-open/design/build/verify/archive）各含执行步骤与 Phase Guard 调用
- workflow.yaml 定义编排配置、阶段 Skill 定义、预设路径与横切关注点
- workflow-presets.md 定义 hotfix/tweak 预设路径与升级条件
- en/ 子目录提供英文版 Skill 文件
- mumuspec-workflow/ 与 my-custom-skill/ 提供扩展 Skill 示例
