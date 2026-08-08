---
scope: src/hooks
layer: 2
---

# Boundary Document: hooks

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `installHooks` | `(options?: { workspacePath?: string; force?: boolean; hooks?: HookType[] }) => HookInstallResult[]` | guard.ts | 安装 git hooks |
| `uninstallHooks` | `(workspacePath?: string) => HookInstallResult[]` | guard.ts | 卸载 git hooks |
| `getHookStatus` | `(workspacePath?: string) => HookStatus` | guard.ts | 获取 hook 安装状态 |
| `runHook` | `(hookType: HookType, args?: string[], workspacePath?: string) => HookRunResult` | guard.ts | 执行指定 hook 的逻辑 |
| `parseKnowledgeImpact` | `(message: string) => KnowledgeImpact \| null` | guard.ts | 解析 UA-style Knowledge-Impact 块 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `HookType` | Git hook 类型：'pre-commit' \| 'post-commit' \| 'post-merge' \| 'post-checkout' \| 'commit-msg' |
| `HookInstallResult` | hook 安装/卸载结果 |
| `HookRunResult` | hook 执行结果（passed / errors / warnings） |
| `HookStatus` | hook 状态（installed / available 列表） |
| `KnowledgeImpact` | UA-style 知识影响声明（implements / affects / supersedes） |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统 |
| `node:path` | 路径处理 |
| `node:child_process` | 子进程执行 |
| `../core/utils.js` | 工具函数 |
| `../core/config.js` | 配置读取 |
| `../guard/checker.js` | 合规检查 |
| `../knowledge/manager.js` | 知识库反向索引 |

### 外部依赖

无（仅 Node.js 标准库）

## 数据契约

### 输入

- 项目根路径
- hook 类型与参数
- force 选项

### 输出

- `.git/hooks/` 中的 git hook 文件
- HookResult（passed, errors, warnings）
- HookInstallResult（success, error）

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 初始创建边界文档（旧文档接口名已全部对齐代码） | 文档-代码一致性修复 |
