# MumuSpec 五维架构审查报告

> **审查主体**：Chief AI Infra Architect（首席AI基础设施架构师）
> **审查方式**：5 位专项 Subagent 并行只读审查（Explore Agent ×5，禁止任何写操作）
> **审查对象**：mumuspec（MumuSpec）— TypeScript CLI · 规范驱动 AI 编程工作流编排器
> **审查日期**：2026-08-08
> **参照物**：LangChain v0.3+ / Semantic Kernel (C#/Python) / Aider / Continue.dev Core / VSCode Native API

---

## 0. 审查方法与范围声明

### 0.1 方法论
5 位 Subagent 并行采集真实证据（源码 Grep + 只读基准实测 + 依赖审计），每位按量化锚点独立打分，主审汇总。

### 0.2 范围适配声明（重要）
审查框架描述的是"通用 Agent-Agnostic Harness"（含 LSP 交互、Diff 可视化、多模态 API 网关）。**mumuspec 的实际定位是"规范驱动工作流编排器"**，其能力边界为：上下文构建（渐进披露）、文件系统/工作树操作、git 命令执行、spec 校验与漂移检测、MCP Server 输出。**以下能力经核实不存在，评分中如实标注为 N/A 而非编造数据**：
- LSP 交互 → 不存在（Subagent 2 性能基准已相应适配为 validate/check/drift 实测）
- Diff 可视化编辑 → 不存在（drift 检测仅结构检查+子串匹配，见 §3.2）
- 多模态 API 网关 → 不存在（工具零 LLM 调用，见 §3.1）

### 0.3 硬性规则合规总览（全部通过）

| 硬性规则 | 结果 | 证据 |
|---|---|---|
| 内置 Retry 模块 | ✅ 未违规 | `contract/manager.ts:50,71` 为文件锁等待重试（50ms）；`bp-advisor.ts:264` 为建议文案 "fix-and-retry" |
| 内置 Rerank 模块 | ✅ 未违规 | src/ 全库零命中 rerank/recall/remember |
| 内置 Memory 模块 | ✅ 未违规 | memory 仅出现在知识图谱存储配置项 `config-io.ts:24`（sqlite/memory 后端选项），非 Agent 记忆 |
| 默认允许危险删除且无 dry-run | ✅ 未触发 | discard 为 rename 软删除归档；finalize-archive 需显式 `--delete-old` |

**结论**：mumuspec 严格坚守"Agent 无关"单一职责——对比 LangChain 的"重"恰源于其内置 retry/rerank/memory/chain 等模块，本工具零内置，架构纯度达标。

---

## 1. 执行摘要

| 指标 | 结果 |
|---|---|
| **总评分** | **72.4 / 100（取整 72）** |
| **风险等级** | **中** |
| **评审结论** | **有条件录用**（须完成 P0 整改后复检） |

**一句话结论**：架构解耦度与瘦核心设计显著优于主流参照物（运行时仅 3 个直接依赖、零 LLM 耦合），开发者体验与安全基础扎实；但性能维度存在架构级短板（冷启动 2.2s、无真实 diff 算法、全同步 I/O），安全维度存在命令注入与路径穿越面，需在投产前完成整改。

| 维度 | 分数 | 一句话结论 |
|---|---|---|
| 架构抽象 | **88** | 零 LLM 耦合 + 声明式 MCP 工具层，缺运行时 Schema 校验 |
| 性能与资源 | **46** | 冷启动 2.2s + 无 diff 算法 + 全同步 I/O，需重度重构 |
| 安全与沙箱 | **78** | 软删除设计优秀，命令注入面与确认机制缺失 |
| 开发者体验 | **76** | 错误码体系与开箱即用极强，可观测性薄弱 |
| 可维护性 | **74** | 瘦核心 + 扩展侵入性低，覆盖率未过加分线 |

---

## 2. 维度一：架构抽象与解耦度（88/100）

### 评分理由
LLM Provider 零耦合（运行时依赖仅 3 个：`@modelcontextprotocol/sdk`/`commander`/`yaml`，`package.json:79-83`），路径/命令跨平台处理全面，install 层数据驱动接入 6 种 Agent；失分点在于 MCP 工具无 Zod/运行时输入校验、参数以 `as string` 断言直接下渗核心层、git 调用存在 shell 注入面。

### 优点（带证据）
- **依赖纯净**：`npm ls` 确认运行时仅 3 包，src/ 中 openai/anthropic/axios/fetch **零真实调用**（`env-detector.ts:29` 的 apikey 正则仅用于敏感变量过滤，非 API 调用）。
- **MCP 薄适配层**：`mcp-server.ts:64-447` 30+ 工具全声明式 `inputSchema`，`handleToolCall` 单一 switch 分发 + 显式白名单投影（`:461-473`），高内聚低耦合。
- **跨平台完备**：`core/utils.ts:55-58` `isPathSafe` 防目录穿越、`:119` `normalizePath` 统一分隔符；`env-detector.ts:48-120` 全部 `win32 ? 'where' : 'which'` 分支；`installer-ops.ts:47` USERPROFILE/HOME 区分。
- **Agent 解耦**：`installer-registry.ts:5` 以 `AgentType` 联合类型 + 注册表接入 6 种 agent，非硬编码单一厂商。

### 缺点（带证据）
- `mcp-server.ts:457/482/511` 大量 `as string`/`as boolean` 断言：无 Zod/JSON Schema 运行时校验，非法参数直接穿透至 core 层（MCP SDK 仅校验 JSON-RPC 外壳）。
- `knowledge-git.ts:39` `spawnSync(cmd, { shell: true })` 与 `git-scanner.ts:77` 字符串拼接 execSync：Windows 下有命令注入面，未用参数数组式 execFile。
- `mcp-server.ts:973-980` Streamable HTTP 禁用 sessionIdGenerator + CORS 全开：无状态模式无鉴权，HTTP 部署暴露面需显式处理。

### 与主流对比
与 LangChain v0.3+ 的 BaseTool/StructuredTool 体系相比：**优**——纯 JSON Schema + switch 分发更轻量、零历史包袱；但缺其 Pydantic/Zod 运行时校验能力，整体**持平偏优**。

---

## 3. 维度二：性能与资源消耗（46/100）

### 评分理由
实测冷启动 `--help` 中位 **2.2s**、`validate` 2.7s、`check` 2.8s——原因是 `src/cli/index.ts:388-414` 29 个命令模块**全量静态注册**、无法按需加载；全库同步 fs I/O、无任何 diff/token 算法。作为本地 harness 无网络全量传输问题、context 渐进披露是有效优化，故未给更低分，但 46 分已进入"需重度重构"区间。

### 优点（带证据）
- **context 渐进披露**：`src/spec/loader.ts:37-39` 只加载 "target+parent+root" 最多 3 层 spec（`selectLayersToLoad`），`spec.ts:72` 将 design 预览截断至 200 字符——规避全量 spec 进入 Agent 上下文。
- **DoS 防护**：`mcp-server.ts:1000` 10MB body 上限防内存耗尽。
- **实测数据**：`time node dist/cli.js --help` → 2.184/2.628/2.891s；`drift` → 1.155/1.641/1.946s（小仓库可接受）。
- `src/core/env-detector.ts:323-330` 唯一 `Promise.all(detectionTasks)` 并行探测工具。

### 缺点（带证据）
- **无真实 diff 算法**：Grep `lcs|myers|jsdiff|levenshtein` 零命中。drift 仅为结构检查（`checker.ts:616` 查 enforcement 有无）与子串匹配（`contract/validator.ts:388` `content.includes(exp.name)`）。
- `checkIndexDrift`（`checker.ts:653`）注释自认 "Could do more detailed comparison"——index.yaml 与实际目录仅做存在性检查，且递归 `readdirSync` 全树同步扫描。
- **全同步阻塞 I/O**（`readdirSync/readFileSync`），无 `worker_threads`/并发池；`--help` 即 2.2s 但期间无任何工作，纯模块加载浪费。
- **无 token 计数/估算能力**（grep 仅命中 `estimated_effort/estimated_files` 启发式），Agent 无法按 token 预算裁剪上下文。

### 与主流对比
与 Aider 相比：**劣**——Aider 有 Myers 增量 diff 与 token 感知重写，本工具 drift 检测退化为子串匹配；但数据流为纯本地进程、无 LLM 传输，token 成本恒定为零，此点持平。**LSP 基准 N/A**（工具无 LSP 能力，如实标注）。

---

## 4. 维度三：安全与沙箱隔离（78/100）

### 评分理由
架构安全取向良好：discard 软删除归档、finalize-archive 需显式 `--delete-old`、hooks 仅删除自带钩子、凭据零存储，**硬性规则未触发**（无默认 `rm -rf` 类硬删除）。但命令全程 shell 字符串拼接存在注入面、危险操作无交互确认、changeName 无输入校验，`discard_user_confirmation` 仅是约束声明未在运行时落地，故扣分。

### 优点（带证据）
- **软删除设计**：`src/change/lifecycle.ts:206` `renameSync` 将变更归档至 `changes/archive/discarded/`，失败则保留原地，无物理删除。
- **显式删除开关**：`src/cli/commands/finalize-archive.ts:164-198` 默认仅提示，必须传 `--delete-old` 才 `unlinkSync`，且只删旧 spec/design 文件。
- **谨慎清理**：`src/hooks/guard.ts:224` 仅删除含 "MumuSpec git hook" 标记的自有钩子，非本工具钩子一律跳过。
- **凭据零存储**：全库仅 `env-detector.ts:25-33` 有敏感变量扫描正则（检测 .env），无任何 api_key/token 持久化。

### 缺点（带证据）
- **命令注入面**：`knowledge-git.ts:39` 用 `spawnSync(cmd,{shell:true})` 且 `:81,89,98-99,121,130-133` 将 branch/tag/name 直接拼进字符串仅转义引号；`src/core/loop-engine.ts:256` **commit message 含 `$()` 可注入**（issues/next_focus 可能来自 AI 输出）。
- **危险清理无确认**：`src/core/experiment-engine.ts:451,459` 直接 `git worktree remove --force` + `git branch -D`，无 dry-run/确认；`loop-engine.ts:492-500` 同理。
- **路径遍历隐患**：`src/change/paths.ts:53-55` `join(getChangesDir(...), changeName)` 对 changeName 无字符校验，含 `..`/绝对路径可越界；`mcp-server.ts:457` `resolve(root, args.path)` 未校验 targetPath 须在 root 子树内。
- **确认机制缺失**：`discard`/`archive` 直接执行无 prompt，`discard_user_confirmation` 仅出现在 `config-tree.ts:23` 内置例外清单，属 spec 声明未落地；MCP `remove_contract`（`mcp-server.ts:842`）仅靠"有上游消费者则阻塞"业务约束，无用户确认。

### 与主流对比
与 VSCode Extension Host 相比：**劣**——VSCode 有进程隔离 + IPC 协议校验 + 权限受限模型；本工具作为 CLI/MCP 直接以用户身份执行 shell 命令，无进程边界与权限降级，仅靠业务层约束兜底，隔离水平显著偏低。

---

## 5. 维度四：开发者体验与调试友好度（76/100）

### 评分理由
开箱即用与快速开始极强（零配置、全自动脚手架、丰富命令集），错误码体系完善；但调试可观测性弱——无日志分级、无 OpenTelemetry、存在吞错与无堆栈输出。

### 优点（带证据）
- **错误码体系完善**：`src/core/errors.ts:14-391` 定义 E-SPEC/E-CHANGE/E-GUARD 等 40+ 错误码，`formatError`（`:399`）输出中文描述+修复步骤+forceable 标记，`MumuSpecError`（`:428`）结构化携带 code/severity/context。
- **开箱即用**：`init`（`src/cli/index.ts:83`）自动完成项目分析、spec/design/prd/tech/knowledge/rules 生成、文档导入、审计日志与 auto-sync 全链；`doctor`（`src/cli/commands/doctor.ts:17-77`）逐项 ✓/✗ 环境检查。
- **快速开始**：README.md:118-155 从安装到首次可用仅 **4 条命令**（init → add-spec → new → archive）、**0 行配置代码**（config.yaml 自动生成）。
- **--help 质量高**：实测输出 40+ 子命令且每项带描述。

### 缺点（带证据）
- **无日志分级/无统一日志抽象**：45 个 src 文件裸用 `console.log/error`，无 Trace/Debug/Info 分级、无全局 `--verbose`，MCP server 仅 `console.error`（mcp-server.ts:967,1004）。
- **异常被吞/堆栈丢失**：`src/cli/index.ts:183-185,355-371` 多处 `catch {}` 空捕获；MCP 错误只返回 `Error: ${message}` 不含堆栈（mcp-server.ts:947）。
- **无 OpenTelemetry**：package.json 无任何 otel 依赖，src 无埋点；仅本地文件式 `audit.log` 与符号级 `trace` 作观测。
- **MCP 无直接单测**：`mcp-server.ts` 无专属测试，靠 `tests/verify-all.ts:11` spawn 真实 dist 二进制做集成验证；测试用 `vi.mock`+`spyOn(console)`（如 `tests/cli/helpers-deep.test.ts:218`）而非本地 Mock Server。

### 与主流对比
与 Semantic Kernel (C#/Python) 的 `[KernelFunction]` 属性 + 服务注册 + Plugin 导入相比：**优**——mumuspec 用目录 + markdown（.mumuspec/spec.md）+ 单命令脚手架表达约束，概念更直观、上手更快。

---

## 6. 维度五：可维护性与扩展性（74/100）

### 评分理由
测试体量扎实（1412 用例 / 183 文件），但语句覆盖率 62.47% 未过 80% 加分线且 mcp-server.ts 零直接测试；直接依赖仅 3 个属瘦核心，但 MCP SDK 传递树引入 5 个 CVE；tsconfig 严格家族完整、加工具单文件即可完成。

### 优点（带证据）
- **tsconfig 严格**：`tsconfig.json:9,18-21` 完整启用 strict/noUnusedLocals/noUnusedParameters/noImplicitReturns/noFallthroughCasesInSwitch。
- **测试组织良好**：tests/ 183 个 .test.ts 按 core/cli/contract/guard/knowledge/change 分治；`coverage-result.json` 显示 **branch 81.43% (2411/2961)、function 82.40%**。
- **扩展侵入性极低**：`mcp-server.ts:64-447` TOOLS 数组单文件自注册 + `handleToolCall` 集中 switch（:454）——**添加"数据库查询工具"仅需改 1 个文件**（新增 TOOLS 条目 + case 分支 + 按需 import），无独立校验层/类型注册中心。
- **瘦核心**：`package.json:79-83` 生产依赖仅 3 个，声明面极薄。

### 缺点（带证据）
- **语句覆盖 62.47% (12098/19367)**，`coverage-result.json` 中 `success:false`、**3 用例失败**；`src/mcp-server.ts`（35KB 核心文件）不在 coverageMap 内、无任何直接单元测试。
- **npm audit（已联网）**：5 漏洞无 critical，但含 **2 high（fast-uri、ip-address）**，均经 MCP SDK 传递（prod 树共 96 包）；`package-lock.json:493` 锁 SDK 1.29.0 与 `package.json ^1.30.0` 不一致。
- **CHANGELOG.md** 遵循 Keep a Changelog，但仅 0.15.0-alpha.2 有一个 Removed 段，全篇无显式 "Breaking Changes" 标注，迁移指引不足。
- **MCP 单向输出**：`mcp-server.ts:12-14` 仅 import `Server`，无 `Client`/第三方 MCP 挂载能力，对 MCP 生态开放性低。

### 与主流对比
与 LangChain 动辄数百传递依赖相比：**优**——直接依赖仅 3 个、清晰瘦核心；但 MCP SDK 传递树使其非零依赖，且无插件扩展点，扩展性持平于同类 CLI 工具。

---

## 7. 参照物对比矩阵

| 维度 | vs LangChain v0.3+ | vs Semantic Kernel | vs Aider | vs Continue.dev Core | vs VSCode Native API |
|---|---|---|---|---|---|
| 架构抽象 | 优（轻量零包袱，缺运行时校验） | 优（无 Plugin 注册复杂度） | 持平（同为本地工具） | 持平 | — |
| 性能与资源 | 优（零传输 vs 重量级） | 持平 | **劣**（无 Myers diff/token 感知） | 劣（无 LSP 长连接管理，N/A） | — |
| 安全与沙箱 | 优（无内置 Agent 模块） | 持平 | 持平 | 持平 | **劣**（无进程隔离/IPC 校验） |
| 开发者体验 | 优（概念更直观） | **优**（错误码+脚手架完胜 Plugin 定义） | 持平 | 持平 | — |
| 可维护性 | **优**（3 deps vs 数百） | 优 | 持平 | 持平 | — |
| 非 Electron 兼容 | — | — | — | — | **优**（纯 CLI，天然支持 Terminal/无 Electron 依赖） |

**用户指定对比切入点结论**：
- **vs Aider（Diff 编辑算法）**：Aider 采用 Unified Diff / Search-Replace 增量重写 + Myers；mumuspec 无 diff 编辑能力，drift 仅子串/结构检查 → **劣**。
- **vs Continue（LSP 长连接管理）**：mumuspec 无 LSP → 该能力 **N/A**，不存在可比对象，如实标注。
- **vs VSCode API（非 Electron 兼容）**：mumuspec 是纯 CLI（node 二进制直跑），天然支持 Terminal/CI/无 GUI 环境，**优于** VSCode Native API 对 Electron 环境的依赖；但代价是无 VSCode Extension Host 的进程隔离能力。

---

## 8. Top 3 整改建议

1. **【P0-安全】全库消除命令注入面**：`spawnSync`/`execSync` 全部改为参数数组式 `execFile`（禁 `shell:true`）；commit message / branch / tag / changeName / 路径参数增加运行时校验（白名单字符 + `resolve` 后确认在 root 子树内）阻断注入与路径穿越；`git worktree remove --force`、`git branch -D`、discard 等危险操作强制 dry-run + 确认钩子。
2. **【P0-性能】冷启动与 diff 能力重构**：`src/cli/index.ts` 29 个命令模块改为动态 `import()` 按需加载（冷启动目标 <500ms）；同步 `readdirSync/readFileSync` 异步化；drift 检测引入 Myers/简单 LCS diff 替代子串匹配，为后续 Diff 可视化铺路。
3. **【P1-可观测与类型安全】补齐运维闭环**：引入分级日志（Trace/Debug/Info + `--verbose`）与 OpenTelemetry 埋点；消除 `catch {}` 空捕获并保留源码级堆栈；MCP 工具参数补 Zod/JSON Schema 运行时校验；`mcp-server.ts` 补直接单测，语句覆盖率提升至 80%+；CHANGELOG 增加显式 Breaking Changes 段；对齐 MCP SDK 版本（lock 1.29.0 vs ^1.30.0）并升级修复 fast-uri/ip-address 两个 high CVE。

---

## 9. 完整 JSON 输出（机器可读）

```json
{
  "summary": {
    "total_score": 72,
    "risk_level": "中"
  },
  "dimensions": [
    {
      "name": "架构抽象",
      "score": 88,
      "excellent": "零 LLM 耦合（运行时仅 3 个直接依赖），MCP 薄适配层 30+ 工具全声明式 inputSchema + switch 白名单分发，跨平台路径/命令处理完备（isPathSafe/normalizePath/win32 分支），AgentType 注册表数据驱动接入 6 种 Agent，硬编码厂商字段零出现",
      "weakness": "MCP 工具参数以 as string/boolean 断言直接下渗核心层，无 Zod/JSON Schema 运行时校验；knowledge-git.ts:39 与 git-scanner.ts:77 使用 shell 字符串拼接存在命令注入面；Streamable HTTP 无鉴权",
      "comparison_with_mainstream": "与 LangChain v0.3+ BaseTool/StructuredTool 相比：优——纯 JSON Schema+switch 分发更轻量、零历史包袱，但缺其 Pydantic/Zod 运行时校验能力，整体持平偏优"
    },
    {
      "name": "性能与资源",
      "score": 46,
      "excellent": "context 渐进披露只加载最多 3 层 spec（loader.ts:37-39）；MCP 10MB body 上限防内存耗尽（mcp-server.ts:1000）；drift 实测 1.1-1.9s 可接受；纯本地数据流零 token 传输成本",
      "weakness": "冷启动 --help 2.2s / validate 2.7s / check 2.8s（29 命令模块全量静态注册无法按需加载）；无真实 diff 算法（drift 仅结构检查+子串匹配，checker.ts:653 自认 Could do more detailed comparison）；全库同步阻塞 fs I/O 无并发；无 token 计数能力",
      "comparison_with_mainstream": "与 Aider 相比：劣——Aider 有 Myers 增量 diff 与 token 感知重写，本工具 drift 退化为子串匹配；但本地进程零 LLM 传输，此点持平。LSP 基准 N/A（工具无 LSP 能力，如实标注）"
    },
    {
      "name": "安全与沙箱",
      "score": 78,
      "excellent": "discard 采用 renameSync 软删除归档无物理删除（lifecycle.ts:206）；finalize-archive 需显式 --delete-old 才 unlink（:164-198）；hooks 仅删除自带标记钩子（guard.ts:224）；凭据零存储（全库仅 .env 检测正则）",
      "weakness": "commit message 含 $() 可注入（loop-engine.ts:256，内容可能来自 AI 输出）；git worktree remove --force + branch -D 无 dry-run 与确认（experiment-engine.ts:451,459）；changeName 无字符校验可路径穿越（paths.ts:53-55）；discard/archive 无交互确认，discard_user_confirmation 仅为 spec 声明未落地",
      "comparison_with_mainstream": "与 VSCode Extension Host 相比：劣——无进程隔离/权限降级/IPC 协议校验，直接以用户身份执行 shell 命令，仅靠业务层约束兜底"
    },
    {
      "name": "开发者体验",
      "score": 76,
      "excellent": "40+ 结构化错误码带中文描述+修复步骤（errors.ts:14-428）；init 零配置全自动脚手架；快速开始仅 4 条命令 0 行配置（README.md:118-155）；--help 输出 40+ 子命令；doctor 逐项环境检查",
      "weakness": "45 个文件裸 console.log 无日志分级无 --verbose；多处 catch {} 空捕获吞错（cli/index.ts:183-185,355-371）；MCP 错误无堆栈（mcp-server.ts:947）；无 OpenTelemetry 埋点；mcp-server.ts 无直接单测",
      "comparison_with_mainstream": "与 Semantic Kernel [KernelFunction] 属性+服务注册+Plugin 导入相比：优——目录+markdown+单命令脚手架表达约束更直观易懂"
    },
    {
      "name": "可维护性",
      "score": 74,
      "excellent": "1412 用例/183 文件，branch 覆盖率 81.43%、function 82.40%；tsconfig 严格家族完整（strict/noUnusedLocals 等）；MCP 添加新工具仅需改 1 文件（TOOLS 数组+switch case），侵入性极低；直接依赖仅 3 个",
      "weakness": "语句覆盖 62.47% 未过 80% 加分线且 coverage success:false、3 用例失败；mcp-server.ts（35KB 核心）零直接测试；npm audit 5 漏洞含 2 high（fast-uri、ip-address 经 MCP SDK 传递）；CHANGELOG 无显式 Breaking Changes 标注；无第三方 MCP Client 挂载能力",
      "comparison_with_mainstream": "与 LangChain 数百传递依赖相比：优——3 个直接依赖的清晰瘦核心；但 MCP SDK 传递树使其非零依赖，扩展性持平于同类 CLI 工具"
    }
  ],
  "top_3_improvements": [
    "P0-安全：全库消除 shell 字符串拼接（spawnSync/execSync 改参数数组 execFile 风格、禁 shell:true）；commit message/changeName/路径参数增加运行时校验阻断注入与路径穿越；git worktree remove --force、discard 等危险操作强制 dry-run+确认钩子",
    "P0-性能：src/cli/index.ts 29 个命令模块改动态 import 按需加载（冷启动目标 <500ms）；同步 fs I/O 异步化；drift 检测引入 Myers diff 替代子串匹配",
    "P1-可观测与类型：日志分级+OpenTelemetry；消除空 catch 保留源码堆栈；MCP 工具补 Zod/JSON Schema 运行时校验；mcp-server.ts 补直接单测并提升语句覆盖至 80%+；对齐 MCP SDK 版本并升级修复 2 个 high CVE"
  ],
  "verdict": "有条件录用：总分 72 处于主流水平（70-89 锚点），架构解耦度与瘦核心设计超越多数参照物、硬性规则（无内置 retry/rerank/memory、无默认危险删除）全部通过；但性能维度 46 分暴露冷启动与 diff 能力架构级短板、安全维度存在命令注入与路径穿越面，须先完成上述 P0 整改并通过复检后方可投入生产环境。"
}
```

---

## 10. 结论

**最终评审：有条件录用（Conditional Acceptance）**

mumuspec 作为"Agent 无关"的规范驱动工作流编排器，其**架构纯度是最大亮点**——零 LLM 耦合、零内置 Agent 模块、3 个直接依赖的瘦核心，硬性规则全部通过，这恰恰是它在架构维度拿到 88 分的原因，也正是与 LangChain"重"形成对比的核心优势。开发者体验维度（错误码体系、零配置脚手架、4 命令快速开始）同样处于同类工具前列。

但两处硬伤必须正视：
1. **性能维度 46 分**：2.2s 冷启动 + 无 diff 算法 + 全同步 I/O，属于架构级问题而非小补丁，需要一次"命令按需加载 + I/O 异步化 + diff 引擎引入"的重构。
2. **安全维度注入面**：AI 输出直接拼入 shell 命令（`$()` 注入）、changeName 路径穿越，在"上层是 AI 编码助手"的典型使用场景下风险被放大——AI 生成的 commit message 正是注入载体。

以上两项完成整改并复检通过后，该工具具备在 Cline/Continue/Cursor 生态中作为底层 harness 服役的条件。
