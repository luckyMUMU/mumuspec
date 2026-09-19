# Delta Spec: --project-only 参数语义

为 `mumuspec install <agent> <pkg>` 提供"仅安装到当前项目"的便捷入口，规避 user 级安装的全局目录区域差异（`.trae` vs `.trae-cn`），并简化 workspace 安装的路径输入。

下列条目均为机器可判定形式。

## Requirement: --project-only 仅限当前项目安装

Enforcement: 见下方 ### Enforcement 清单（ITA-3）

### SHALL

- SHALL 使 `--project-only` 等价于 `--target workspace` 且 `--workspace-path` 缺省取 `process.cwd()`。
- SHALL 使 `--project-only` 与显式 `--target user` 互斥：同时给出时报错并以非零码退出。
- SHALL 使 `--project-only` 在 workspace 目标上同样触发 rulesRideAlong 规则文件生成（与 `--target workspace` 一致）。

### SHALL NOT

- SHALL NOT 在 `--project-only` 与 `--target workspace` 并存时静默覆盖用户给出的 `--workspace-path`。
- SHALL NOT 让 `--installed` 列表在 `--project-only` 下扫描错误的目录（应按 workspace+cwd 扫描）。

### Enforcement

- ITA-3: unit-tests(helpers 子命令：project-only 缺省 cwd、与 --target user 互斥报错、workspace 安装触发 AGENTS.md)
