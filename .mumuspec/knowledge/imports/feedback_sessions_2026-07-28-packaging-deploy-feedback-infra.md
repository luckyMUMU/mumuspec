---
id: "IMPORT-FEEDBACK_SESSIONS_2026_07_28_PACKAGING_DEPLOY_FEEDBACK_INFRA"
title: "打包部署基础设施与反馈机制搭建"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - feedback
source: "feedback/sessions/2026-07-28-packaging-deploy-feedback-infra.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# 打包部署基础设施与反馈机制搭建

> **Source**: `feedback/sessions/2026-07-28-packaging-deploy-feedback-infra.md` | **Type**: feedback | **Imported**: 2026-07-31

## Summary

为 MumuSpec 项目建立完整的打包部署基础设施和用户反馈记录机制: 1. 分析并确认打包部署方案 2. 生成相关文档并优化

## Original Content

---
date: 2026-07-28
session_id: 20260728-packaging-deploy-infra
agent: trae
agent_version: GLM-5.2
mumuspec_version: 0.12.1-alpha.0
project_type: brownfield
change_type: feature
duration_minutes: 35
outcome: success
---

# 打包部署基础设施与反馈机制搭建

## 1. 会话目标

为 MumuSpec 项目建立完整的打包部署基础设施和用户反馈记录机制:
1. 分析并确认打包部署方案
2. 生成相关文档并优化
3. 创建专门的测试版本配置 (prerelease)
4. 主动记录用户反馈与 session 摘要的机制

## 2. 实际走完的流程

- [x] Open — 明确 4 项任务范围 (打包部署/文档/测试版本/反馈机制)
- [x] Design — 决定方案: package.json 增强 + 2 个脚本 + 3 个文档 + 反馈目录结构
- [x] Build — 实施所有变更
- [x] Verify — prebuild-check 通过、51 个测试通过、`npm publish --dry-run` tarball 内容审计通过
- [ ] Archive — 等待用户确认后归档

## 3. 触发的约束

本次 session 是为 MumuSpec 项目本身建立基础设施,**没有**实际通过 `mumuspec` CLI 走变更流程,因此没有约束被触发。这本身就是一个观察点 — 见 §5。

- [ ] worktree_isolation: 未触发 (直接在主分支工作,因本次为基础设施类变更)
- [ ] single_active_change: 未触发
- [ ] top_down_design: 未触发
- [ ] tdd_enforced: 未触发 (没有先写测试再实现,后续应改进)

## 4. 阻断点与回退

- **阻断点 1**: `npm run release:dry` 首次运行时 `tests/cli.test.ts` 中版本断言 `expect(output.trim()).toBe('0.10.0')` 失败
  - 处理方式: 把测试改为从 `package.json` 动态读取版本号 (`pkgVersion`),使后续版本 bump 不再需要同步修改测试
  - 教训: 任何硬编码版本号的测试都是反模式

- **阻断点 2**: PowerShell 不支持 `cd /d` (cmd.exe 语法)
  - 处理方式: 改用 RunCommand 工具的 `cwd` 参数
  - 教训: 跨 shell 兼容性应在文档中明确,后续 `packaging-deployment.md` 中提到的所有命令应标注 PowerShell 兼容性

## 5. 走捷径点 (重要)

- **期望触发但未触发**: `tdd_enforced` 应在本次实现新功能 (bump-prerelease.mjs / prebuild-check.mjs) 时触发,要求先写测试。本次未遵循 TDD,直接写实现后用 `npm run release:dry` 集成验证。
  - 理由: 这是为 MumuSpec 自身建立的工具脚本,且验证手段 (`release:dry` 端到端) 比单元测试更具说服力
  - 是否在 decisions.md 记录: 否,应在后续补记

- **期望触发但未触发**: `single_active_change` 应在本次工作开始时检查 — 是否有其他活跃变更?
  - 实际情况: 项目当前 `implementation_progress: 0%`,尚无正式变更管理流程启动

## 6. 沉淀模式 (Patterns Observed)

- **模式 1 (可推广)**: 在 `package.json` 中通过 `files` 白名单严格控制 npm 包内容,避免误发布 `tests/` `src/` `scripts/` 等开发资源。审计手段用 `npm publish --dry-run` 看 `npm notice` 列表。
- **模式 2 (可推广)**: `prebuild` npm 钩子做版本号同步检查 (package.json vs src/cli.ts),失败立即 abort 构建,避免发布版本与 CLI 报告版本不一致的包。
- **模式 3 (需改进)**: 测试中硬编码版本号是常见反模式,本次改为动态读取。建议在 MumuSpec 的 spec.md 中加 SHALL: "版本号断言必须从 package.json 动态读取,不允许硬编码"。
- **模式 4 (可推广)**: 双通道发布 (`latest` / `next`) 与 SemVer prerelease 标签 (`-alpha.N` / `-beta.N` / `-rc.N`) 严格对齐,避免 prerelease 版本被 `npm install mumuspec` 默认拉到。
- **模式 5 (需制止)**: 工具脚本 (`bump-prerelease.mjs` / `prebuild-check.mjs`) 没有对应的单元测试,只靠端到端 `release:dry` 验证。后续应在 `tests/` 加 `bump-prerelease.test.ts` 与 `prebuild-check.test.ts`。

