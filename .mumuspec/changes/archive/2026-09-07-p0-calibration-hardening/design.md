# Design: p0-calibration-hardening

> 变更来源：`review/spec-code-calibration-2026-09-05.md` P0 清单（TEMP 与 GLOSSARY 两项已由 doc-governance-decisions 消解）。
> 本文档将 proposal 的 4 项 P0 细化为可实现的层级设计，作为 build 阶段蓝图。
> 范围决策（用户已签收，grill-me BP）：P0-A 最小版；P0-B 用 max_layer_depth；逐步推进+BP 确认。

## 0. 设计目标与原则

收敛 spec 硬性 SHALL 与代码实现的差距，使规范链对代码的约束声明不再失真。坚持：
- **Ponytail**：最小可工作实现，无未请求抽象。
- **规则-实现分离（KP-0060）**：确定性逻辑归代码，校验失败拒绝执行（fail-closed）。
- 不破坏既有 CLI/API 契约（向后兼容）。

## 1. 分层计划（自底向上）

| 层 | scope | 内容 |
|----|-------|------|
| L0 | loader 层数 | P0-B：selectLayersToLoad 使用 max_layer_depth |
| L1 | rules 容量断言 | P0-C：rules-generator 产物 ≤ 32KiB |
| L2 | capability 元数据 | P0-A：CommandMetadata + `mumuspec capability` |
| L3 | finalize-archive | P0-D：原子性/回滚、code-graph snapshot、cache 删除、防重跑 |

## 2. P0-B — loader 层数配置化（L0）

### 问题
`src/spec/loader.ts:358-376` `selectLayersToLoad(chain, _maxDepth)` 忽略 `_maxDepth`，硬编码 3 层。违反 spec「SHALL NOT hardcode a fixed number of layers」。

### 决策
- 采纳配置 `config.specs.max_layer_depth`（默认 5，`config-io.ts:18`）。
- 语义：渐进式披露优先保留 root（level 0）+ target（最深），中间层**最多取 (max_layer_depth − 2)** 个；当实际含 spec 层数 ≤ max_layer_depth 时全量返回，超出时做降载。

### 设计
```ts
// 伪码
function selectLayersToLoad(chain, maxDepth): layers {
  const withSpecs = chain.filter(c => hasMumuspec(c));
  if (maxDepth <= 0) maxDepth = DEFAULT_LAYER_DEPTH; // 防御非法配置
  if (withSpecs.length <= maxDepth) return withSpecs;
  // 保 root + target，中间层截断以尊重 maxDepth 上限
  const root = withSpecs[0];
  const target = withSpecs[withSpecs.length - 1];
  const keep = maxDepth - 2;
  const middle = withSpecs.slice(1, -1);
  const capped = middle.length <= keep ? middle : middle.slice(middle.length - keep);
  return [root, ...capped, target];
}
```
> 注：`_maxDepth` 改为 `maxDepth`；`config.specs.max_layer_depth` 已由调用方传入（loader.ts:41）。修正命名即消除未使用参数。

### Enforcement
- ENF-B1（test）：depth=3、5、10 下行为断言（全量返回 vs 降载保根+目标）。
- ENF-B2（test）：非法/缺失配置回退默认 5。

### 风险
- 既有行为是"3 层"，默认配置 5 层会加载更多 context，token 略增。可接受（对齐 spec 承诺）。

## 3. P0-C — Rules 产物 32KiB 容量断言（L1）

### 问题
spec「分发层 AGENTS.md canonical」ENF-3 要求生成产物 ≤ 32KiB，全仓无实现。

### 决策
- 在规则生成链的**落盘点**加容量校验（`src/install/rules-generator.ts` 或其在 install.ts/init.ts 的调用方），fail-closed。
- 32KiB = 32 × 1024 = 32768 bytes（UTF-8 length）。

### 设计
```ts
export const MAX_RULES_BYTES = 32 * 1024;
export function assertRulesWithinBudget(content: string, target: string): void {
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_RULES_BYTES) {
    throw new MumuSpecError('E-RULES-001', { 生成文件: target, 实际字节: bytes, 上限: MAX_RULES_BYTES,
      修复: '缩减 Rules 内容（渐进式披露归 MCP），不可内联全量规范' });
  }
}
```
- 在 AGENTS.md 写盘前调用；失败拒绝写入并退出非 0。
- 新增错误码 E-RULES-001（注册到 `src/core/errors.ts` 与 error-codes 文档）。

### Enforcement
- ENF-C1（test）：合成 >32KiB 内容 → 抛 E-RULES-001。
- ENF-C2（test）：正常生成物（本仓 AGENTS.md）≤ 32KiB 通过。
- ENF-C3（架构）：生成路径（`src/install/`）无 .cursorrules/.windsurfrules 字面量（既有约束回归）。

## 4. P0-A — CommandMetadata + `mumuspec capability`（L2）

### 问题
spec「命令能力分层（Capability Tier）」整块无代码。决策：最小版——不实现全局 dry-run 框架与名称二次确认（二期）。

### 决策（最小版）
- 引入 `CommandMetadata` 接口描述命令能力属性。
- 提供 `mumuspec capability <command>` 查询任意命令的元数据；`mumuspec capability` 无参列出全部。
- 元数据以**集中注册表**维护（不侵入 40+ 命令文件的注册函数签名，避免大面积改动）。

