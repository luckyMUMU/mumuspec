---
scope: docs/reference/skills
layer: 3
---
# Product Requirements: skills reference

## 模块职责
skills 子目录是 MumuSpec 原生 Skill 文件的详细设计规范集合（Level 3）。
它为 7+1 个原生 Skill（主编排器 + 5 阶段 Skill + hotfix/tweak 预设）
提供逐一深入的设计优化文档，参考 Comet、OpenSpec、Superpowers 三大体系的最佳实践。

## 存在理由
skills/ 目录中的 Skill 文件是执行体（Markdown 格式的 AI 指令），
而本目录的设计规范文档解释"为什么这样设计每个 Skill"以及"如何优化"。
它帮助 Skill 作者理解统一结构模板、阻塞点全局清单、状态机字段参考，
也帮助贡献者遵循一致的模式开发新的 Skill。

## 用户场景
1. **Skill 作者学习规范**：阅读 mumuspec.md 索引文档了解设计原则与统一结构模板
2. **理解阶段 Skill 设计**：阅读 mumuspec-open.md / mumuspec-design.md 等了解各阶段 Skill 的优化设计
3. **查阅阻塞点**：阅读 mumuspec.md 的阻塞点全局清单（BP-1 到 BP-18）
4. **理解状态机字段**：查阅 .mumuspec.yaml 核心字段参考
5. **对比优化前后**：阅读优化对比矩阵了解从三大参考体系借鉴的核心模式

## 验收标准
- mumuspec.md 提供索引入口，包含设计原则（从 Comet/OpenSpec/Superpowers 借鉴）
- 7+1 个 Skill 各有独立设计文档（mumuspec/open/design/build/verify/archive/hotfix/tweak）
- 统一 Skill 结构模板定义 10 个必选章节
- 阻塞点全局清单覆盖 BP-1 到 BP-18，标注所在阶段与适用工作流
- README.md 提供子目录导航与文件清单
