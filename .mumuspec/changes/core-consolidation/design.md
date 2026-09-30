# Design: core-consolidation

依据：`review/2026-09-30-core-consolidation-plan.md`；目标登记 R-0014–R-0019。

## Architecture Overview 架构总览

变更以"声明⊆实现、实现⊆消费、门⊆事实"三条闭合等式为完成口径，沿四条主线落地：

1. 覆盖面事实源下沉到代码常量，判定改维度身份（规范层）
2. 架构决策落点为选型表与 schema 校验（变更层）
3. 假承诺与死端删除，图数据旁路收进既有注册表（减法）
4. 图数据确定性渲染四视图，文档图示纳入对账通道（呈现层）

不新增引擎、不新增运行时依赖、不新增第二套分类判定；既有 check/validate JSON schema 不变，新指标另立命令面。

## Implementation Layers 实现分层

| 层 | 范围 | 内容 |
|----|------|------|
| L1 | `src/spec/aspects.ts`、`templates/design-schema.yaml`、`src/cli/commands/cognitive-map.ts`、`src/guard/phase-guard.ts`、`src/core/errors.ts` | 覆盖维度枚举单一事实源 + classifyAspects + 安全节 + Q4 身份门 |
| L2 | `src/core/init-templates.ts`、`src/core/design-preferences.ts`、`src/cli/commands/spec.ts`、`src/cli/commands/knowledge-onboard.ts` | 偏好包常量 + 骨架渲染 + design 骨架命令 + E-SPEC-006 出路复位 |
| L3 | `src/team/`、`src/bundle/`、`src/install/skill-companions.ts`、`src/core/config-io.ts`、`src/guard/language-provider-registry.ts`、`.mumuspec/prd.md` | 删除假承诺与死端；AST 旁路收进注册表；多语言登记非目标 |
| L4 | `src/core/git.ts`、`src/change/lifecycle.ts`、`src/guard/checker.ts`、`src/contract/`、`src/spec/constraint-provenance.ts` | Worktree 创建路径与门；契约按范围导入；约束复用带来源 |
| L5 | `src/graph/render.ts`、`src/cli/commands/graph.ts`、`src/mcp/tools.ts`、`scripts/docs-audit.mjs` | 四视图渲染、格式封闭枚举、文档图示结构对账、只读工具 |
| L6 | `src/core/metrics/declaration-conformance.ts`、`src/guard/status-assertion-checker.ts`、`docs/`、`.mumuspec/` | 三比值指标（新命令面）、断言双向、进度文档按实测复位 |

依赖序：L1 → L2/L3/L4 → L5 → L6。L5 的覆盖面矩阵消费 L1 的枚举源。

## API Contracts 接口契约

| 面 | 形态 | 说明 |
|----|------|------|
| `src/spec/aspects.ts` | `ASPECTS: readonly AspectId[]`、`classifyAspects(entries): AspectCoverage`、`missingAspects(cov, required): AspectId[]` | 纯函数，无 I/O |
| 覆盖维度类型 | `type AspectId = 'function' \| 'boundary' \| 'data' \| 'concurrency' \| 'compat' \| 'performance' \| 'security-compliance' \| 'observability'` | 与 `ConstraintDimension` 正交，不复用其枚举 |
| L2 渲染 | `renderDesignSkeleton(analysis: ProjectAnalysis, picks: PreferencePicks): string` | 未选定项产显式未决标记 |
| 偏好包 | `ARCH_PREFERENCE_PACKS: readonly PreferencePack[]`，每项含 `topic`/`options[]`/`defaultBasis`，选项集必含未约束态 | 代码常量持有 |
| L4 工作树 | `createWorktree(root: string, branch: string, path: string): WorktreeResult` | 复用既有路径与存在性判定语义 |
| L5 渲染 | `renderPhaseGraph` / `renderConstraintTree` / `renderContractGraph` / `renderAspectMatrix`，格式 `RenderFormat = 'mermaid' \| 'dot' \| 'json'` | 未知格式即参数错误 |
| L6 指标 | `computeDeclarationConformance(root): ConformanceReport`，经 `mumuspec metrics declaration-conformance` 暴露 | 不进 check/validate 既有结构 |

