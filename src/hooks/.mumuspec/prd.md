---
scope: src/hooks
layer: 2
---

# Product Requirements: hooks

## 模块职责 (What this module does)

Git Hooks 管理模块，安装和运行 Git 钩子以在提交和合并时自动执行合规检查。

- `installHooks()` — 安装 Git hooks 到 `.git/hooks/` 目录
- `runHook()` — 执行指定 hook 类型的检查
- `getHookStatus()` — 查询已安装和可用的 hooks 状态
- 支持 5 种 Hook 类型：pre-commit、post-commit、post-merge、post-checkout、commit-msg
- 提供 Unix shell 和 Windows batch 两种模板

## 存在理由 (Why it exists)

规范合规需要在代码提交前自动执行，防止违规代码进入版本库。
Git hooks 是最自然的拦截点。pre-commit hook 执行 SHALL NOT 合规检查，
确保每次提交都通过规范验证。

## 用户场景 (User scenarios)

1. **安装 Hooks**：`mumuspec hooks install` 在项目 `.git/hooks/` 安装钩子脚本
2. **提交拦截**：`git commit` 触发 pre-commit hook，执行 SHALL NOT 检查
3. **合并后检查**：`git merge` 触发 post-merge hook，检测漂移
4. **状态查询**：`mumuspec hooks status` 查看已安装的 hooks

## 验收标准 (Acceptance criteria)

- 支持 pre-commit、post-commit、post-merge、post-checkout、commit-msg 五种 hook
- pre-commit hook 必须执行 SHALL NOT 合规检查
- 提供 Unix shell 和 Windows batch 两种模板
- hook 安装检查 `.git` 目录存在性
- 不覆盖用户自定义的现有 hook（除非指定 --force）
- hook 执行不阻塞超过 skill_timeout（300s）