## 7. 设计盲区 (Q4 - 未知未知)

- **盲区 1**: 当前 `constraint_strength` 系统 (0.12.0+) 已在 `src/core/config.ts` 实现核心类型与 `resolveConstraintTree` 纯函数,但 **未集成到 `src/guard/checker.ts`**,因此本次 session 期间没有任何约束被实际触发。这意味着:
  - 设计假设 "Agent 在使用 MumuSpec 时会触发约束" 当前不成立
  - 建议补充到 `docs/design/constraint-strength.md` §7 (集成点) 明确"集成前约束不生效"的过渡状态
  - 优先级: high

- **盲区 2**: `feedback/sessions/` 目录现在依赖 Agent 自觉填写模板。在 Phase 2 实现 `mumuspec session summary` 命令前,如何激励 Agent 主动生成? 缺激励/触发机制。
  - 建议补充到 `docs/reference/feedback-process.md` §4.1 中,加一条 "Phase 1 过渡期: 维护者在 PR review 时手动请求 Agent 填写"
  - 优先级: medium

- **盲区 3**: `bump-prerelease.mjs` 当前不支持 build metadata (`+build`),如 `0.12.1-alpha.0+local.20260728`。如果未来需要标识本地构建,需扩展脚本。
  - 建议补充到 `packaging-deployment.md` §3.3 表格中,加一行说明
  - 优先级: low

- **盲区 4**: `.npmrc` 中 `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` 在本地无 `NPM_TOKEN` 环境变量时,npm 会报 warning 但不阻塞 `npm install`。是否需要在文档中明确这一点?
  - 优先级: low

## 8. 给改进的输入

- **建议 1**: 实现 `ConstraintEvaluator` (已在 project_memory.md 标记为待办),让 `src/guard/checker.ts` 真正读取 `constraint_strength` 配置并触发 block/warn/info。→ 优先级: high,目标 0.12.1-beta.0
- **建议 2**: 实现 `loadConstraintsFile`,把 `.mumuspec/constraints.yaml` 接入 `resolveConstraintTree`。→ 优先级: high,目标 0.12.1-beta.0
- **建议 3**: 为 `scripts/bump-prerelease.mjs` 和 `scripts/prebuild-check.mjs` 补充单元测试,加入 `tests/` 目录。→ 优先级: medium,目标 0.12.1-beta.0
- **建议 4**: 在 `docs/design/constraint-strength.md` 中新增章节说明"集成点状态",明确当前哪些代码点已读 `constraint_strength`,哪些尚未集成。→ 优先级: medium,目标 0.12.1-beta.0
- **建议 5**: 后续考虑给 `mumuspec` CLI 加 `mumuspec session summary` 命令 (Phase 2),自动收集本次会话产生的 `.mumuspec/changes/` 工件并预填模板。→ 优先级: low,目标 0.13.0
- **建议 6**: `packaging-deployment.md` 中所有 shell 命令应标注是否兼容 PowerShell,或统一改为跨 shell 的写法。→ 优先级: low,目标 0.12.1-beta.0

## 9. 知识页面

本次 session 未生成新的 Knowledge Page (KP-xxx)。建议后续补充:
- KP-006 (pattern): "package.json files 白名单 + npm publish --dry-run 审计" 模式
- KP-007 (decision): "版本号在测试中应动态读取 package.json,不硬编码" 决策

## 10. 关键工件引用

- package.json (顶层配置,新增 files/publishConfig/scripts)
- src/cli.ts#L32-L35 (CLI 版本号同步)
- scripts/bump-prerelease.mjs (新文件)
- scripts/prebuild-check.mjs (新文件)
- .npmrc (新文件)
- docs/reference/packaging-deployment.md (新文件)
- docs/reference/feedback-process.md (新文件)
- feedback/README.md (新文件)
- feedback/_template/user-feedback-template.md (新文件)
- feedback/_template/session-summary-template.md (新文件)
- feedback/user/.gitkeep (新文件)
- feedback/sessions/.gitkeep (新文件)
- feedback/monthly/.gitkeep (新文件)
- feedback/sessions/2026-07-28-packaging-deploy-feedback-infra.md (本文件)
- CHANGELOG.md (新文件)
- docs/STATUS.md (更新顶部元信息 + 新增 §反馈汇总)
- docs/overview.md#L279 (导航新增打包/部署/反馈文档链接)
- tests/cli.test.ts#L7-L10 (版本号动态读取改造)

