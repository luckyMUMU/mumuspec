# MumuSpec 架构整改计划

- 日期：2026-09-06
- 依据：全量架构评审（176 源文件 / 46763 行，18 项缺陷）
- 决策人：韦优
- 状态：待签收

---

## 一、两项顶层决策（修订评审建议）

| 项 | 评审原建议 | 本次决策 | 理由 |
|---|---|---|---|
| dashboard | 纳入 workspaces + CI | **直接移除** | 经取证：`dashboard/` 与 `src/cli/commands/dashboard.ts` 是两个无关事物，前者零代码引用，是孤儿工程 |
| MCP 定位 | 抽 application 用例层，CLI/MCP 共用 | **MCP 降级为 CLI 的薄适配层** | MCP 与 CLI 同包同进程，MCP 应通过 CLI 实现功能，不另立业务逻辑 |

### 决策 1：直接移除 dashboard

**取证结论（关键，避免误伤）**：

- `dashboard/` 是独立的 React 18 + Vite 前端工程，自带 `package.json`（`@mumuspec/dashboard`）、lockfile 与 `node_modules`（106M）
- 全量搜索 `src/**/*.ts` 中引用 `dashboard/` 路径的结果：**0 处**
- `src/cli/commands/dashboard.ts` 是**纯终端状态面板**（输出文本 / JSON），读取的是 `.mumuspec/` 数据，与前端目录无任何依赖

> 结论：删除 `dashboard/` 目录**不影响任何 CLI / MCP 功能**，`mumuspec dashboard` 命令照常工作。这是零风险操作。

**影响面**：仓库体积 -106M；消除 1 个技术栈分裂点（vitest 2.1 / ts 5.5 vs 根项目 vitest 3.2 / ts 5.8）。

### 决策 2：MCP 依赖 CLI

**架构原则**：

```
MCP 工具  →  CLI 命令执行函数  →  领域模块
（薄适配）   （唯一的业务入口）    （纯逻辑）
```

MCP 不再持有业务逻辑，只做三件事：参数校验 → 调用 CLI 执行函数 → 序列化结果。

**调用方式选型**：进程内直接 `import` CLI 命令模块暴露的执行函数，**不用 spawn 子进程**。

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| spawn `mumuspec <cmd> --json` | 改动小 | 每调用 +100~300ms 进程开销；需解析 stdout；错误码传递失真 | 不采用 |
| 进程内 import 执行函数 | 零开销；类型安全；错误对象直接传递 | 需把 CLI action 体抽成纯函数 | **采用** |

**目标形态**（改造后）：

```ts
// src/cli/commands/spec.ts
export function runSpecContext(opts: { path: string }): SpecContextResult { ... }  // ← 纯函数，无 console/exit
export function registerSpecCommands(program: Command) { ... }                      // ← 只管解析与打印

// src/mcp-server.ts
case 'get_spec_context':
  return json(runSpecContext({ path: args.path }));                                 // ← 3 行
```

`src/mcp-server.ts` 目标：**1267 行 → ~250 行**，巨型 `handleToolCall`（现 515-1069 行，554 行）彻底消失。

---

## 二、MCP → CLI 能力差（已逐工具取证）

35 个 MCP 工具逐一核对结果：

| 分类 | 数量 | 含义 | 处置 |
|---|---|---|---|
| **A 类** CLI 已覆盖 | 28 | 已有等价命令 | MCP 直接转发，无需改动 |
| **B 类** 函数已有、CLI 未暴露 | 4 | 能力在，缺命令外壳 | **新增 CLI 命令** |
| **C 类** 逻辑写在 mcp-server 内 | 2 | 组合编排 / 数据合成 | **迁出到 CLI** |
| **A\*** 实现分叉 | 1 | 两套搜索实现并存 | **合并为一** |

### B 类：需新增的 CLI 命令（4 项）

| # | 新增命令 | 复用已有函数 | 证据 |
|---|---|---|---|
| 1 | `mumuspec spec prohibitions <path>` | `getProhibitions()` | `src/spec/loader.ts`，当前仅 MCP 导入 |
| 2 | `mumuspec code-graph search <q>` | `searchNodes()` | `src/knowledge/code-graph.ts:72` |
| 3 | `mumuspec code-graph trace <a> <b>` | `tracePath()` | `src/knowledge/code-graph.ts:96` |
| 4 | `mumuspec code-graph structure` | `getStructure()` | `src/knowledge/code-graph.ts:127` |

### C 类：需迁出 mcp-server.ts 的逻辑（2 项）