### 设计
```ts
// src/cli/capability.ts (新)
export type CommandTier = 'general' | 'dedicated';
export interface CommandMetadata {
  tier: CommandTier;
  risk: 'none' | 'low' | 'medium' | 'high';
  confirmRequired: boolean;   // 是否需 --confirm
  reversible: boolean;
  composable: boolean;        // general 能力 true，专用工具 false
  destructive?: boolean;      // 是否涉及文件系统副作用
}

// 注册表：key = 顶层命令名；value = 元数据。缺失条目回落默认 general/low。
export const COMMAND_METADATA: Record<string, Partial<CommandMetadata>> = {
  'archive':        { tier: 'dedicated', risk: 'high',   confirmRequired: true,  reversible: false, composable: false, destructive: true },
  'discard':        { tier: 'dedicated', risk: 'high',   confirmRequired: true,  reversible: false, composable: false, destructive: true },
  'finalize-archive':{ tier: 'dedicated', risk: 'high',  confirmRequired: false, reversible: false, composable: false, destructive: true },
  'install':        { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true,  composable: false, destructive: true },
  'init':           { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: false, composable: false, destructive: true },
  'new':            { tier: 'dedicated', risk: 'low',    confirmRequired: false, reversible: false, composable: false, destructive: false },
  'state':          { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true,  composable: false, destructive: true },
  'test-cases':     { tier: 'dedicated', risk: 'low',    confirmRequired: false, reversible: true,  composable: false, destructive: false },
  // general (只读/查询类)：不枚举，回落默认
};
export function getCommandMetadata(cmd: string): CommandMetadata; // 合并默认
```

### capability 命令（command/capability.ts 新）
```ts
program
  .command('capability [command]')
  .description('查询命令能力属性（tier/risk/confirm/composable）')
  .action((command?: string) => { /* 列出或单查，含 --json */ });
```
- `getCommandMetadata` 对未登记命令回落 `{tier:'general', risk:'none', confirmRequired:false, reversible:true, composable:true}`。
- 注册进 `src/cli/index.ts` 的命令分发；同步到 commands BOUNDARY 注册表（dogfooding 门禁 LOOP-4）。

### Enforcement
- ENF-A1（test）：capability archive → dedicated/high/confirmRequired；capability context → general 回落。
- ENF-A2（test）：capability 无参列出含全部已登记命令。
- ENF-A3（test）：--json 输出结构。
- ENF-A4（架构）：commands BOUNDARY.md 注册表同步（LOOP-4 覆盖）。

## 5. P0-D — finalize-archive 四项缺口（L3）

### 问题
`finalize-archive.ts`：无原子/回滚、code-graph snapshot 占位空（:327）、cache 陈旧项仅计数（:363）不删、无防重跑标记。

### 决策
- **原子性**：各子步骤结果先累积，任一步抛错即收集 warning 而非中止（保持现有宽容性），但对**关键写盘**用既有的 atomicWrite（writeText/writeYaml 已原子化，Phase 2.3）。
- **code-graph snapshot**：调用既有图构建器序列化当前结构（复用 `code-graph` 命令底层），替换占位。
- **cache 陈旧项**：`cleanStaleCache` 从"仅计数"改为实际删除（mtime > 30 天的 archived 目录引用），删除前打印路径。
- **防重跑标记**：在变更归档目录写入 `.finalized` 标记文件（含完成时间戳）；finalize-archive 检测到已存在则跳过重复步骤并提示（幂等）。

### 设计
```ts
function updateCodeGraphSnapshot(root, changeName, changeDir): void {
  // 复用 code-graph builder 生成当前快照写入 <root>/.mumuspec/codegraph.snapshot.json (或 temp/)，失败 warning
}
function cleanStaleCache(root, config): number {
  // 实际 unlinkSync 过期归档目录引用（非只计数）；返回删除数
}
function markFinalized(changeDir): void { writeText(join(changeDir,'.finalized'), nowISO); }
function isFinalized(changeDir): boolean { existsSync(join(changeDir,'.finalized')); }
```
- 入口 Step 0 加：若 `isFinalized(archivedDir)` → 输出"已 finalize，跳过重复子步骤"（幂等保护），除非 `--force`。

### Enforcement
- ENF-D1（test）：重复运行 finalize-archive 第二次被幂等拦截（有 .finalized）。
- ENF-D2（test）：cleanStaleCache 对过期目录实际删除、新目录保留。
- ENF-D3（test）：code-graph snapshot 非空生成（含节点数）或 warning 明确。
- ENF-D4（架构）：归档后原子性——关键写盘走 writeText/writeYaml（回归既有 atomic 测试）。

## 6. 测试策略

- TDD：每层先写失败用例（红），实现后转绿。
- 新增测试文件按模块落位：`tests/spec/loader-layers.test.ts`（P0-B）、`tests/install/rules-budget.test.ts`（P0-C）、`tests/cli/capability.test.ts`（P0-A）、`tests/change/finalize-archive-idempotency.test.ts`（P0-D）。
- 全量回归（vitest），注意并行抖动：失败文件单独复跑确认。
- `mumuspec check` / `drift` 通过；error-codes 文档再生成。

## 7. 风险与兜底
- P0-B 行为变化致 context token 增：用 ENF-B1 锁定降载路径，必要时回调默认。
- P0-A 注册表维护成本：采用"回落默认 + 白名单登记"，未登记命令不强制全量标注。
- P0-D snapshot 若图过大：输出 warning 不硬失败（延续现有宽容语义）。
- dogfooding 门禁：新增 `capability` 命令须同步 BOUNDARY.md + tests 计数（LOOP-4）。

## 8. 开放问题
- 无硬性开放问题（经 grill-me 决策后收敛）。P0-A dry-run 框架/名称二次确认为二期，非本变更范围（记录于 assumptions/deferred）。

## 9. 验收标准
- 4 项 P0 各有测试锁定 + 实现；全量测试通过；check/drift 通过。
- `mumuspec capability` 可查询命令能力；AGENTS.md 生成有容量守卫；loader 尊重 max_layer_depth；finalize-archive 幂等 + snapshot 非占位 + cache 实删。
