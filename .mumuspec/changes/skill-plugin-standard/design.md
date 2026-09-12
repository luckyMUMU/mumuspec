# Design: skill-plugin-standard

> 阶段：Design · workflow：full · 变更：skill-plugin-standard
> 依据：`proposal.md`、`delta-specs/skill-plugin-standard.md`、`code-graph/impact-analysis.json`、
> `review/skill-composition-audit-2026-09-12.md`、宿主官方规范（`plugin-structure/manifest-reference`、`plugin-discovery/marketplace-format`）

## 0. 设计决策裁决（本变更的语义前提）

| # | 决策 | 裁决 | 理由 |
|---|---|---|---|
| D1 | 交付形态 | **新增并行路径**，不替换既有 bundle 语义 | 限制爆炸半径；既有 5 个 bundle 测试仅 1 处需改（`publishBundle` 成功断言） |
| D2 | 分发唯一形式的判定 | **宿主可识别**即为唯一形式；自研描述符降为内部工件 | 规范原文：缺 `.codebuddy-plugin/plugin.json` 宿主不识别 |
| D3 | 编排器单源化 | 包内含全部 `skills/<name>/SKILL.md`，入口唯一；中文丰富版降为被引用资源 | 插件包成为安装单元后，四处定义收敛为一处 |
| D4 | 漂移检测接入点 | `src/cli/commands/spec.ts:325-330` 的 `driftSources` 数组 | 唯一接入点；逐源隔离已在 `:331-343` 就绪 |
| D5 | `cognitive-map` 死模块 | **注册该命令**（用户裁决） | 模块已完整实现且有测试，缺的只是接线；"实现它"优于"改文本迁就" |
| D6 | 签名漂移 | **修正全部四类**（用户裁决） | 四类同源，全部落在 Requirement 5 射程内 |

## 1. 架构总览（Architecture Overview）

### 1.1 现状（问题域）

```
skills/mumuspec/**            ← 源（9 件，高频编辑）
        │ mumuspec install --force（单向快照，re-install 需人工记得）
        ▼
~/.workbuddy/skills/**        ← 模型唯一可加载集合（7 件，无漂移检测）

skills/mumuspec/workflow.yaml ← 阶段分发规则定义处之一（另有三处）
src/bundle/packager.ts        ← 自研格式：面向不存在的 .mumuspec/skills/，版本硬编码 '0.12.2'，
                                publishBundle 占位实现却 return success（fail-open）
src/cli/commands/cognitive-map.ts ← 完整实现但未注册（死模块）
```

### 1.2 目标形态

```
                       ┌──────────────────────────────────────┐
                       │  产出侧：plugin-package              │
   skills/**  ────────▶│  .codebuddy-plugin/plugin.json        │
   （唯一权威源）       │  .codebuddy-plugin/marketplace.json   │
                       │  skills/<name>/SKILL.md  × N         │
                       └───────────────┬──────────────────────┘
                                       │ 清单先过校验器（先校验器后消费者）
                                       ▼
                       ┌──────────────────────────────────────┐
                       │  安装侧：plugin-install              │
                       │  plugins/cache/<mkt>/<plugin>/<ver>/  │
                       │  installed_plugins.json（键 n@mkt）   │
                       └───────────────┬──────────────────────┘
                                       │
   skills/** ◀──── 漂移检测（剥离版本行后比正文）────┘
        │                    │
        │                    └──▶ mumuspec check 的 driftSources → W-SKILL-001
        ▼                                      （可强制告警；CI 消费同一函数）
   mumuspec check / ci-check
```

三条设计主线：

1. **清单是契约，先校验器后产出物**：`plugin-manifest` 是纯函数模块（无 I/O），把官方文档的 13 条可判定规则实现为校验器；`plugin-package` 只在通过校验后才写盘。
2. **安装留痕**：安装动作同时写缓存目录与登记文件，登记失败即整体 fail-closed，不留"装了但没登记"的中间态。
3. **漂移可检测**：比较源正文与安装副本正文，**先剥离 frontmatter 版本行**——`stampSkillVersion()` 使两侧版本必然不同，纳入比对等于把噪声当信号。

## 2. 接口与契约（API Contracts）

### 2.1 新增模块导出

