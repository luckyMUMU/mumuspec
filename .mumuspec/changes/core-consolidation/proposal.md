# Proposal: core-consolidation

## Why

产品定位链路"随意的自然语言 → 大模型起草 Spec ⇄ 追问补全 → 完备性判定（人签收）"缺少机械落点，架构决策与复用也无落点：

- 覆盖面判定只数记录条数不认维度身份，安全与合规可被静默跳过（`src/cli/commands/cognitive-map.ts:177`、`src/core/errors.ts:1017`）；design.md 章节 schema 八节中无安全节
- init 全自动且 design.md 只渲染三节，无议题、备选与理由；E-SPEC-006 的 prescribed 出路指向无法产出 design.md 的命令（`src/core/errors.ts:91` vs `src/cli/commands/spec.ts:185`）
- 契约有注册与影响分析却无导入路径，约束复用只能重打且缺来源声明；注册表文件名配置与代码不一致且本仓库无注册表文件
- 存在声明无实现与实现无消费两侧失真：持久化后端选项、发布命令、占位协作命令面、无引擎的多角色评审残留；断言核对只拦单向偏差
- Worktree 隔离在设计与配置两侧有承诺、清理端已接线，创建端不存在——悬空的行为门指针
- 执行逻辑已图化（阶段节点、转移边、阻塞点挂边），但只有校验没有渲染；文档内二十余处手写图示与图数据之间无任何到期校验

实测基线（本次重建 `dist/` 后）：384 条约束，enforced-strong 4、enforced-weak 21、manual 359、unverifiable 0，declared_ratio 100%、strong_ratio 1.0%；58 个顶层命令、35 个 MCP 工具与 35 个 handler。

## What

以"声明⊆实现、实现⊆消费、门⊆事实"三条闭合等式为完成口径，分六个批次推进：

1. 覆盖面维度事实源与维度身份门：枚举常量、design-schema 安全节、Q4 判定改身份、变更创建原文槽位、skill 侧引用同源
2. 初始架构偏好选型：声明式偏好包、骨架渲染器与四字段选型表、design 骨架初始化命令、E-SPEC-006 出路复位、上手引导消除静默默认
3. 减法收敛：删除假承诺与死端能力面，多语言解析登记为非目标并把 AST 旁路收进 provider 注册表
4. Worktree 门与创建路径成对补全；契约按范围导入与带来源声明的约束复用
5. 图数据确定性渲染四视图（阶段×阻塞点泳道、含回退计数的状态机、约束继承树、契约上下游）与文档图示结构对账
6. 声明一致率指标（独立上报，不并入收敛评估权重）、断言核对双向、进度文档按实测复位

## Impact Scope

- `.mumuspec/spec.md` / `prohibitions.md`（delta：覆盖面维度、选型表、渲染、复用、一致率的 SHALL 与判定点）
- `src/spec/`（覆盖面枚举与分类、出处复用）、`src/core/`（偏好包与骨架渲染、配置声明、错误码、指标）、`src/guard/`（阶段门与断言核对）
- `src/change/`（原文槽位、工作树创建、命令接线）、`src/contract/`（导入与注册表文件名统一）、`src/graph/`（新建渲染层）
- `src/cli/`（新命令与子命令、命令族收口）、`src/mcp/`（只读渲染工具）
- `src/team/`、`src/bundle/`、`src/install/`（删除面与伴生清单收缩）
- `templates/design-schema.yaml`、`skills/mumuspec/*`、`docs/design/*`、`docs/STATUS.md`、`docs/overview.md`、`.mumuspec/goal.md`、`.mumuspec/prd.md`（非目标登记）、`.eval-corpus/`

## User Decisions

<!-- 影响可见结果的决策项写在这里：以 - [blocking] 前缀标记阻塞项。
    声明阻塞项后须经 decisions append 逐项签收才能进入 build（freeze gate）；
    无声明则不产生任何门禁 -->

- [blocking] 实现度口径采用三条闭合等式（声明⊆实现、实现⊆消费、门⊆事实），"100%"不等于把曾设想的功能全部写完
- [blocking] 减法裁决：无引擎的多角色评审残留、占位协作命令面、未实现的发布命令、内存实现却声明持久化后端四项按"删声明"处置，不补实现
- [blocking] 多语言 AST 解析登记为产品非目标，不引入外部解析引擎依赖
- [blocking] Worktree 隔离按"补最小创建路径 + 门禁成对"处置，而非删除既有承诺
- [blocking] 声明一致率作为独立上报指标接入，不并入收敛评估的权重、阈值与稳定窗口

## Workflow

full

## Workflow Path Recommendation

**Recommended Path:** full
**Confidence:** 95%

**Rationale:**
Safety fence triggered: cross_module, new_public_api. Full workflow required.

**Safety Fence Active:** Compression blocked by:
- cross_module
- new_public_api
