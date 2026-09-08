# Phase 2.1 设计：持久化 schema 版本与迁移框架

> 阶段：Phase 2.1（唯一致命项，优先于所有其他整改）
> 状态：待签收
> 日期：2026-09-06

---

## 1. 问题

MumuSpec 的产品承诺是「Spec 是一等源文件、持久化、版本化管理、不随代码删除而消失」。但承载这些数据的引擎**不认识自己写出的格式版本**：

- `ChangeState`（`.mumuspec/changes/<n>/.mumuspec.yaml`）**无 version 字段**
- `config-io.ts` 默认 `version: '0.1.0'`，读取后无迁移，注释明言 "Old changes keep their original value (not migrated)"
- `errors.ts:104` 遇到未知 schema 版本**直接拒绝**，无升级路径

后果：0.19.2 已连发 9 个 alpha，每个都在改状态机字段。老项目升级时要么崩溃，要么读到半新半旧的状态。丢失的不是缓存，是用户的全部规范资产与决策日志。

## 2. 现状盘点

| 持久化结构 | 位置 | version 字段 | 迁移机制 |
|---|---|---|---|
| `MumuSpecConfig` | `.mumuspec/config.yaml` | 有（`'0.1.0'`） | 无 |
| `ChangeState` | `.mumuspec/changes/<n>/.mumuspec.yaml` | **无** | 无 |
| `ContractRegistry` | `contracts.json` / `.yaml` | 有（`types-contract.ts:92`） | 无 |
| 规范树索引 | `.mumuspec/index.yaml` | 待确认 | 无 |

`src/core/migrations/` 不存在。

## 3. 设计

### 3.1 版本常量集中

新建 `src/core/schema-version.ts`：

```ts
export const SCHEMA_KINDS = ['config', 'changeState', 'contractRegistry'] as const;
export type SchemaKind = typeof SCHEMA_KINDS[number];

export const CURRENT_SCHEMA_VERSION: Record<SchemaKind, string> = {
  config: '1.0.0',
  changeState: '1.0.0',
  contractRegistry: '1.0.0',
};

/** 无 version 字段的历史数据按此版本处理 */
export const LEGACY_VERSION = '0.0.0';
```

版本从 `1.0.0` 起步而非沿用 `0.1.0`——旧值语义混乱（config 的 0.1.0 与 contract 的 version 含义不同），重新开始避免歧义。

### 3.2 迁移器契约

新建 `src/core/migrations/types.ts`：

```ts
export interface Migration {
  kind: SchemaKind;
  from: string;          // 精确源版本（semver）
  to: string;            // 目标版本
  description: string;
  migrate(data: Record<string, unknown>): Record<string, unknown>;  // 纯函数，不改入参
}
```

纯函数是硬要求：迁移必须可重放、可单测、可中断重试。

### 3.3 迁移链解析

新建 `src/core/migrations/index.ts`：

```ts
export const MIGRATIONS: Migration[] = [ /* 全部迁移器 */ ];

/** 按 kind 过滤后拓扑排序，返回从 fromV 到 current 的最短迁移链 */
export function resolveMigrationChain(kind: SchemaKind, fromV: string): Migration[]
```

当前**没有历史迁移需要补**——存量数据全部是 `0.0.0`（无版本字段）。因此 v1 只需建立框架 + 一个「0.0.0 → 1.0.0 打标」迁移器，为后续版本留出挂载点。这是刻意的 YAGNI：不为假想的历史版本写迁移代码。

### 3.4 统一入口

新建 `src/core/migrations/runner.ts`：

```ts
export interface MigrationResult<T> {
  data: T;
  version: string;          // 迁移后版本
  applied: string[];        // 已应用的迁移描述
  backupPath?: string;      // 备份位置（仅实际迁移时存在）
}

export function migrateSchema<T>(
  kind: SchemaKind,
  raw: unknown,
  opts: { projectRoot: string; filePath: string; backup?: boolean },
): MigrationResult<T>
```

**行为约定**（按优先级）：

1. **无 version 字段** → 视为 `LEGACY_VERSION`，走完整迁移链
2. **版本高于当前** → 抛出明确错误：`数据版本 X 高于本工具支持的 Y，请升级 MumuSpec`。**不静默降级读取**
3. **迁移前备份**：写入 `.mumuspec/temp/migrations/<ISO8601>/<相对路径>`（`.mumuspec/temp/` 已被 `.gitignore` 忽略）
4. **幂等**：已达当前版本 → 返回 no-op，`applied: []`，不备份
5. **迁移抛错** → 向上传播，调用方决定降级还是失败。**不做"迁移失败就用旧数据"的静默兜底**——半迁移的状态比报错更危险

