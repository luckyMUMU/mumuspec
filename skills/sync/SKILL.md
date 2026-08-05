---
name: sync
description: "代码现状 → 持久化同步。扫描 src/ 并与 .mumuspec/ 下的 BOUNDARY.md / index.yaml / contracts/ 对齐差异。"
metadata:
  short-description: "双向同步代码状态到 MumuSpec 持久化"
  phase: build
  workflow: "*"
---

# Sync Skill — 代码↔持久化双向同步

## 触发条件

- `mumuspec sync` CLI 命令
- `mumuspec init` 完成后自动触发
- `mumuspec sync --migrate` 用于旧版迁移

## 执行流程

### 1. 代码扫描 (Code Scan)

```
src/
├── <module>/
│   ├── index.ts       ← barrel exports
│   ├── *.ts           ← implementation files
│   └── BOUNDARY.md    ← 目标持久化文件
├── ...
```

对每个模块:
1. `extractExports()`: 用正则 `export (function|class|interface|type|const|enum) <Name>` 提取导出符号
2. 对比 BOUNDARY.md 中的"对外接口"表
3. 记录缺失/多余的接口

### 2. 持久化校验 (Persistence Validation)

- index.yaml children 是否覆盖所有 src/ 模块
- contracts/schemas/ 是否包含最新快照
- BOUNDARY.md 与源码接口是否对齐

### 3. 报告与修复 (Report & Fix)

- `--check` 仅报告差异
- `--migrate` 检测旧版格式
- 默认模式：自动创建缺失的 BOUNDARY.md 骨架

## 迁移入口

`mumuspec sync --migrate` 是旧版本迁移的统一入口：

1. 检测 pre-0.16 格式文件 (`spec.yaml`, `design.yaml` 等)
2. 检测缺失的 mandatory 文件 (`design.md`, `spec.md`, `prohibitions.md`)
3. 生成迁移计划但不自动执行
4. 用户确认后执行 `mumuspec sync` 完成同步

## CLI 使用示例

```bash
# 标准同步（代码 → 持久化）
mumuspec sync

# 仅检查差异
mumuspec sync --check

# 单模块同步
mumuspec sync --module change

# 检测旧版格式并生成迁移计划
mumuspec sync --migrate
```

## 与其他命令的关系

- `mumuspec init` → 自动调用 sync (Step 12)
- `mumuspec check` → 包含 sync 的漂移检测逻辑
- `mumuspec drift` → 契约漂移检测 (contracts/)

## 输出格式

同步报告包含：
- Modules scanned
- BOUNDARY updated
- Index aligned
- Issues (error / warning / info)
