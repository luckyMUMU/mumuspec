---
id: "ENV-003"
title: "CLI 命令扩展 — env 子命令"
scope: "src/cli.ts"
type: "shall"
layer: 0
---

## SHALL

新增 `mumuspec env` 命令族，提供环境检测、验证和对比功能。

### 命令清单

```
mumuspec env detect [--save] [--ecosystem <name>] [--json]
  - 检测当前环境并输出
  - --save: 保存到 .mumuspec/env-spec.md
  - --ecosystem: 仅检测指定生态 (java/node/python)
  - --json: JSON 格式输出

mumuspec env validate [--fix]
  - 验证当前环境是否符合 env-spec.md 声明
  - --fix: 自动修复 minor 问题（如补充缺失环境变量）

mumuspec env diff [--against <file>]
  - 对比当前环境与已保存的环境规范
  - --against: 对比两个环境的 env-spec.md 文件
```

### 输出格式

```
=== Environment Check ===

OS: Windows 10 (x64) ✓

Java:
  JDK:  17.0.8 (C:\Program Files\Java\jdk-17) ✓
  Maven: 3.9.4 (C:\apache-maven-3.9.4) ✓
  Gradle: NOT FOUND ⚠ (required by project)

Node:
  Node.js: v24.18.0 ✓
  npm: 10.9.0 ✓

Result: 1 warning, 0 errors
   Run `mumuspec env validate --fix` to auto-fix.
```

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 所有检查通过 |
| 1 | 发现警告（部分工具版本不匹配） |
| 2 | 发现错误（必需工具缺失） |
| 3 | 检测执行失败 |

## Reason

CLI 命令使开发者可在开发循环中快速检查和验证环境，CI/CD 流程可调用 `validate` 确保一致。
