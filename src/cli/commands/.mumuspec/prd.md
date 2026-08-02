---
scope: src/cli/commands
layer: 2
---

# Product Requirements: cli/commands

## 模块职责 (What this module does)

CLI 命令模块集合，每个文件实现一个功能域的命令组。

- **spec.ts** — context、add-spec、validate、check、drift、search 命令
- **change.ts** — new、status、list、archive、discard 命令
- **state.ts** — state init/transition/rollback/test-cases 命令
- **guard.ts** — guard 命令（阶段门禁检查，支持 --apply）
- **knowledge.ts** — knowledge list/get/search/context/impact/onboard/chat/coverage 等命令
- **constraints.ts** — constraints 管理命令
- **feedback.ts** — feedback submit/list/link 命令
- **install.ts** — install catpaw/claude/cursor 等安装命令
- **hooks.ts** — hooks install/run/status 命令
- **dashboard.ts** — dashboard 命令（实时状态面板）
- **eval.ts** — eval run/list 命令（评估场景运行）
- **i18n.ts** — i18n set/get 命令
- **skill.ts** — skill scaffold/validate/list 命令
- **bundle.ts** — bundle create/validate/install/publish/list 命令
- **env.ts** — env detect 命令（环境检测）
- **doctor.ts** — doctor 命令（环境诊断）

## 存在理由 (Why it exists)

将 CLI 命令按功能域拆分到独立文件，每个文件注册一组相关命令。
这避免了单文件过大，同时保持命令逻辑与领域模块的清晰映射关系。
每个命令文件作为 CLI 和领域逻辑之间的薄层，仅负责参数解析和输出格式化。

## 用户场景 (User scenarios)

1. **日常变更流程**：new → state transition → guard → archive（跨多个命令文件）
2. **规范管理**：context 查看上下文，validate 校验格式，check 检查合规
3. **知识探索**：knowledge list/search/context/onboard/chat 查询知识库
4. **工具配置**：install 安装技能，hooks 配置 Git 钩子，doctor 诊断环境
5. **评估测试**：eval run 执行评估场景，验证 guard 行为

## 验收标准 (Acceptance criteria)

- 每个命令文件导出 register* 函数，接收 Commander program 参数
- 命令逻辑仅做参数解析和输出格式化，业务逻辑委托给领域模块
- 所有命令通过 formatError 输出友好错误信息
- 支持部分命令的 --json 输出模式
- init 命令集成项目分析、文档导入和初始工件生成
