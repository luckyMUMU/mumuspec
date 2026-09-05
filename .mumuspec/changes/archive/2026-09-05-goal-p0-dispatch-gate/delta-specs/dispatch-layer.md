# Delta Spec: 分发层 canonical-first

## Requirement: AGENTS.md canonical 生成

MumuSpec 必须能生成 AGENTS.md 作为唯一权威 Rules 文件，并通过薄壳桥接覆盖全部主流 agent。

### SHALL

- 提供 AGENTS.md 生成器，产出内容包含：规范链摘要、Ponytail 约束、CLI 命令速查、MCP 调用入口指引。
- 生成 CLAUDE.md 薄壳，首行为 `@AGENTS.md`。
- 生成 GEMINI.md 薄壳，并提示用户在 settings.json 的 context.fileName 中加入 AGENTS.md。
- installer-registry 新增 codex、windsurf、gemini、copilot 四个 AgentType，且各自完成 install 后具有可用的入口文件。

### SHALL NOT

- 禁止生成 `.cursorrules` 与 `.windsurfrules`（遗留格式）。
- 禁止在 Rules 文件中内联全量规范上下文（渐进式披露职责归 MCP，Rules 文件受 32KiB 容量预算约束）。
- 禁止在目标位置已存在用户手写的 AGENTS.md / CLAUDE.md 时静默覆盖。

### Enforcement

- ENF-1: enforced-strong(install/init 落盘断言：AGENTS.md 存在且含四要素；CLAUDE.md 首行 `@AGENTS.md`)
- ENF-2: enforced-strong(源码级断言：生成路径中不出现 .cursorrules / .windsurfrules)
- ENF-3: enforced-strong(容量断言：生成产物 ≤ 32KiB)
- ENF-4: manual(薄壳在真实 Claude Code 会话中被加载，evidence 记入 verify.md)

## Requirement: phase skill 分发平权

阶段 Skill 对所有支持的 agent 可用，不因 agent 而缺失。

### SHALL

- phase-open / phase-design / phase-build / phase-verify / phase-archive 以目录式 SKILL.md 分发给全部已注册 agent。

### Enforcement

- ENF-5: enforced-strong(对每个 AgentType 执行 install 后断言五个 phase skill 文件存在)
