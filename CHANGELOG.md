# Changelog

All notable changes to MumuSpec are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 动态约束强度系统 (0.12.0+): 新增 `constraint_strength` 顶层配置字段,支持
  `technical_design` 与 `requirement_goals` 两个维度,每维 `high`/`medium`/`low`
  三档,驱动工作流规则与系统特性的渐进式放开。详见
  [docs/design/constraint-strength.md](docs/design/constraint-strength.md)。
- 树状分层约束解析 (0.12.1+): 新增 `resolveConstraintTree` 与相关纯函数,
  支持 `.mumuspec/constraints.yaml` 在目录树中分层声明、跳层继承、收紧验证。
- 打包部署文档: 新增 [docs/reference/packaging-deployment.md](docs/reference/packaging-deployment.md),
  覆盖构建产物结构、files 白名单、版本号脚本、CI/CD 配置、本地试发布流程、
  用户安装方式、本地另一项目使用 (npm link / npm pack / file: 协议 / 直接 node 调用)、
  故障排查 (含 npm link duplicate 依赖、Windows 权限等)。
- 用户反馈与 session 摘要流程: 新增 [docs/reference/feedback-process.md](docs/reference/feedback-process.md)
  与 `feedback/` 目录结构,定义两条反馈通道 (用户反馈 / AI Agent session 摘要)
  的提交模板、处理流程、月度聚合、STATUS.md 同步机制。
- 预发布版本管理脚本: 新增 [scripts/bump-prerelease.mjs](scripts/bump-prerelease.mjs)
  支持 `alpha`/`beta`/`rc` 标签的递增与切换;新增 [scripts/prebuild-check.mjs](scripts/prebuild-check.mjs)
  在构建前校验 package.json 与 src/cli.ts 版本号同步、bin 源文件存在。
- package.json: 新增 `files`/`publishConfig`/`homepage`/`repository`/`bugs` 字段,
  新增 `version:alpha|beta|rc`、`release:next|latest|dry`、`dist-tag:*` 脚本。

### Changed
- package.json 版本号从 `0.10.0` 提升至 `0.12.1-alpha.0`,与设计文档 (overview.md
  0.12.1-draft) 对齐。
- [src/cli.ts](src/cli.ts) `--version` 输出同步至 `0.12.1-alpha.0`。
- 发布流程改为通过 `release:next` (npm `--tag next`) 与 `release:latest` (`--tag latest`)
  双通道分发,与 [release-strategy.md](docs/reference/release-strategy.md) 灰度策略对齐。

### Removed
- 移除 `prepublishOnly` 中冗余的 `npm run build` 调用 (已由 `prepack` 钩子覆盖)。

## [0.10.0] - 2026-07-10

### Added
- 初始 MVP 设计: 六层架构 (Spec / Change / Guard / Knowledge / Contract / AI Integration)
- 树状分布双向约束 (SHALL / SHALL NOT)
- Ponytail 编码约束 (7 级优先级阶梯)
- 五阶段变更状态机 (Open → Design → Build → Verify → Archive)
- 知识层 (LLM-Wiki + PageIndex)
- MCP Server 与 CLI 入口
- demo 项目 (task-api) 演示完整流程

[Unreleased]: https://github.com/mumuspec/mumuspec/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/mumuspec/mumuspec/releases/tag/v0.10.0