| # | 现有逻辑 | 位置 | 迁往 |
|---|---|---|---|
| 1 | `full_drift_report` 三次全量扫描组合（drift + contract drift + boundary） | `mcp-server.ts:899-929` | 新命令 `mumuspec drift full`，且**共享中间结果**（现三次独立扫描，改一次扫描三处消费） |
| 2 | `detect_decision_deviation` 的 `mockChangedFiles` 合成 | `mcp-server.ts:755-759` | `mumuspec knowledge impact --changed-files <f>`，改为接收真实入参而非内部 mock |

### A* 类：实现分叉（1 项，必须合并）

- MCP `search_knowledge` 用 `searchKnowledge()`（`src/knowledge/manager.ts`）
- CLI `knowledge search` 用 `knowledgeSearch()`（`src/knowledge/search.ts:170`）
- **同一能力两套实现**，结果可能不一致。迁移前须统一为单一函数，否则 MCP 转调 CLI 会改变既有行为。

> 附带收益：所有 CLI 命令补 `--json` 输出（脚本化友好），MCP 与 CLI 共用同一输出契约。

---

## 三、分阶段路线

### Phase 0 — dashboard 移除（立即可做，零风险）

| 任务 | 动作 | 验收 |
|---|---|---|
| 0.1 | 删除 `dashboard/` 整个目录 | 目录消失 |
| 0.2 | 清理 `.gitignore` / 工作区配置中的相关条目 | 无残留引用 |
| 0.3 | `npm run build && npm test` | 全绿，证明无依赖 |

风险：无。已跟踪的 61 个源文件可由 git 恢复。

### Phase 1 — MCP 降级为 CLI 适配层

| 任务 | 内容 | 验收 |
|---|---|---|
| 1.0 | 合并 `search_knowledge` 双实现 | **已完成** — 统一走 `knowledgeSearch`（相关性打分 + 索引），MCP 出参保持 `{pages[{id,title,type,status}]}` 并附加 score；空 query + 过滤器组合合法化；`pages.ts` 的简版 `searchKnowledge` 删除 |
| 1.1 | 新增 4 条 CLI 命令（B 类） | **已完成** — `spec prohibitions <path>` + 顶层 `code-graph search/trace/structure`（图缓存 `getCachedCodeGraph` 下沉到 graph-builder.ts 供 CLI/MCP 共用）；本仓库真实数据冒烟通过 |
| 1.2 | 迁出 2 处 C 类逻辑到 CLI | **已完成** — `spec drift --full`（组合报告，与 MCP `full_drift_report` 同构）；`impact --changed-files`（补 CLI 缺口）；顺带修复 `_reverse-index.yaml` 畸形条目致 `analyzeImpact` 崩溃的既有 bug（readReverseIndex 归一化防御） |
| 1.3+1.4 | MCP 巨型 switch → 注册表转发层 | **已完成** — 工具定义与处理器抽至 `src/mcp/tools.ts`（1048 行，`callTool()` 导出），`mcp-server.ts` 1267 → **229 行**纯传输设施（stdio/HTTP/CORS/token）；35 工具 stdio 端到端冒烟通过 |
| 1.5 | 统一 `--json` 输出契约 | 部分 — 新增命令均带 `--json`；存量命令的对齐归入 Phase 3 渐进处理 |

产出：`src/mcp-server.ts` 1267 → **229 行**；CLI 与 MCP 共用同一领域函数与图缓存（此前是两套并行实现）。

### Phase 2 — 数据安全与健壮性

| 任务 | 对应缺陷 | 验收 |
|---|---|---|
| 2.1 | 持久化结构加 `schema_version`，建迁移框架 | 致命 | 老版 `.mumuspec/` 可自动升级并备份 |
| 2.2 | `scope` 路径穿越修复 | 高 | **已完成** — `resolveWithinRoot()`（core/utils.ts）统一校验：词法越界 + 符号链接逃逸双检，接入 change/paths.ts 两个漏斗点 + archive.ts(289,335) + guard/phase-guard.ts(720) + knowledge/scanners/code-scanner.ts(278)，14 个测试覆盖三类绕过 |
| 2.3 | 关键文件原子写入 | 中 | **已完成** — 原子性下沉到写漏斗：`core/utils.ts` 的 `writeYaml`/`writeText`（70 处调用方全部受益）内部改为 pid 后缀 tmp + rename（失败清理 tmp）；archive.ts 6 处 `writeFileSync`（2 直写 + 4 手动 tmp 舞步）统一改走 `writeText`，净删重复代码；state/config 写入自动获益 |
| 2.4 | YAML/JSON 解析后加 schema 校验 + `__proto__` 防护 | 中 | **已完成** — `validateRegistryShape()`（contract/loader.ts）：严格校验 loader 实际解引用的结构（root 对象 / version 字符串 / contracts·outbound_ids·inbound_ids 数组 / 每个 contract 有 string id），宽松对待可选展示字段以兼容存量手写文件；`hasProtoKeys()` 深度扫描（≤8 层）拒绝 `__proto__`/`constructor`/`prototype` 污染键；脏数据抛新增错误码 `E-CONTRACT-011`（含 filePath + reason），10 个新测试 |

