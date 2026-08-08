# Security Hardening Contract Change Record

**日期**: 2026-08-08
**变更名称**: security-hardening
**版本**: 0.17.1 → 0.18.0（建议）

---

## 变更摘要

规范驱动的安全加固改进，覆盖日志体系、路径穿越防护、Shell 注入修复、MCP 安全层、IO 优化和全局错误可见性。

---

## Layer 0 — 基础工具

| 变更 | 文件 | 说明 |
|------|------|------|
| 新增 logger.ts | `src/core/logger.ts` | 4 级结构化日志（trace/debug/info/warn/error），替代空 catch |
| 新增 validateChangeName | `src/core/utils.ts` | 路径穿越防护的输入验证函数 |
| 新增错误码 | `src/core/errors.ts` | E-SECURITY-002 (CHANGE_NAME_INVALID), E-SECURITY-003 (MCP_PATH_REQUIRED) |

## Layer 1 — 漏洞修复

| 变更 | 文件 | 说明 |
|------|------|------|
| 路径穿越防护 | `src/change/paths.ts` | getChangeDir / getArchivedChangeDir 添加 validateChangeName 校验 |
| getDiscardedDir 函数 | `src/change/paths.ts` | 新增统一的丢弃目录路径计算函数 |
| lifecycle.ts 更新 | `src/change/lifecycle.ts` | 使用 getDiscardedDir 替代内联字符串拼接 |
| 测试用例 | `tests/change/paths-security.test.ts` | 9 个路径穿越场景测试 |
| Shell 注入修复 | `src/cli/commands/knowledge-git.ts` | 消除 shell:true，全部改用 spawn + 参数数组 |
| $() 注入修复 | `src/core/loop-engine.ts` | execSync → spawnSync，消除命令注入向量 |

## Layer 2 — 安全层 + 性能

| 变更 | 文件 | 说明 |
|------|------|------|
| MCP isPathSafe 校验 | `src/mcp-server.ts` | 7 个文件路径工具添加入口验证 |
| discard/archive 确认机制 | `src/cli/commands/change.ts` | 添加 --confirm 选项，防止误操作 |
| IO 扫描合并 | `src/guard/checker.ts` | findSourceFiles 调用从 2 次降为 1 次 |

## Layer 3 — 错误可见性

| 文件 | 替换数量 | 级别分布 |
|------|---------|---------|
| `src/spec/loader.ts` | 15 | error:2, warn:8, debug:5 |
| `src/contract/manager.ts` | 4 | warn:4 |
| `src/guard/checker.ts` | 8 | debug:8 |
| `src/cli/commands/change.ts` | 0 | (原无空捕获) |

---

## 影响分析

### Breaking Changes
- `mumuspec archive <name>` 和 `mumuspec discard <name>` 现在需要 `--confirm` 标志
- 路径名不再允许包含 `/`, `..`, `\` 等路径分隔符

### 向后兼容
- 所有现有 API 签名未改变
- 日志系统完全新增，不破坏现有日志
- spawnSync 替换 execSync 不影响正常调用路径（参数正确传递）

### 安全收益
- 路径穿越攻击面消除
- Shell 注入攻击面消除（loop-engine + knowledge-git）
- MCP 外部入口路径安全验证
- 全局错误可观测性提升

---

## 测试覆盖

| 新增测试文件 | 测试数 | 全部通过 |
|-------------|--------|---------|
| tests/core/logger.test.ts | 11 | ✓ |
| tests/core/utils-validate.test.ts | 13 | ✓ |
| tests/change/paths-security.test.ts | 9 | ✓ |

---

## 二次审查 MUST-FIX 修复

| 时间 | 操作 | 文件 |
|------|------|------|
| 2026-08-08 18:00 | MF-2: diffRange 命令注入修复 | `src/knowledge/analysis.ts` |
| 2026-08-08 18:00 | MF-1: gitExec 迁移 spawnSync + limit 校验 | `src/knowledge/scanners/git-scanner.ts` |
| 2026-08-08 18:15 | MF-3: 7 处 execSync 迁移 spawnSync | `src/core/experiment-engine.ts` |
| 2026-08-08 18:15 | MF-4: MCP scope 参数白名单补齐 | `src/mcp-server.ts` |
| 2026-08-08 18:30 | 测试同步更新 | `tests/core/experiment-engine-deep.test.ts`, `tests/core/experiment-engine-extra.test.ts`, `tests/knowledge/git-scanner.test.ts` |

---

## 变更审计

| 时间 | 操作 | 执行者 |
|------|------|--------|
| 2026-08-08 16:30 | Layer 0-1 实施 | CatPaw |
| 2026-08-08 16:45 | Layer 2 实施 | CatPaw |
| 2026-08-08 17:00 | Layer 3 空捕获替换 | CatPaw |
| 2026-08-08 17:15 | 测试修复与验证 | CatPaw |
| 2026-08-08 17:45 | 二次审查 | CatPaw |
| 2026-08-08 18:00-18:30 | MUST-FIX 修复 + 测试同步 | CatPaw |