同层模块只消费经边界声明的导出，不引用兄弟模块内部符号。

## Data Flow 数据流

```
起草原文 request.md ─┐
                    ├─→ skill 扩写 ─→ design.md（选型表 + 覆盖面章节）
既有规范链 ──────────┘         │
                              ├─→ design-schema 校验（W-DESIGN-009）
cognitive-map.yaml entries ──→ classifyAspects ─→ 维度缺失 ─→ W-DESIGN-005（缺维度名）
                              │
PhaseGraph + BP + state ─────→ render*  ─→ mermaid/dot/json 文本 ─→ 文档图示对账（WARN）
config 声明 / 命令注册表 / 错误码表 / STATUS 断言 ─→ declaration-conformance 三比值
```

同步边界：全部为命令触发的静态核验，不引入子进程执行、不引入文件监听。渲染与指标面纯只读。

## Error Specification 错误处理规范

| 码 | 场景 | 严重度 | 可 force |
|----|------|--------|---------|
| W-DESIGN-005（改写） | Q4 缺必需覆盖维度，描述与 fixSteps 列出缺失维度名 | WARN | false |
| W-DESIGN-009（复用，建议级） | full 工作流 design.md 缺安全与隐私节 | 既有语义不变 | 沿用既有 |
| E-GUARD-014 | 工作树隔离为强制档而变更无工作树 | ERROR | false |
| E-SPEC-018 | 复用条目缺上游来源声明 | ERROR | false |
| E-GRAPH-002 | 渲染请求未知格式 | ERROR | true |
| E-GRAPH-003 | 源数据自相矛盾（边指向未知节点） | ERROR | false |

删除面同时移除其错误码与注册表条目（hyperplan、bundle publish），不留无效码位。新增码入 `ERROR_CODES` 并同步生成的 error-codes 文档。

## Constraints Analysis 约束分析

新增约束见 `constraints/new-shall.md` 与 `constraints/new-shall-not.md`，要点：

- 覆盖维度枚举为单一事实源，schema、门禁、skill 三处引用同源，缺一即该维度视为不存在
- 判定归代码、起草归 LLM：覆盖面完整度不得由模型自评
- 渲染标签与指标值一律取自图数据与配置事实，禁止现场手写
- 只可收紧：复用与导入不得放宽本层约束
- 不得为覆盖率数字削弱既有门禁；密度是调节信号，不是质量分

与上层关系：本变更不放宽任何根层既有红线；Q4 身份门以 WARN 起步，不改 enforcement_strict 默认。

## Risk Mitigation 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 删除面误伤隐性消费者 | 中 | 高 | 删除前三重核对（边界校验、同步检查、全仓检索），删除与引用改写同批交付 |
| strong_ratio 因分母收缩虚高被读作质量提升 | 高 | 中 | 报告区分删声明与补实现；一致率上升须逐条可归因 |
| 存量 cognitive-map 集中阻断 | 中 | 中 | 维度缺失先 WARN 观察一轮；不改 strict 默认 |
| 手写文档图示与渲染结构不一致造成告警噪音 | 高 | 低 | WARN 起步不阻断，按视图分批纳入 |
| 渲染不确定性导致测试抖动 | 中 | 中 | 稳定序输出 + 字节比对测试先立 |

## Security & Privacy 安全与隐私