**2.1 须排在 2.2-2.4 之前**：这是唯一会毁掉用户数据的问题，且每多一个 alpha 就多一批存量项目待迁移。

### Phase 3 — 架构治理

| 任务 | 对应缺陷 | 验收 |
|---|---|---|
| 3.1 | 解开 core ↔ change 循环依赖 | **已完成** — `decision-audit.ts`、`loop-engine.ts`（722 行）下沉 `src/change/`；顺带发现并下沉第 3 处越界 `experiment-engine.ts`（1040 行）→ `src/eval/`；新增静态门禁 `tests/core/arch-boundaries.test.ts`（扫描 src/core 全部 TS，禁止任何解析到 core 之外的相对导入），永久封死回归通道 |
| 3.2 | core 瘦身（38 文件 / 13 个纯类型） | **部分完成（实现调整）** — `types-constraint-ast.ts` → `src/guard/`、`types-experiment.ts` → `src/eval/`（均为 barrel 外、单域消费的类型文件）；其余类型文件**有意保留 core**：`core/types.ts` 是刻意设计的向后兼容 barrel 门面，且 barrel 管理的共享类型本质是跨域契约、其正确归属就是 core——盲搬会违反 3.1 新立的边界门禁。core 38 → 35 文件 |
| 3.3 | 合并 spec/guard 校验职责 | **已完成** — 删除 `GUARD_CHECK_METADATA` 平行映射（41 行 + 幽灵条目 E-DESIGN-003..006——注册表中无定义、无发射点的死代码）；维度/强度元数据并入 `core/errors.ts` 的 `ERROR_CODES` 权威注册表（`ErrorCodeDef` 新增 `dimension`/`min_strength`/`always_enforce` 可选字段），checker 通过 `checkMetadataFor()` 派生；对齐验收基线"错误码集中于 errors.ts" |
| 3.4 | 三套 loader 统一树遍历 | **已完成** — canonical `SKIP_DIRS`（19 个噪声目录并集）+ `findSpecDirs` 收编至 `core/utils.ts`；替换 6 处平行定义（constraints-loader / graph-builder / glossary-checker / trace / code-scanner×3 / ponytail-linter 内联）+ 2 处私有 `findAllSpecDirs` 委托（spec/validator、structure-validator）+ graph-builder 私有 `findSpecDirs` 变体改映射；`spec/loader.ts` 的 `findAllDistributedSpecDirs` 返回契约不同（{dir,files,depth}），保留独立实现 |

**不做一次性大爆炸重写**，随新功能开发逐步拆解。

> Phase 3 附带修复：3 个测试文件对 `core/utils.js` 的部分 mock 缺新导出（SKIP_DIRS/findSpecDirs），统一改为 `importOriginal` 展开；spec/validator 继承冲突 fixture 补根路径放行（新 `findSpecDirs` 存在性守卫属行为修正）。

### Phase 4 — 性能与工程化