```ts
// src/bundle/plugin-manifest.ts —— 纯模块：类型 + 校验器，无 I/O
export interface PluginManifest {
  name: string; version: string; description: string;
  author?: { name: string; email?: string; url?: string } | string;
  homepage?: string; repository?: string | { type: string; url: string; directory?: string };
  license?: string; keywords?: string[];
  commands?: string | string[]; agents?: string | string[];
  hooks?: string | Record<string, unknown>; mcpServers?: string | Record<string, unknown>;
}
export interface MarketplaceManifest {
  name: string; owner: { name: string; email?: string };
  metadata?: { description?: string; version?: string; pluginRoot?: string };
  plugins: MarketplacePluginEntry[];
}
export interface ManifestViolation { path: string; rule: string; message: string }

export const PLUGIN_NAME_RE: RegExp;                  // ^[a-z][a-z0-9]*(-[a-z0-9]+)*$
export const MARKETPLACE_CATEGORIES: readonly string[]; // 九项枚举
export function validatePluginManifest(m: unknown, opts: { pluginRoot: string }): ManifestViolation[];
export function validateMarketplaceManifest(m: unknown, opts: { marketplaceRoot: string }): ManifestViolation[];
export function isRelativeComponentPath(p: string): boolean; // ./ 开头、无 ..、正斜杠
```

```ts
// src/bundle/plugin-package.ts —— 产出侧（依赖 plugin-manifest）
export function buildPluginPackage(root: string, opts: {
  outDir: string; marketplaceName: string; pluginName?: string; author?: string;
}): { ok: boolean; outDir?: string; violations?: ManifestViolation[]; error?: string };
```

```ts
// src/install/plugin-install.ts —— 安装侧（依赖 plugin-manifest）
export function installPluginPackage(pkgDir: string, opts: {
  cacheRoot: string; registryPath: string; marketplaceName: string; scope?: 'user' | 'project';
}): { ok: boolean; installPath?: string; registryUpdated?: boolean; error?: string };
```

```ts
// src/guard/skill-drift.ts —— 漂移检测（纯：接收已解析的路径对，不 import install 层）
export interface SkillPair { name: string; sourcePath: string; installPath: string }
export function stripFrontmatterVersion(text: string): string;
export function detectSkillDrift(pairs: readonly SkillPair[]): DriftResult[];
```

```ts
// src/install/skill-companions.ts
export interface CompanionSpec { name: string; purpose: string; required: boolean; searchRoots: string[] }
export const COMPANIONS: readonly CompanionSpec[];
export function resolveCompanions(specs?: readonly CompanionSpec[]): Array<CompanionSpec & { resolved: string | null }>;
```

### 2.2 CLI 契约（与命令注册表一致，由 ENF-16 守卫）

```
mumuspec bundle plugin [--out <dir>] [--marketplace <name>]   # 产出标准插件包
mumuspec install --plugin [--from <pkgDir>] [--scope user]    # 安装到插件缓存 + 登记
mumuspec skill companions [--json]                            # 伴随能力枚举（缺失不阻断）
mumuspec cognitive-map init|sync <name>                       # 注册既有死模块（D5）
mumuspec check                                                # 新增 drift 源：skill-drift
```

签名修正（D6，四类漂移）：

| 技能文本现写法 | 真实签名 | 处置 |
|---|---|---|
| `state check <name> <phase> --recover` | `state check <name> [--recover]` | 改技能文本 |
| `cognitive-map init/sync <name>` | 命令未注册 | **注册命令**（D5） |
| `contract list --scopes <值>` | `--scopes` 为无值开关 | 改技能文本 |
| `knowledge context --scopes <值>` | 缺 `path` 位置参数 | 改技能文本 |

## 3. 数据流（Data Flow）

**产出流**：`skills/<name>/SKILL.md` → 收集技能清单 → 组装 `PluginManifest`（version 取 `getPackageVersion()`）→ `validatePluginManifest` → 违规则 `E-SKILL-002` 并**不写盘** → 通过则写 `.codebuddy-plugin/plugin.json` → 组装 `MarketplaceManifest`（entry.source 为 `./skills/...` 相对路径）→ 校验 → 写 `marketplace.json`。

