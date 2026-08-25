---
scope: src/hooks
layer: 2
last_updated: '2026-08-04'
---

# Technical Design: hooks

## SHALL constraints (migrated from spec.md)

- 必须支持 4 种 Hook 类型：pre-commit、post-merge、post-checkout、commit-msg
- pre-commit hook 必须执行 SHALL NOT 合规检查
- 必须支持 Unix shell 和 Windows batch 两种模板
- hook 安装必须检查 .git 目录存在性

## SHALL NOT constraints (migrated from spec.md)

- 禁止覆盖用户自定义的现有 hook（除非指定 --force）
- 禁止 hook 执行阻塞超过 skill_timeout（300s）

## Enforcement (migrated from spec.md)

- HOOK-1: 检查 hook 文件可执行权限
- HOOK-2: 检查 pre-commit 执行合规检查

## 架构决策 (Architecture decisions)

- **委托模式**：hook 脚本仅做转发，实际逻辑通过 `mumuspec hooks run <type>` 委托给 CLI
- **双平台模板**：HOOK_TEMPLATE（sh）和 HOOK_TEMPLATE_WIN（batch），按平台选择
- **Git Root 查找**：从当前目录向上遍历查找 `.git` 目录
- **版本标记**：hook 脚本包含 HOOK_SCRIPT_VERSION，便于升级检测
- **跨模块调用**：runHook 内部调用 guard/checker.js 的 checkCompliance 和 detectDrift

## 接口契约 (Interface contracts)

```typescript
type HookType = 'pre-commit' | 'post-commit' | 'post-merge' | 'post-checkout' | 'commit-msg';

interface HookInstallResult { success: boolean; hook: string; path?: string; error?: string; skipped?: boolean; }
interface HookRunResult { hook: string; passed: boolean; errors: string[]; warnings: string[]; }
interface HookStatus { installed: HookType[]; available: HookType[]; }

function installHooks(workspacePath: string, options?: {...}): HookInstallResult[];
function runHook(hookType: HookType, args?: string[]): HookRunResult;
function getHookStatus(workspacePath: string): HookStatus;
```

## 依赖关系 (Dependencies)

- **上游**：`src/guard/checker.js`（合规检查和漂移检测）
- **跨模块**：`src/core/config.js`、`src/core/utils.js`、`src/knowledge/manager.js`（readReverseIndex）
- **下游**：被 `src/cli/commands/hooks.ts` 命令模块调用
