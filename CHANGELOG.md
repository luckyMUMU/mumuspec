# Changelog

All notable changes to MumuSpec are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.0-beta.0] - 2026-08-01

### Added
- Mode-aware Guard 层:检测到不同运行环境(Claude Code / Cursor / CatPaw)时,自动调整 MCP 工具与 Rules 文件输出。
- Spec Scaffolder:初始化时基于项目分析结果,按目录结构自动生成分布式 prd.md / tech.md 文档。
- Git 命令封装 (`mumuspec git commit/flow/push/tag`):git-master 风格的一站式 git 操作,内置状态校验。
- Dashboard 命令 (`mumuspec dashboard`):实时查看活跃变更、状态机位置与历史指标。
- Spec Incremental Diff (`mumuspec search`):正则表达式搜索代码/规范节点。

### Changed
- 初始化流程重构 (`2026-08-01-refactor-init-and-archive`):整合项目分析、自动导入现有文档/第三方规范、环境检测知识页面生成等步骤。
- 归档流程重构 (`2026-08-01-refactor-init-and-archive`):新增 `finalize-archive` 命令用于归档后清理(合并规范、更新索引、清理缓存)。
- 知识层持久化重构 (`2026-08-01-refactor-persistent-spec`):`loadSpecContext` 增加缓存与增量更新;变更归档后知识可持久化落盘。
- 移除 package.json 中的 `bundledDependencies`,`workspaces` 字段,与 monorepo 的 npm 全局安装无关配置。
- Design 阶段增强 (`2026-08-01-enhance-design-phase`):引入 Hyperplan 对抗式设计评审流程;Design Skill 增加 cognitive-map.yaml 产出要求。

### Fixed
- Spec 继承加载器修复重复解析同一文件问题。
- 零依赖模块 `src/i18n/locales.ts` 误用 `import type` 跨包引用错误。
- `mumuspec context` 在 Windows 路径分隔符场景下上下文层级判定错误。

## [0.15.0-alpha.2] - 2026-08-01

### Added
- TypeScript 严格性补全启用 `noImplicitReturns` 与 `noFallthroughCasesInSwitch`,与原有
  `noUnusedLocals`/`noUnusedParameters` 组成完整严格性家族。
- CLI 子命令参数校验 (`feedback submit/update`、`guard`、`state transition`)
  在调用核心函数前显式验证,替换原有的 `as any` 断言。

### Changed
- 移除 package.json 中自引用依赖 (`"mumuspec": "file:..."`)。
- 拆分 `src/change/manager.ts` (1212 行) 为 paths / listing / state / lifecycle / archive / decisions 六个子模块 + 转发 hub。
- 拆分 `src/knowledge/manager.ts` (977 行) 为 pages / index / freshness / analysis / organize 五个子模块 + 转发 hub。
- 修复 `src/change` ↔ `src/feedback` 循环依赖:feedback 改为直接从 `change/paths.js` 导入。

### Fixed
- 修复 `.mumuspec/index.yaml` 顶层重复的 `skills` 与 `feedback` 键。
- 修复零依赖模块 `src/core/env-detector.ts` 中误导入 yaml 库的问题。
- TypeScript 严格模式迁移:修复 24 个源文件中 81 处未使用变量/参数警告。

### Removed
- 清理根目录残留的 `mumuspec-0.13.0-alpha.1.tgz` 打包产物。
- 所有 7 处 `as any` 类型断言,改为精确的类型标注 (`as ChangePhase`、`as SubmitFeedbackOptions['type']` 等)。

## [0.13.0-alpha.2] - 2026-07-15

> ⚠ 此版本未发布到 npm,仅作为开发快照存在。

### Added
- 动态约束强度系统: 新增 `constraint_strength` 顶层配置字段,支持
  `technical_design` 与 `requirement_goals` 两个维度,每维 `high`/`medium`/`low` 三档。
- 树状分层约束解析: `resolveConstraintTree` 纯函数,支持 `.mumuspec/constraints.yaml`
  在目录树中分层声明、跳层继承、收紧验证。
- Bundle-based skill 系统: 14 个内置技能 (前端、后端、测试、DevOps) 通过 `mumuspec skills install/load` 分发。
- Env Detector: OS 检测、shell 识别、敏感环境变量过滤。
- Init Generator: 从 ESM/CJS monorepo 模板新建项目。
- Project Analyzer: 技术栈探测、目录结构评估。
- Doc Importer: 从现有 README/design 文档导入生成 spec。
- Knowledge base 扩展: imports/rationales/lessons/risks 四个新类型,imports 子目录 28 条存量导入。
- 14 个 src 模块内嵌 .mumuspec/{prd,spec,tech,design} 文档。
- 打包部署文档、用户反馈与 session 摘要流程、预发布版本管理脚本。
- package.json 新增 `files`/`publishConfig`/`homepage`/`repository`/`bugs` 字段。

### Changed
- 测试套件扩展至 13 文件 / 204 用例,覆盖 env/git/knowledge/parser/constraint 等模块。
- 版本号从 `0.10.0` 提升至 `0.13.0-alpha.2`。

## [0.10.0] - 2026-07-10

### Added
- 初始 MVP 设计: 六层架构 (Spec / Change / Guard / Knowledge / Contract / AI Integration)
- 树状分布双向约束 (SHALL / SHALL NOT)
- Ponytail 编码约束 (7 级优先级阶梯)
- 五阶段变更状态机 (Open → Design → Build → Verify → Archive)
- 知识层 (LLM-Wiki + PageIndex)
- MCP Server 与 CLI 入口
- demo 项目 (task-api) 演示完整流程

[Unreleased]: https://github.com/mumuspec/mumuspec/compare/v0.15.0-beta.0...HEAD
[0.15.0-beta.0]: https://github.com/mumuspec/mumuspec/compare/v0.15.0-alpha.2...v0.15.0-beta.0
[0.15.0-alpha.2]: https://github.com/mumuspec/mumuspec/compare/v0.13.0-alpha.2...v0.15.0-alpha.2
[0.13.0-alpha.2]: https://github.com/mumuspec/mumuspec/compare/v0.10.0...v0.13.0-alpha.2
[0.10.0]: https://github.com/mumuspec/mumuspec/releases/tag/v0.10.0