| 暴露面 | 本变更的处置 | 判定源 |
|--------|-------------|--------|
| MCP 工具的 path/dir 参数 | schema 声明 required 的参数缺失或非字符串 ⇒ 返回 E-SECURITY-003 与修复步骤，不进入 handler；此前落入 `resolve(root, undefined)` 抛 Node TypeError | `src/mcp/tools.ts` 的 PATH_TOOLS × 工具 schema（requiredness 由声明推导，不另立清单） |
| 规范工件中的凭据 | 新增敏感信息扫描：固定模式集（凭据赋值 / Bearer Token / 私网 IP / 内网域名 / 数据源连接串），每文件一条 W-SECURITY-001 建议级告警，摘录按前缀 + 固定掩码呈现，不回显原值 | `src/guard/sensitive-info.ts`；挂在 `mumuspec check` 全量模式 |
| 扫描面的可关闭性 | 不提供开关：`.mumuspec/prohibitions.md` 与 `docs/reference/configuration.md` 把 `sensitive_info_scan` 列为不可关闭例外，可关闭的开关与该声明相互矛盾 | 模块内无配置读取路径 |
| 降级留痕 | 缺 `security-compliance` 维度且 `security-and-hardening` 伴生能力不可达时，告警文案点名兜底并写 `aspect.security.degraded` 审计记录；兜底呈现为"盲区判断仍缺"，不冒充已扫 | `WIRED_COMPANIONS` + `phase-guard` |
| 不覆盖范围 | 源代码与提交历史的秘密扫描、依赖 CVE 查询、外部密钥库校验均不在本变更范围（本扫描只做规范工件的确定性词法核对）；例外清单的求值面脱钩另立 R-0021 | 见"明确不做" |

隐私侧只有一条约束：告警只呈现掩码片段与位置，任何通道（stdout、`--json`、`audit.log`）都不写出被匹配的值本身。

## Test Strategy 测试策略

红绿顺序，锁后不可变。分层按 L1–L6 建套件：

| 层 | 套件 | 关键用例 |
|----|------|---------|
| L1 | `tests/spec/aspects.test.ts` | 三条同维度记录不构成覆盖；缺安全维度即未收敛；full 缺安全节报出 W-DESIGN-009、hotfix/tweak 不触发 |
| L2 | `tests/core/design-skeleton.test.ts` | 未选定项显式未决且计为缺失；有选定无备选视同缺失；E-SPEC-006 出路命令存在 |
| L3 | 回归面 | 删除项无幽灵引用（类型、子命令、测试、文档四处一致）；provider 旁路收口后既有 AST 判定不变 |
| L4 | `tests/guard/worktree-gate.test.ts`、`tests/contract/reuse.test.ts` | 强制档缺工作树阻断、降档留痕；无来源声明的复用被拒；来源不存在时失败不返回空集 |
| L5 | `tests/graph/render.test.ts` | 同输入字节一致；未挂阻塞点与无边可达节点可见；回退边与正向边可区分 |
| L6 | `tests/core/metrics/declaration-conformance.test.ts` + `.eval-corpus/` | 三比值各有违反 fixture 被计数；断言核对双向拦截 |

全量门禁比对：`npm run test`、`npx tsc --noEmit`、`npm run enforce`、`npm run ci:check`、`npm run docs:audit`、`node dist/cli.js check`。基线（本变更开始时实测）：384 条约束、strong 4、weak 21、manual 359、unverifiable 0、strong_ratio 1.0%、58 顶层命令、35 MCP 工具、302 测试文件、约 5335 用例、0 skip/todo。

## 完成判据

三条闭合等式比值均为 1.0；计划 §三 的 14 条裁决全部落地且无幽灵引用；Q4 门认维度不认行数；E-SPEC-006 出路为真实命令；工作树门与创建路径成对存在；四视图渲染确定性可复现；文档与代码差异表清零；全量门禁相对基线无退化。

## 明确不做

- 多语言 AST 解析与外部解析引擎依赖（登记为产品非目标）
- 代码图谱持久化后端与跨进程复用
- 可视化编辑器、图形渲染二进制依赖
- 并行多变更（与单一活跃变更纪律互斥）
- 把知识页当模板库消费、把技能打包当规范分发通道
- 收敛评估的权重、阈值与稳定窗口调整
