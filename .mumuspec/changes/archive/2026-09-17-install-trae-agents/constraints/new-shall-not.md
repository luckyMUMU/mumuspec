# New SHALL NOT Constraints

- SHALL NOT 在 trae → traecode 迁移后保留幽灵引用（AgentType / 子命令 / 测试 / 文档须一次性替换）。
- SHALL NOT 让 --project-only 与 --target user 并存时静默选择其一（fail-closed，报错退出）。
- SHALL NOT 为 traecode / traework 引入 registry 之外的 agent-specific 逻辑。