**安装流**：读 `<pkgDir>/.codebuddy-plugin/plugin.json` → 校验 → 目标 `cacheRoot/<mkt>/<plugin>/<version>/` → 复制包内容 → 读 `registryPath`（缺失则初始化为 `{version:2, plugins:{}}`）→ 解析失败即 `E-SKILL-003` fail-closed → 写入键 `<plugin>@<mkt>` 数组项（已存在同版本则更新 `lastUpdated`、**保留 `installedAt`**）→ 原子写回。

**漂移流**：调用方解析 `{name, sourcePath, installPath}` 对 → 逐对比 `stripFrontmatterVersion(正文)` 的 sha256 → 不一致产出一条 `DriftResult{ code: 'W-SKILL-001' }` → 汇入 `spec.ts` 的 `drifts` → `--json` 与文本通道同构输出。

## 4. 错误规格（Error Specification）

| 码 | 级别 | 触发 | 语义 | forceable |
|---|---|---|---|---|
| `W-SKILL-001` | WARN | 源与安装副本正文不一致 | 技能副本漂移，逐技能给源/安装路径 | 是 |
| `E-SKILL-002` | ERROR | 插件/市场清单未过校验器 | 违例列表逐条给出 path+rule+message；不写盘 | 否 |
| `E-SKILL-003` | ERROR | 登记文件不可写或 JSON 不可解析 | 安装整体失败，不留"装了没登记"中间态 | 否 |
| `E-BUNDLE-001` | ERROR | `publishBundle` 被调用 | 能力未实现，fail-closed 并给出理由 | 否 |

**纪律**：四个码（含两个新 `E-`）均须注册进 `src/core/errors.ts` 的 `ERROR_CODES`，否则 `checkMetadataFor()` 静默回退且生成文档不收录——由既有 `tests/guard/error-code-registry.test.ts` 自动拦截。`W-SKILL-001` 的 `fixHint` 必须给出可执行修复命令（重装/或提示 `install --force`）。

## 5. 实现分层（Implementation Layers）

层级按**依赖深度**（深 → 浅），同层 scope 间无直接调用边 ⇒ 候选并行组：

| Layer | scope | 内容 | 依赖 |
|---|---|---|---|
| 4 | `src/core` | `errors.ts` 注册 4 个新码 | 无（最底层） |
| 3 | `src/bundle` | `plugin-manifest.ts`（纯校验器） | layer 4 |
| 2 | `src/install` | `plugin-install.ts`、`skill-companions.ts` | layer 3、4 |
| 2 | `src/guard` | `skill-drift.ts`（接收路径对，**不 import install**） | layer 4 |
| 1 | `src/cli` | `bundle.ts`(+plugin 子命令)、`install.ts`(--plugin)、`spec.ts`(drift 源)、`index.ts`(注册 cognitive-map) | layer 0–2 |
| 0 | `.` | `skills/**` 文本修正、`scripts/ci-check.mjs` 接入 | layer 1 |

**层内并行说明**：layer 2 的两个 scope（`src/install`、`src/guard`）**互不引用**——`skill-drift` 刻意设计为接收已解析路径对，避免向 `src/install` 借符号（I2）。故 layer 2 是**候选并行组**，须由 `mumuspec state plan-parallel --apply` 依据 code-graph 实际调用边验证后才登记为 `parallel_group`（层号只是候选，不是已验证事实）。

**视野纪律**：设计侧视野向上（layer 0..4 全覆盖，无断链）；实现侧视野向下（实现 layer N 只依赖 ≤N 的契约）。

## 6. 约束分析（Constraints Analysis）

- **TD-F-001（确定性步骤归 CLI）**：插件清单生成、安装、漂移比对全部落在代码侧；LLM 只负责技能文本的语义改写与决策组织。**不得**让模型现场拼 `plugin.json`。
- **TD-R-001（禁手工编辑 CLI 管理工件）**：本变更自身的 `decisions.md` 只能经 `decisions append` 写入——本轮已因外部写入丢失过一次，恢复也必须走 CLI（`E-CHANGE-007` 守护 `content_hash`）。
- **先校验器后消费者**：`plugin-manifest` 校验器必须先于 `plugin-package` 写盘路径存在；`W-SKILL-001` 消费者（`spec.ts` drift 源）与新码注册必须同批交付。
- **禁止死端（产出物必须有消费者）**：新模块不得只导出不接线——`cognitive-map` 的现存教训（有实现、有测试、无注册）正是本约束的反例。
- **通道卫生（红线）**：本变更 delta-spec 的 SHALL NOT **一律不使用行内代码标记承载对象标识符**，改由块级 `### Enforcement` 走 R3 manual；否则 R2 词法通道会把字面量出现误判为行为发生（曾致 60 条 `E-GUARD-003` 假阳性）。
- **Ponytail 阶梯**：清单校验器不引第三方 schema 库（标准库 JSON + 正则足够）；不新增运行时依赖。
- **性能**：漂移检测为 O(技能数) 文件读 + 哈希，技能数 ~10，无热路径问题；不引入缓存（YAGNI）。

