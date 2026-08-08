---
workflow: full
phase: design
status: in_progress
dependencies: proposal.md
---

# 设计文档：安全加固与工程质量整改

## 0. 设计方法

遵循 MumuSpec **Top-Down Design, Bottom-Up Implementation** 原则：

```
Design（自顶向下）:
  Root: 整体改进架构 → 确定受影响 Scope 及其边界
  ├── Scope: src/core/ — 基础设施层
  ├── Scope: src/change/ — 变更管理层
  ├── Scope: src/cli/ + src/cli/commands/ — CLI 层
  ├── Scope: src/mcp-server.ts — MCP 协议层
  └── Scope: src/guard/ — 合规检查层

Build（自底向上）:
  Layer 0 (Leaves): 无依赖的基础模块 → Logger、Utils 改进
  Layer 1 (Single-file): 单文件安全修复 → knowledge-git、paths、loop-engine
  Layer 2 (Internal): 跨模块集成 → MCP 校验、change.ts 确认、checker 优化
  Layer 3 (Root): 全局改造 → catch 替换、CLI 懒加载
```

## 1. 架构设计（Top-Down）

### 1.1 受影响 Scope 边界图

```
src/
├── core/                    # Scope A: 基础设施
│   ├── utils.ts             # 增强 isPathSafe + 新增 validateChangeName
│   ├── logger.ts [NEW]      # 新建日志模块（4 级）
│   └── loop-engine.ts       # 修复 commit $() 注入
│
├── change/                  # Scope B: 变更管理
│   └── paths.ts             # 路径穿越防护
│
├── cli/                     # Scope C: CLI 框架
│   ├── index.ts             # 静态 import → 动态 import()
│   └── commands/            # Scope C1: 命令实现
│       ├── change.ts        # discard/archive 确认交互
│       └── knowledge-git.ts # 修复 shell 注入
│
├── mcp-server.ts            # Scope D: MCP 协议
│   └── handleToolCall       # 添加 isPathSafe 校验层
│
└── guard/                   # Scope E: 合规检查
    └── checker.ts           # IO 扫描合并 + Logger 注入
```

### 12 设计约束（Ponytail 合规）

| 原则 | 应用 |
|------|------|
| Level 2 - 复用已有 | 使用现有 isPathSafe，不新建路径校验逻辑 |
| Level 3 - 标准库优先 | execFile 替代 spawnSync(shell:true)（node:child_process 已有） |
| Level 6 - 一行代码 | validateChangeName 基于白名单正则一行实现 |
| Level 7 - 最小可工作 | Logger 仅 4 级 80 行，不引入 pino/winston |
| ponytail: 标记 | 有意简化处注释标记原因 |

## 2. 自底向上实现顺序（Bottom-Up）

### Layer 0: 基础设施叶模块（无内部依赖）

#### L0-1: src/core/logger.ts [NEW]

**边界影响**：core BOUNDARY.md 需添加 logger.ts 声明

```typescript
// src/core/logger.ts（~80 行）
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0, debug: 1, info: 2, warn: 3, error: 4
};

export class Logger {
  private static level: LogLevel = 
    (process.env.MUMUSPEC_LOG_LEVEL as LogLevel) || 'info';
  private static jsonMode = process.env.MUMUSPEC_LOG_JSON === 'true';

  static trace(module: string, msg: string, ctx?: Record<string, unknown>): void
  static debug(module: string, msg: string, ctx?: Record<string, unknown>): void
  static info(module: string, msg: string, ctx?: Record<string, unknown>): void
  static warn(module: string, msg: string, ctx?: Record<string, unknown>): void
  static error(module: string, msg: string, ctx?: Record<string, unknown>): void
}

// 兼容现有 console.log 输出格式（面向用户的最终输出保留 console.log）
export const userOutput = { log: console.log, error: console.error };
```

**替代关系**：
- 100+ 处 `catch {}` → `catch (err) { Logger.trace('module', 'reason', { err: String(err) }) }`
- 仅诊断信息走 Logger，用户可见输出保留 console.log/error

#### L0-2: src/core/utils.ts — 增强

**边界影响**：现有 `isPathSafe` 签名不变，新增 `validateChangeName`