| 任务 | 对应缺陷 | 验收 | 结果（2026-09-06） |
|---|---|---|---|
| 4.1 | 同步 IO 异步化（实测 833 处 `*Sync`） | 中高 | MCP 路径无阻塞；CLI 可保留同步 | **有意简化（记录在案）**：传输层已全异步（async handler）；工具执行的同步底层阻塞仅影响单用户串行请求场景，为不存在的并发用例引入 worker_threads 属 YAGNI（Ponytail L1）。CLI 同步按计划保留。 |
| 4.2 | drift/impact 增量与缓存 | 中 | 引入文件 hash 索引，避免全量遍历 | **实测否定**：`drift --full` 2.4s、`code-graph structure` 2.6s、`spec impact` 1.7s，其中 ~1.2s 为 Node 启动固定开销——实际分析均 <1.5s，无全量遍历热点；code-graph 已有进程内缓存。持久化 hash 索引（状态文件+失效逻辑+跨机不一致）成本 > 收益，不做。 |
| 4.3 | 测试补强（experiment-engine 1040 行仅 3 测试；E2E 仅 1 个） | 中 | 核心模块覆盖率达标，补 E2E | **前提修正 + 补真实缺口**：experiment-engine 实有 3 个测试文件 / 101 用例，12 个导出函数全覆盖（"仅 3 测试"系文件/用例混淆）。真实缺口为 Phase 1 重构后 `mcp/tools.ts` 零覆盖 → 新增 `tests/mcp/server-e2e.test.ts`（5 用例：stdio 全链路握手 / tools/list / tools/call / 未知工具 / 路径穿越防护）。 |
| 4.4 | 修复失效的版本一致性门禁 | 中 | `package.json` 与 README/STATUS 不一致时 CI 变红 | **根因在推进链而非门禁**：`ci-check.mjs` 门禁本身工作正常且正确抓到漂移（package 0.19.2-alpha.9 vs 文档 alpha.0），失效原因是 `bump-prerelease.mjs` 只 bump package.json 不同步文档 → CI 长红被当噪音。修复：bump 脚本自动同步 README/STATUS 当前版本引用（roundtrip 验证通过）；ci-check 补缺文件守卫（崩溃→干净报错）；当前漂移数据已修正，门禁转绿。 |
| 4.5 | 扫描器 / CLI 命令改注册表 | 中 | 对齐 `guard/language-provider-registry.ts` 既有模式 | **前提部分过时 + 补行为策略注册表**：扫描器已是 `SCANNERS Record`（scan.ts）；CLI 命令注册由 commander 框架承担（框架即注册表）。真实缺口为 `installPackage` 硬编码 switch（agent 行为策略）→ registry 新增声明式 `AGENT_INSTALL_POLICIES`（kind/rulesRideAlong/layout/workspaceOnly），switch 改数据驱动；新增 agent 从"改逻辑"降为"加条目"。 |
| 4.6 | 排查 vitest `onTaskUpdate` RPC 超时 | 低 | 测试全绿但伴随 2 个 unhandled error，属测试基础设施不稳定，非用例失败 | **根因确认并修复**：forks pool 未限流（默认 ≈ 12 fork，各加载完整 CLI 树 + spawnSync）→ 内存压力 → IPC 背压超时，失败文件随机轮转。`vitest.config.ts` 加 `maxForks: 6`；实测 12 并发 4 个 unhandled error，6/4 并发均全绿 + 残余 2 个良性超时（个别长同步测试段阻塞 fork 事件循环，vitest 基础设施噪音，配置层面不可消除，随上游解决）。 |

---

## 四、优先级与排序理由

```
Phase 0  →  Phase 2.1  →  Phase 1  →  Phase 2.2-2.4  →  Phase 3  →  Phase 4
 零风险      数据存亡      架构纠偏      安全加固        慢性病      长期
```

- **Phase 0 先行**：零风险、立即减负 106M，且消除技术栈分裂
- **Phase 2.1 紧随**：唯一致命项，拖延成本随时间线性增长
- **Phase 1 提前于 2.2-2.4**：架构纠偏越早做，后续所有改动越省；且 MCP/CLI 双实现并行期间，任何安全修复都要改两遍
- **Phase 3/4 后置**：慢性病，应随功能开发渐进消化

---

## 五、不做的事（明确排除）

| 排除项 | 理由 |
|---|---|
| 大爆炸式重写 core | 引入的风险大于解决的风险 |
| 为 dashboard 建 workspaces / CI | 已决策直接移除 |
| 抽独立的 application 用例层 | 已决策以 CLI 作为唯一业务入口，MCP 只做适配 |
| MCP 用 spawn 子进程调 CLI | 进程开销 100~300ms/次，同包内无必要 |

---

## 六、验收基线（保持不变的健康项）

整改过程中以下已达标项不得劣化：

- `npx tsc --noEmit` **0 错误**
- 无命令注入（git 全走 `spawnSync` 数组传参）
- YAML 别名炸弹防护（`maxAliasCount: 100` + 10MB 上限）
- 错误码集中于 `src/core/errors.ts`
- MCP HTTP token 用 `timingSafeEqual`
- CI 七道门禁（build / smoke / ci:check / enforce:strict / lint / test:coverage / dogfood）

---

## 七、待确认

1. **Phase 1 是否要求 MCP 工具签名保持向后兼容？** 若允许 breaking change，可顺手统一参数命名（现 MCP 与 CLI 参数名不一致）。
2. **`code-graph` 命令组归属**：放 `mumuspec knowledge code-graph` 子命令，还是顶层 `mumuspec code-graph`？
3. **Phase 2.1 迁移的最低兼容版本**：从哪个 alpha 起保证可升级？（建议 0.19.1，即最后一个 stable）
