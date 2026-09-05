# Test Cases - Layer 3: installer 接线 + doctor legacy 检测 + e2e

> 测试文件：`tests/installer-agents-e2e.test.ts`（新建）+ `tests/doctor.test.ts`（若已有则追加用例）
> 被测模块：`src/install/installer-ops.ts`（改）、`src/install/installer-registry.ts`（改）、doctor（改）

## Cases

### TC-A1: `install --agent codex` 后 AGENTS.md + skills 落盘且含规范链摘要
- **可验证性**: enforced-strong
- **Given**: 临时项目已完成 `mumuspec init`（含最小规范上下文），技能源存在
- **When**: 执行 codex 安装路径（installPackage / 等价 API，agent='codex'）
- **Then**:
  1. 项目根 `AGENTS.md` 存在，含标记头与规范链摘要（grep 关键节标题）
  2. skills 落盘于 `~/.codex/skills/` 目录式 SKILL.md（或项目级等价配置目录），6 个 phase skill + workflow-presets 可装
  3. `isAgentSupported('codex') === true` 且 `getSupportedAgents()` 含 codex/windsurf/gemini/copilot
- **环境隔离**: HOME 指向临时目录，不污染真实用户目录。

### TC-A4: 全部生成路径 grep 无 .cursorrules/.windsurfrules（D2 红线）
- **可验证性**: enforced-strong
- **Given**: 对全部 agent（6 旧 + 4 新）逐一执行安装/规则生成路径
- **When**: 收集所有落盘文件相对路径与生成内容
- **Then**: 无任何文件名或内容出现 `.cursorrules` / `.windsurfrules`（字符串级 grep = 0 命中）。

### TC-A1x: windsurf/gemini/copilot 落盘冒烟
- **可验证性**: enforced-strong
- **Then**:
  1. windsurf → 项目根 AGENTS.md（nearest-wins 语义仅文档声明，不落 extra 文件）
  2. gemini → AGENTS.md + GEMINI.md 薄壳 + settings.json `context.fileName` 指引（若 gemini 配置目录可达；不可达时降级为仅文档指引并 warn）
  3. copilot → AGENTS.md，`.github/` 不产生额外文件
  4. claude → CLAUDE.md 薄壳存在且首行 `@AGENTS.md`

### TC-A4x: doctor legacy 存量检测
- **可验证性**: enforced-strong
- **Given**: 临时项目根含存量 `.cursorrules` / `.windsurfrules`
- **When**: 运行 doctor
- **Then**: 输出 legacy 检测提示（文件路径 + 一次性迁移指引：内容并入 AGENTS.md 或删除；不自动迁移 — D2），exit code 不因此失败（提示级）。

### TC-B4: 真实 Claude Code 会话加载薄壳 CLAUDE.md（manual）
- **可验证性**: manual
- **步骤**: 在真实 Claude Code 会话中打开本项目，确认 CLAUDE.md 薄壳经 `@AGENTS.md` 引入 AGENTS.md 全量规范；证据（截图/会话摘录）记入 `verify.md`。
- **不自动化理由**: 依赖外部 agent 运行时行为，无法在 vitest 内闭环。

## 边界与不变式
- installer-ops 仅做落盘执行（IO 层），三态判定逻辑全部来自 rules-generator 返回值。
- 既有 6 agent（catpaw/claude/cursor/trae/workbuddy/opencode）行为零回归。
- doctor 对 legacy 文件只提示不删除。