```typescript
// 新增函数
export function validateChangeName(name: string): boolean {
  // ponytail: 最小校验 — 仅禁止路径分隔符和 .. 序列
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
}

// isPathSafe 已有实现不变，供 paths.ts 和 mcp-server.ts 调用
```

### Layer 1: 单文件安全修复（依赖 Layer 0）

#### L1-1: src/change/paths.ts — 路径穿越防护

**边界影响**：无接口变更，内部增加校验

```typescript
// 修改 getChangeDir 入口
export function getChangeDir(projectRoot: string, changeName: string, scope?: string): string {
  if (!validateChangeName(changeName)) {
    throw new MumuSpecError('E-SECURITY-002', { changeName });
  }
  return join(getChangesDir(projectRoot, scope), changeName);
}

export function getDiscardedDir(projectRoot: string, changeName: string, scope?: string): string {
  if (!validateChangeName(changeName)) {
    throw new MumuSpecError('E-SECURITY-002', { changeName });
  }
  return join(getChangesDir(projectRoot, scope, 'discarded'), changeName);
}
```

**测试要求**：
- `validateChangeName('../../etc')` → false
- `validateChangeName('feature-123')` → true
- `getChangeDir(root, '../evil')` → 抛 MumuSpecError

#### L1-2: src/cli/commands/knowledge-git.ts — shell 注入修复

**边界影响**：无接口变更，内部实现从 spawnSync(shell:true) 改为 spawnSync(args[])

```typescript
// 修改前（危险）
exec(`git commit -m "${fullMsg.replace(/"/g, '\\"')}"`);

// 修改后（安全）
spawnSync('git', ['commit', '-m', fullMsg], { cwd: root, stdio: 'pipe' });

// 全文件替换所有 spawnSync(cmd, { shell: true }) → spawnSync('git', [...args], {})
```

**测试要求**：
- commit message 含 `$()` 时不再被 shell 解释
- 验证分支名含特殊字符时的行为

#### L1-3: src/core/loop-engine.ts — $() 注入修复

**边界影响**：无接口变更

```typescript
// 修改前（loop-engine.ts:258）
execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd, stdio: 'ignore' });

// 修改后
import { spawnSync } from 'node:child_process';
spawnSync('git', ['commit', '-m', message], { cwd, stdio: 'ignore' });
```

### Layer 2: 跨模块集成（依赖 Layer 0 + Layer 1）

#### L2-1: src/mcp-server.ts — isPathSafe 校验层

**边界影响**：inputSchema 不变；handleToolCall 增加中间件

```typescript
// 在 handleToolCall switch 前加入路径校验中间件
const pathToolsNeedingValidation = new Set([
  'get_spec_context', 'get_prohibitions', 
  'get_design_context', 'get_knowledge_context',
  'scaffold_boundary'
]);

function safePath(path: unknown, root: string): string {
  if (typeof path !== 'string' || !path) {
    throw new MumuSpecError('E-SECURITY-003', { reason: 'path must be non-empty string', path });
  }
  const resolved = resolve(root, path);
  if (!isPathSafe(path, root)) {
    throw new MumuSpecError('E-SECURITY-001', { path });
  }
  return resolved;
}

// 在每个 path 工具 case 中：
// 修改前: const targetPath = resolve(root, args.path as string);
// 修改后: const targetPath = safePath(args.path, root);
```

**测试要求**：
- 传入 `path: "../../etc/passwd"` → 返回 isPathSafe error
- 传入 `path: null` → 返回 SECURITY-003 error

#### L2-2: src/cli/commands/change.ts — discard/archive 确认机制

**边界影响**：命令行选项新增 `--confirm` / `--yes`

```typescript
// 修改前（直接执行）
.action(async (name, options) => {
  discardChange(root, name, options.reason || 'No reason');
});

// 修改后（带确认）
.action(async (name, options) => {
  if (!options.confirm) {
    console.warn(`⚠ 即将归档变更 "${name}"（移至 .mumuspec/changes/archive/discarded/）`);
    console.warn(`  使用 --confirm 或 -y 跳过此提示`);
    process.exit(130); // 用户取消
  }
  discardChange(root, name, optionsreason || 'No reason');
})
.option('--confirm, -y', '确认执行，跳过交互提示');
```

#### L2-3: src/guard/checker.ts — IO 扫描合并

**边界影响**：无接口变更，内部算法优化

```typescript
// 修改前：各自独立遍历
function checkShallNot(root) {
  const specs = findAllSpecs(root);   // 第 1 次全树扫描
  const sources = findSourceFiles(root); // 第 2 次全树扫描
}
function checkShall(root) {
  const specs = findAllSpecs(root);   // 第 3 次全树扫描
}