## 7. 风险与缓解（Risk Mitigation）

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | 写宿主 `installed_plugins.json` 未被宿主接受（无官方文档，仅磁盘实证） | 登记项被忽略 | 默认写入；新增 `--dry-run` 输出待登记内容；失败 fail-closed 而非静默。**验收 S2 实跑核对** |
| R2 | 并发写入者（外部进程）用 `git add -A` + merge 回退未提交工件 | 在途编辑被静默丢弃（**本轮已实际发生两次**） | 每阶段完成即 `git commit`；恢复一律走 CLI 重放；每步前后校验 `decisions_log.content_hash` |
| R3 | 剥离版本行后仍存在其他戳印类差异 | 漂移误报（恒亮红灯 = 训练读者忽略告警） | ENF-9 正负样例双向断言：改正文必报、仅改版本行必不报 |
| R4 | `skill-drift` 若反向 import `src/install` 会破坏 I2/I3 | layer 2 不可并行，`W-BUILD-001` | 设计已定：`skill-drift` 只接收路径对，由 `src/cli` 注入 |
| R5 | 注册 `cognitive-map` 后其 `sync` 写入 `cognitive_framework` 计数，可能覆盖既有手工值 | 认知框架状态突变 | 先跑 `--dry-run`/只读模式核对；`state set` 受保护字段审计（`E-STATE-001`）已存在 |
| R6 | 技能文本改动面大（9 件）导致内容丢失（tweak 陷阱段的历史教训） | 既有正确内容静默消失 | ENF-18：源与副本差集逐条裁决；改动前先取 A/B 面差集清单 |

## 8. 测试策略（Test Strategy）

**新增测试**

| 文件 | 覆盖 | 对应 ENF |
|---|---|---|
| `tests/bundle/plugin-manifest.test.ts` | name 正则正负、semver、description 长度、author 形态、路径正负（绝对/`../`/反斜杠/缺 `./`）、source 存在性、category 枚举 | ENF-1、2、3 |
| `tests/bundle/plugin-package.test.ts` | 产出物字段逐条比对；包版本 = 运行时版本，无硬编码回退 | ENF-1、4 |
| `tests/install/plugin-install.test.ts` | 两次安装登记条目数为 1；`installedAt` 不变而 `lastUpdated` 更新；非法 JSON → fail-closed | ENF-6、7 |
| `tests/guard/skill-drift.test.ts` | 改正文必报；仅改版本行必不报；诊断含源/安装双路径 | ENF-9 |
| `tests/guard/skill-registry.test.ts` | 守卫目标阶段合法性；幽灵字段名零命中；**技能文本引用的命令+签名逐条命中注册表（含四类漂移反向样例）**；命令模块 ↔ 注册表双向闭包 | ENF-14、15、16、17 |
| `tests/bundle/publish-fail-closed.test.ts` | `publishBundle` 不再返回假成功 | ENF-（Delta R2 的 fail-open 项） |

**改写测试**

- `tests/bundle/packager.test.ts:517-528`：`publishBundle` 成功断言 → 改为断言 fail-closed 与理由存在。
- `tests/cli/commands/bundle-handler.test.ts`：补 `plugin` 子命令的 mock 与断言。
- `tests/cli/commands/cognitive-map-handler.test.ts`：补"已注册进 program"的接线断言（该文件已存在，但此前只测 handler 不测接线——**这正是死模块逃过测试的原因**）。

**回归基线**：`npx vitest run` 全绿；`mumuspec check` exit 0；`mumuspec validate` unverifiable = 0；`npm run ci:check` 0 error 0 warning。

**不可变性**：`test-cases/` 在 Design 末锁定（BP-8）；Build 期间修改测试用例视为流程违规（`W-GUARD-004`）。
