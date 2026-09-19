# New SHALL Constraints

- SHALL 使 traecode 与 traework 在 workspace 目标安装时生成/更新项目根 AGENTS.md（复用 renderRuleFiles 三态策略与 managed 标记，TraeWork 桌面版亦读取该文件）。
- SHALL 使 --project-only 等价于 --target workspace 且 --workspace-path 缺省取 process.cwd()，并与显式 --target user 互斥（冲突即报错退出）。