// 修改后：缓存扫描结果
const scanCache = new Map<string, { specs: SpecFile[]; sources: string[] }>();

function getCachedScans(root: string) {
  if (!scanCache.has(root)) {
    scanCache.set(root, {
      specs: findAllSpecs(root),
      sources: findSourceFiles(root)
    });
  }
  return scanCache.get(root)!;
}

// 在 checkCompliance 入口统一预加载
export function checkCompliance(projectRoot: string, options = {}): GuardResult {
  const { specs, sources } = getCachedScans(projectRoot);
  // 后续 checkShall/checkShallNot/checkPonytail 复用缓存
}
```

### Layer 3: 全局改造（依赖 Layer 0 完成）

#### L3-1: 全局空捕获替换

**执行策略**：按风险分级处理

| 优先级 | 策略 | 目标 |
|--------|------|------|
| P0-关键 | 主业务逻辑 catch | Logger.warn + 保留错误传播 |
| P1-文件系统 | readdir/readFile catch | Logger.debug + 合理 fallback |
| P2-最佳尝试 | fire-and-forget | Logger.trace |

**首批处理文件**（按空捕获数量排序）：
1. spec/loader.ts (19 处)
2. core/experiment-engine.ts (15 处)
3. cli/commands/change.ts (12 处)
4. cli/commands/feedback.ts (8 处)
5. contract/manager.ts (8 处)

#### L3-2: cli/index.ts — 动态 import

**边界影响**：无接口变更，启动性能提升

```typescript
// 修改前（静态 import）
import { registerSpecCommands } from './commands/spec.js';
import { registerChangeCommands } from './commands/change.js';
// ... 29 个静态 import
registerSpecCommands(program);
registerChangeCommands(program);
// ... 29 个注册调用

// 修改后（动态 import + 命令懒加载）
const COMMAND_REGISTRY: Record<string, () => Promise<{
  register: (program: Command) => void;
}>> = {
  spec: () => import('./commands/spec.js'),
  change: () => import('./commands/change.js'),
  // ... 其他命令
};

// 主入口保持同步 import 仅注册「命令路由器」
// 实际模块在 action 执行时异步加载
```

**降级方案**：若动态 import 导致类型问题，保留静态 import 但将 29 个 register 调用拆分到各自独立的 lazy 包装函数中。

## 3. 边界文档更新清单

| 文件 | 变更 |
|------|------|
| src/core/.mumuspec/BOUNDARY.md | 添加 Logger 类型和接口声明 |
| src/cli/commands/.mumuspec/BOUNDARY.md | 添加 discard confirm 选项说明 |
| src/.mumuspec/BOUNDARY.md | 在 E-SECURITY 错误码部分添加 SECURITY-002/003 |
| src/change/.mumuspec/BOUNDARY.md | 更新 paths.ts 契约说明 |

## 4. 测试策略

### 4.1 新增测试

| 测试文件 | 覆盖 |
|----------|------|
| tests/core/logger.test.ts | Logger 分级输出、JSON 模式、环境变量控制 |
| tests/core/utils.test.ts (扩展) | validateChangeName 边界 |
| tests/change/paths.test.ts | 路径穿越防护 |
| tests/cli/knowledge-git.test.ts | shell 注入修复验证 |
| tests/mcp-server.test.ts [NEW] | handleToolCall 安全校验 |

### 4.2 现有测试回归

- `npm run tests` 全部通过
- 不修改锁定的 Red-Green TDD 测试用例

## 5. 验证清单

- [ ] `npm run build` 无错误
- [ ] `npm run test` 全部通过（零失败）
- [ ] `npm run lint` 无新增违规
- [ ] `validate('../../etc')` 返回 false
- [ ] MCP `get_spec_context` 传入 `path: '../evil'` 返回安全错误
- [ ] `knowledge-git.ts` 中 `shell:true` 全部清除
- [ ] `loop-engine.ts` commit 使用参数数组
- [ ] `discard` 无 `--confirm` 时退出码 130
- [ ] 冷启动 `--help` < 250ms（secondary优化目标）