### 3.5 接入点

| 函数 | 文件 | 改动 |
|---|---|---|
| `loadChangeState` | `src/change/state.ts` | 读 YAML 后调 `migrateSchema('changeState', ...)` |
| `saveChangeState` | `src/change/state.ts` | 写入时补 `schema_version = CURRENT` |
| `loadConfig` | `src/core/config-io.ts` | 读后迁移 |
| `saveConfig` | `src/core/config-io.ts` | 写入当前版本 |
| `loadContractRegistry` | `src/contract/loader.ts` | 读后迁移 |

`ChangeState` 接口加可选字段：

```ts
/** Schema version for migration; absent means pre-1.0 legacy data */
schema_version?: string;
```

可选而非必填——存量数据在类型层面仍是合法输入，由迁移器负责补齐。

### 3.6 与 Phase 2.4 的关系

Phase 2.4 要求「解析后加 schema 校验」。迁移框架**先于**校验执行：

```
读文件 → 解析 YAML/JSON → 【迁移到当前版本】→ schema 校验 → 业务使用
```

顺序不可颠倒，否则旧数据会被新 schema 直接拒绝。

## 4. 测试要求

| 用例 | 期望 |
|---|---|
| 无 version 的 legacy 数据 | 识别为 `0.0.0`，迁移到 `1.0.0` |
| 已是当前版本 | no-op，`applied` 为空，不产生备份 |
| 版本高于当前 | 抛错，消息含「请升级 MumuSpec」 |
| 幂等性 | 连续迁移两次结果深度相等 |
| 备份 | 实际迁移时备份文件存在且内容等于迁移前 |
| 纯函数 | `migrate()` 不修改入参对象 |
| 迁移抛错 | 错误向上传播，不返回半迁移数据 |

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 迁移逻辑出错损坏数据 | 强制先备份；迁移器为纯函数便于单测；幂等设计 |
| 备份目录堆积 | 备份落在 `.mumuspec/temp/`（已 gitignore）；后续可加清理策略 |
| 接入点遗漏（某处直接读 YAML 未过迁移） | 实现后全局搜索 `readYaml`/`parseYaml` 的持久化读取点，逐个核对 |

## 6. 验收

1. 构造一份无 `schema_version` 的 `.mumuspec.yaml`，`mumuspec status` 能正常读取并写入版本号
2. 构造高版本数据，命令报错而非崩溃
3. `npx tsc --noEmit` 0 错误
4. `npm test` 全绿，新增迁移测试通过

## 7. 不做的事

- **不为假想的历史版本写迁移代码**（YAGNI）——存量全是 `0.0.0`
- **不做自动回滚**——备份 + 幂等已足够，回滚逻辑本身是新的出错源
- **不动 spec.md / knowledge 等 Markdown 内容**——它们是用户内容，不是引擎 schema

---

## 8. 实现调整记录（代码与文档一致性）

| 设计原文 | 实际实现 | 理由 |
|---|---|---|
| 3 个文件（`migrations/types.ts` + `index.ts` + `runner.ts`） | 合并为 `src/core/migrations.ts` 单文件（版本常量独立为 `src/core/schema-version.ts`） | 总量约 160 行，拆 3 文件属过度切分（Ponytail L6） |
| `migrateSchema` 接收 `projectRoot` + `filePath` | 改为 `filePath` + 可选 `backupDir` | `loadContractRegistry` 无 projectRoot 入参；备份目录由调用方决定，职责更清晰 |
| 存量 config 的旧 `version` 字段参与版本判定 | 不参与——仅认 `schema_version` 字段，旧 `version` 原样保留 | 旧值语义（工具版本）与 schema 版本不同，混判会产生无迁移器的 `0.1.0` 路径 |
| `loadContractRegistry` 直接 `as` 断言 | 顺带加了非对象守卫（`continue`） | 最小必要的脏数据防护（Phase 2.4 的前哨，未越界做完整校验） |
| 读路径迁移后回写磁盘 | 只迁移到内存，不回写；版本号在下次 save 时落盘 | 读操作不应有写副作用（对 `status` 等只读命令与并发安全都重要） |
