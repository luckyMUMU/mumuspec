---
workflow: full
phase: build
status: planned
dependencies: design.md
---

# 实现任务清单（Bottom-Up 顺序）

任务按层级排列，子级完成后才能开始父级。

---

## Layer 0: 基础设施叶模块

### T0-1: 创建 src/core/logger.ts (~80 行)

**验收标准**：
- 4 级日志：trace/debug/info/warn/error
- 通过环境变量 `MUMUSPEC_LOG_LEVEL` 控制级别
- JSON 模式 (`MUMUSPEC_LOG_JSON=true`) 输出到 stderr
- 默认模式保持人类可读
- 不破坏现有用户可见的 console.log 输出

**Ponytail 约束**：
- 不引入外部依赖
- 单文件模块

### T0-2: 扩展 src/core/utils.ts

**新增函数**：
- `validateChangeName(name: string): boolean`

**验收标准**：
- 通过白名单正则 `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`
- 拒绝含 `/`、`..`、空字符串、开头 `.`/`-` 的输入

### T0-3: 更新 core/.mumuspec/BOUNDARY.md

添加 Logger 接口声明到对外接口表。

### T0-4: 新增 tests/core/logger.test.ts

覆盖：
- 各级别输出行为
- MUMUSPEC_LOG_LEVEL 过滤
- JSON 模块标志输出

---

## Layer 1: 单文件安全修复

### T1-1: 修复 src/change/paths.ts 路径穿越

**修改点**：
- `getChangeDir()` 添加 validateChangeName 前置校验
- `getDiscardedDir()` 添加同样校验
- 非法输入抛出 `E-SECURITY-002`

**依赖**：T0-2

### T1-2: 修复 src/cli/commands/knowledge-git.ts shell 注入

**修改点**：
- 将 `spawnSync(cmd, { shell: true })` 全部替换为 `spawnSync('git', [args], {})`
- 文件内所有 commit/push/checkout/tag 命令均改为参数数组形式

**注意**：保持向后兼容（参数行为不变）

### T1-3: 修复 src/core/loop-engine.ts commit 注入

**修改点**：
- `:258` 行的 `execSync(`git commit -m "..."`)` 改为 `spawnSync('git', ['commit', '-m', message])`

### T1-4: 新增/扩展 tests/change/paths.test.ts

覆盖：
- validateChangeName 边界
- getChangeDir 传入非法值的异常行为

### T1-5: 新增 tests/cli/knowledge-git.test.ts

验证：shell 元字符不再被解释。

---

## Layer 2: 跨模块集成

### T2-1: MCP handleToolCall 安全校验层

**修改文件**：`src/mcp-server.ts`

**修改点**：
1. 在 switch 前加入 `safePath()` 中间件函数
2. 替换所有 `args.path as string` / `args.dir as string` 为 `safePath(args.path, root)`
3. 非法路径返回结构化错误 `E-SECURITY-001`

**依赖**：T0-2, T0-5（Logger 可选，建议错误时 warn）

### T2-2: CLI discard/archive 确认机制

**修改文件**：`src/cli/commands/change.ts`

**修改点**：
1. `discard` 命令增加 `--confirm` / `-y` 选项
2. 无 confirm 时输出警告 + exit(130)
3. archive 命令同理

### T2-3: guard/checker.ts IO 扫描合并

**修改点**：
1. 新增 `scanCache` 模块级缓存
2. `checkCompliance` 入口统一预加载
3. `checkShall`/`checkShallNot`/`checkPonytail` 改用缓存
4. 原有 catch {} 替换为 Logger.trace（T3-1 全局替换的一部分）

**依赖**：T0-1 (Logger)

### T2-4: 新增 tests/mcp-server.test.ts (conditional)

使用 mock transport 不启动真实 HTTP，覆盖：
- isPathSafe 校验拒绝
- undefined path 处理

---

## Layer 3: 全局改造

### T3-1: 全局空捕获替换（分批）

**第一批（高优先）**：
- spec/loader.ts (19 处) → Logger.debug
- cli/commands/change.ts (12 处) → Logger.warn
- contract/manager.ts (8 处) → Logger.trace
- guard/checker.ts (9 处) → Logger.trace

**第二批（中优先）**：
- core/experiment-engine.ts (15 处)
- cli/commands/knowledge-git.ts (修复后残留)
- cli/commands/feedback.ts
- cli/index.ts (top-level)

**第三批（低优先）**：
- 剩余 ~50 处的模块

**依赖**：T0-1

### T3-2: cli/index.ts 动态 import

**修改点**：
- 静态 register 调用包装为 lazy factory
- Commander 路由匹配时动态 import 对应模块
- 保留顶层 package 类型出口

**降级**：若类型/测试问题，保留静态 import 但将 register 调用直接挂 lazy 闭包

### T3-3: 更新 BOUNDARY.md 和错误码

- core/.mumuspec/BOUNDARY.md: 添加 logger + validateChangeName
- change/.mumuspec/BOUNDARY.md: 添加 validateChangeName 调用
- cli/commands/.mumuspec/BOUNDARY.md: 添加 --confirm 选项
- errors.ts: 添加 E-SECURITY-002 (invalid changeName)


---

## 验证运行

Layer 全部 run 后 run：
1. `npm run build`
2. `npm run tests` → TDD RED if broke / GREEN if pass
3. `npm run lint`
4. 手动测试：`mumuspec discard ../evil --reason test` → expect E-SECURITY-002

---

## 层级依赖图

```
T0-1 (Logger) ─────────────────┐
T0-2 (validateChangeName) ─────┤
T0-3 (core BOUNDARY) ──────────┤
T0-4 (logger test) ────────────┘
        │
        ├── T1-1 (paths fix)
        ├── T1-2 (knowledge-git fix)
        ├── T1-3 (loop-engine fix)
        │      │
        │      ├── T2-1 (MCP safePath)
        │      ├── T2-2 (discard confirm)
        │      ├── T2-3 (checker cache)
        │      │      │
        │      │      ├─ T3-1 (global catch)
        │      │      └─ T3-2 (dynamic import)
        │
        └── (parallel) mcp-server test (new)
```
