---
scope: src/cli
layer: 2
---

# Boundary Document: cli

## 对外接口

### CLI 命令注册

| 命令 | 文件 | 用途 |
|------|------|------|
| `mumuspec init` | `commands/env.ts` | 初始化项目 |
| `mumuspec new` | `commands/change.ts` | 创建变更 |
| `mumuspec state` | `commands/state.ts` | 变更状态管理 |
| `mumuspec validate` | `commands/spec.ts` | 规范验证 |
| `mumuspec check` | `commands/guard.ts` | 合规检查 |
| `mumuspec drift` | `commands/spec.ts` | 漂移检测 |
| `mumuspec guard` | `commands/guard.ts` | 阶段守护 |
| `mumuspec spec` | `commands/spec.ts` | 规范上下文 |
| `mumuspec contract` | `commands/contract.ts` | 契约管理 |
| `mumuspec decisions` | `commands/decisions.ts` | 决策记录 |
| `mumuspec feedback` | `commands/feedback.ts` | 反馈收集 |
| `mumuspec install` | `commands/install.ts` | 工具安装 |
| `mumuspec dashboard` | `commands/dashboard.ts` | 仪表盘 |
| `mumuspec eval` | `commands/eval.ts` | 评估运行 |
| `mumuspec skill` | `commands/skill.ts` | 技能管理 |
| `mumuspec bundle` | `commands/bundle.ts` | 打包管理 |
| `mumuspec doctor` | `commands/doctor.ts` | 环境诊断 |
| `mumuspec advise` | `commands/advise.ts` | 阻塞点建议 |
| `mumuspec recommend` | `commands/recommend.ts` | 工作流路径推荐 |
| `mumuspec constraints` | `commands/constraints.ts` | 约束强度管理 |
| `mumuspec finalize-archive` | `commands/finalize-archive.ts` | 归档后整理 |
| `mumuspec knowledge` | `commands/knowledge.ts` | 知识库管理入口 |
| `mumuspec knowledge crud` | `commands/knowledge-crud.ts` | 知识页增删改查 |
| `mumuspec knowledge analysis` | `commands/knowledge-analysis.ts` | 知识库影响分析 |
| `mumuspec knowledge onboard` | `commands/knowledge-onboard.ts` | 知识库入门路径 |
| `mumuspec knowledge chat` | `commands/knowledge-chat.ts` | 知识库对话 |
| `mumuspec knowledge git` | `commands/knowledge-git.ts` | Git 操作 |
| `mumuspec knowledge scan` | `commands/knowledge-scan.ts` | 知识库扫描 |
| `mumuspec knowledge doctor` | `commands/knowledge-doctor.ts` | 知识库诊断 |
| `mumuspec hooks` | `commands/hooks.ts` | Hooks 管理 |
| `mumuspec i18n` | `commands/i18n.ts` | 国际化管理 |

### 命令注册入口

- `registerAllCommands(program: Command): void` — 注册所有 CLI 命令

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `commander` | CLI 框架 |
| `../core/config.js` | 配置管理 |
| `../core/init-generator.js` | 初始化生成 |
- `commands/*` | 各命令实现模块

### 外部依赖

- `commander`（npm 包）

## 数据契约

### 输入

- 命令行参数和选项
- 项目配置（`.mumuspec/config.yaml`）

### 输出

- 控制台输出
- 文件系统变更
- 退出码（0 = 成功，非0 = 失败）

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 补全缺失命令声明（doctor, advise, recommend, constraints, finalize-archive, knowledge*, hooks, i18n） | BOUNDARY.md 与代码对齐 |
| 2026-08-03 | init 命令增加 spec.md/design.md 覆写保护 | 防止意外覆盖已有规范文件 |
