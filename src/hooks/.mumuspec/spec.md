---
layer: 1
scope: "src/hooks"
last_updated: "2026-07-30"
---

## Requirement: Git Hooks 管理

### SHALL
- 必须支持 4 种 Hook 类型：pre-commit、post-merge、post-checkout、commit-msg
- pre-commit hook 必须执行 SHALL NOT 合规检查
- 必须支持 Unix shell 和 Windows batch 两种模板
- hook 安装必须检查 .git 目录存在性

### SHALL NOT
- 禁止覆盖用户自定义的现有 hook（除非指定 --force）
- 禁止 hook 执行阻塞超过 skill_timeout（300s）

### Enforcement
- HOOK-1: 检查 hook 文件可执行权限
- HOOK-2: 检查 pre-commit 执行合规检查
