# 优化方案：Skill 组合 × CLI × DAG 编排（2026-09-13）

> **执行记录（2026-09-13 20:50，提交 f8ce204）**：批次 1 与批次 2 已全部执行完毕并提交。
> 批次 2/P1（BP-9/10 合并）一并完成。docs:audit 定为**报告型**（四类误报使自动门禁不可判定，
> 硬门禁仍由 skill-registry 测试与 TC-L3-1 承担）。复验全绿：check/validate/ci:check 0 错 0 警、
> W-SKILL-001=0、B 面 7 包重装、全量 vitest 5120 passed（36 项失败为 git 不在子进程 PATH 的
> 环境性失败，PATH 修正后 73/73 全过）。批次 3（CHG-8 立项）仍待 D3 放行。
>
> **执行记录二（2026-09-13 21:50）**：批次 3/4 已全部执行完毕。
> - **批次 3 = CHG-8 bp-into-graph**（full workflow 完整走完：open→design→build→verify→archive，提交 ac71620 / a9fdf0b，版本 0.34.0-alpha.1）：`workflows.<wf>.phase_bps` 可选段落地（BP id workflow 内唯一、缺省向后兼容）；新模块 `src/change/phase-bps.ts`；`graph verify` 输出 BP 清单 + W-GRAPH-001（WARN fail-open）skill 侧一致性检查；full 17 BP + presets BP-18 = 18 BP 全量入图；错误码 113/21 域。TDD 过程中 fail-safe 实际拦截了首版"全局唯一"设计错误与 skill workflow.yaml 预存 YAML 缩进损坏。
> - **批次 4**（提交 a36ab31）：S2b——skill 侧 workflow.yaml 删除 graph 段（327 行，引擎单一事实源），保留 phases/presets 的 BP 声明供 W-GRAPH-001 校验；P2——6 份 SKILL.md 重复模板段收紧（-339 字节），不抽共享文件以保 B 面自足。
> - **遗留**：state set 写入 affected_scopes 恒为字符串（guard 逐字符迭代 → 含 '/' 即 E-SECURITY-001、'.' 圈全量 manual 面）——引擎缺口，建议立 change 修复；dashboard/state check 消费 phase_bps 按裁决延后。

> 输入：`review/skill-cli-dag-evaluation-2026-09-13.md`（六维评估）+ `review/skill-composition-audit-2026-09-12.md`（昨日审计，P0-3 仍开放）
> 性质：执行方案与立项输入。**本方案不代替 MumuSpec 流程**——批次 3 涉及引擎 schema 扩展，确认后须走完整 change（open→design→build→verify→archive）。
> 原则：单一权威源 / fail-open / 每项独立可验收可回退 / 改 A 面必重装并经 W-SKILL-001 复验。

---

## 重析（2026-09-13 20:15）：基线漂移与方案有效性复核

**基线漂移**：评估基线 `e844be7` → 当前 `947d412`，下午新增 7 个已归档变更
（shall-structure-lint / spec-fence-guard / fail-open-audit / delta-channel-gate /
ready-action-guidance / drift-delta-preview / workflow-tier-hint），约 **+997 行**
（guard/spec/cli/tests），版本 `0.19.2-alpha.10 → 0.33.0-alpha.0`。

**逐项复核结论：方案主体全部成立，无一项作废；三处微调 + 一处新增协同点。**

| 触点 | 核验结果 | 影响 |
|---|---|---|
| S1（N1 修复） | `phase-archive/SKILL.md:170/:177` 两幽灵守卫项仍在（skills/ 自 e844be7 零改动） | 有效；**扩展**：修改时一并核对"已知缺口"清单 vs E-CHANGE-022 后的 archive.ts（+204 行，fail-closed 合并）行为一致性 |
| S2（编排器单源化） | 四写未动 | 有效；**新增协同**：`ready-action-guidance` 已让 `status` 输出就绪动作引导 → 决策核的"8 条阶段判定"应改为**以 `mumuspec status` ready-actions 输出为准**，skill 侧只保留降级判定，避免新增第五处判定逻辑 |
| S3（workflow.yaml 瘦身） | 未动；版本对齐目标更新为 **0.33.0-alpha.0** | 有效 |
| T1（BOUNDARY 35→36） | `BOUNDARY.md:17` 仍写 35 次；index.ts 无新顶层注册（新变更均为子命令级，顶层 58 不变） | 有效 |
| T2（删 en/orchestrator-en.md） | 文件仍在 | 有效 |
| T4（docs:audit 进 npm scripts） | package.json 无 docs:audit；**注意**：`ci-check.mjs` 已新增 Check 4（spawn CLI --json 双 schema 归一化），T4 接入须对齐新结构，勿复制旧口径 | 有效，实现注记更新 |
| E1（BP 入图 CHG-8） | `phase-graph-loader.ts` / `workflow.default.yaml` 未动 → 立项输入不变；新 `W-GRAPH-xxx` 须注册 `ERROR_CODES`（现 111 码/20 域）+ 纳入 guard 守卫测试扫描面（src/guard）；phase_bps 属引擎配置非 constraints/，**E-GUARD-010 通道核验不适用**（无词法锚点义务） | 有效 |
| E3（限流入图不做） | 维持 | 有效 |
| P1/P2（打磨） | 未动 | 有效 |
| AC 基线 | tests/ 现 **276 files**（+5：ready-actions / delta-channels / fence-guard / structure-lint / archive-branches 扩充）；精确 test 数须实跑一次确认（诚实标注：未实测） | 批次 2/3 的"无回归"判据以新基线为准 |

**重析后执行建议不变**：批次 1/2 先行（可并行），批次 3 待 D3 放行。

---

## 0. 根因与方案主线

评估结论：残余缺陷 100% 收敛于**"编排事实写了但没有装载消费者"**。方案主线三步：

1. **先修文本矛盾**（低成本，立即消除第三态）；
2. **再单源化编排器**（把决策核送进装载面，消四写为一写）；
3. **最后把 BP 下沉为图数据**（编排契约从 prose 变为可机器判定的引擎 schema，CHG-8）。

## 1. 待裁决项（推荐默认已标注，评审时可推翻）

| # | 议题 | 选项 | 推荐默认 | 理由 |
|---|---|---|---|---|
| D1 | 编排器单源化 | A：决策核并入 `mumuspec-workflow`，`mumuspec/SKILL.md` 降为资源层；B：把 `mumuspec` 加入 `WORKBUDDY_PACKAGES` | **A** | 装载面不变；决策核约 +120 行 vs 中文版 366 行常驻；自愈手册（guard 速查表）变为可达 |
| D2 | skill 侧 `workflow.yaml` 处置 | ① 删段留指针；② 生成式下沉；③ 标注非权威 | **①，两步走**：S2a 先删 guards 段 → E1（BP 入图）完成后 S2b 删 graph/presets 段 | 18 BP 的结构化定义在 E1 落地前无处可去，不能先删 |
| D3 | BP 18 个全量入图是否立项 | 立 CHG-8（full）/ 不立 | **立 CHG-8** | 编排契约完备性的唯一治本路径；纯增量可选段，兼容风险低 |
| D4 | loop workflow | 补 skill / 标注 experimental | **标注 experimental** | 无实跑需求前写 skill 违反 YAGNI（Ponytail L1） |
| D5 | 单源化后 `mumuspec-workflow` 语言 | 正文中文化（与 phase skills 一致）/ 保持英文骨架+中文决策核 | **正文以中文为准**，frontmatter description 保留英文触发句并补中文触发词 | B 面 6 件均为中文，用户全中文环境；name 不改（避免破坏 `WORKBUDDY_PACKAGES` 与触发） |

---

## 2. 批次 1：仓库文档批（直接执行，不立 change）

| # | 改点 | 改法 | 验收判据 |
|---|---|---|---|
| T1 | `src/cli/commands/.mumuspec/BOUNDARY.md:17` | "35 次 register 调用"→"36 次（2026-09-13 实测）" | 与 `index.ts` grep 计数一致；TC-L3-1 通过 |
| T2 | `skills/mumuspec/en/orchestrator-en.md` | 删除（41 行 v0.12.2 残留，含旧命令形态，无消费者） | 文件不存在；`link-check.mjs` 无死链 |
| T3 | 评估报告 §3.3 sync 判断更正 | ✅ 已随本方案执行（`sync.ts:224` 确认 skill 文本属实） | 报告已含更正注记 |
| T4 | `.workbuddy/cmd-audit.mjs` / `link-check.mjs` → npm scripts | package.json 增 `docs:audit`，接入发版前检查清单 | `npm run docs:audit` 可跑；ci:check 或发版清单引用之 |

## 3. 批次 2：A 面 skill 批（hotfix 级：改完一次 `--force` 重装 → W-SKILL-001 复验）

| # | 改点 | 改法 | 验收判据 |
|---|---|---|---|
| S1 | `skills/mumuspec/phase-archive/SKILL.md`（N1） | 删"Phase Guard 调用"段中 `active_change_slot_released: true` 与 `spec changes committed to main branch` 两项，与"退出条件/已知缺口"对齐 | 同文件 grep 两字段 = 0 |
| S2 | 编排器单源化（D1 方案 A + D5 中文） | 把 4 段决策核并入 `skills/mumuspec-workflow/SKILL.md`：①预设检测 Step 0（hotfix/tweak 判定+活跃变更数表）②8 条阶段判定 ③guard 错误速查表（6 码→修复命令）④`.mumuspec.yaml` 字段参考 ⑤"该校验跑哪个命令"路由表（引用 `mumuspec capability`，P1-3）；`mumuspec/SKILL.md` 删除上述重复，仅保留 dispatch 表 + BP 资源定义 + 非权威标注 | 描述"阶段分发规则"的文件数 = 1；B 面 grep `E-GUARD-009` 修复命令 > 0；grep `capability` > 0 |
| S3 | `skills/mumuspec/workflow.yaml`（S2a，D2 第一步） | 删 guards 段改一行指针→`docs/reference/phase-guards.md`；version 对齐运行时包版本；顶部加"非权威：图与 presets 定义待 E1 迁入引擎图"标注 | 与 phase-guards.md 零重复清单；无 `blocking_point`/`bp` 同名不同义共存 |
| S4 | loop workflow 标注（D4） | `src/change/workflow.default.yaml` loop 段加 `# experimental：无 skill 消费者，勿用于生产变更` 注释 + docs 同步注记（纯注释，不动 schema） | `WORKFLOW_KEYS` 校验与 AC-01 测试不回归 |
| S5 | 重装与复验 | `npx mumuspec install workbuddy mumuspec-workflow phase-open phase-design phase-build phase-verify phase-archive workflow-presets --force`；重跑 `mumuspec check` | W-SKILL-001 计数 = 0；A/B 哈希 7/7 SAME；`tests/guard/skill-registry.test.ts` 通过 |

**批次 2 终态自检**：`check` exit 0 / `validate` unverifiable=0 / `ci:check` 0 error / vitest 全绿。

## 4. 批次 3：引擎批（CHG-8 立项输入，full workflow）

### E1（主项）BP 全量入图
- **schema 扩展**（纯增量可选段，缺省行为不变）：
  ```yaml
  workflows:
    full:
      phases: [...]
      phase_bps:            # 新增可选段：phase → 该阶段的人工决策点
        open: [BP-1, BP-2, BP-3]
        design: [BP-4, BP-4.5, BP-5, BP-6, BP-7, BP-8]
        build: [BP-9, BP-10, BP-11, BP-12, BP-13]
        verify: [BP-14, BP-15, BP-16]
        archive-in-progress: [BP-17]
      presets_bps:          # 或按 workflow 键：hotfix/tweak 的 BP-18
  ```
- **引擎改动**：loader 校验（BP id 全局唯一、phase 必须在 canonical 列表、presets 条件 workflow 已知）→ `graph verify` 增加"skill 声明 BP ↔ 图 BP"一致性检查（新 `W-GRAPH-xxx`，注册 `ERROR_CODES`，fail-open 仅告警）→ `state check --recover` / dashboard 消费 phase_bps 输出"当前阶段待确认决策点"。
- **兼容性**：JSON 面纯增量；无项目级 override 的仓库行为零变化；损坏 phase_bps 走既有 fail-safe（WARN + 忽略该段）。
- **迁移收尾**：E1 落地后执行 S2b——删 skill 侧 `workflow.yaml` 的 graph/presets 段（18 BP 新家在引擎图），全文件缩为指针页。
- **AC**：`mumuspec graph verify` 能报告全部 18 BP；故意从 skill 删除一个 BP 声明时 `W-GRAPH-xxx` 必现；vitest 基线 271 files / 5134 tests 无回归。

### E2（可选，视 D2 终态）
若 S2b 后保留 skill 侧文件为指针页，则无需额外扫描面；若用户选择"生成式下沉"（D2 选项②），则把该文件纳入 skill-drift 扫描。默认不立。

### E3（明确不做）
`rollback_limit` / `rebuild_limit` 入图配置——per-change 状态是正确归属（每次变更可独立调预算），无"同引擎不同策略"真实需求前不扩 schema（Ponytail L1）。

## 5. 批次 4：打磨（P2，随相邻批次顺带执行）

- **P1**：BP-9（plan-ready 暂停）与 BP-10（隔离 + 执行方式）合并为一次询问——选项集不变，仅减一次往返；改 `phase-build` Step 3/4。
- **P2**：5 份 phase skill 的"输出语言约束 / 幂等性 / 伴随能力声明"三段近乎逐字重复（≈60 行/份），抽为包内共享章节（`skills/mumuspec/shared-conventions.md`）或由安装器注入页眉；注意抽取后 `W-SKILL-001` 比对口径仍按单文件哈希，需同步方案。

## 6. 执行顺序与依赖

```
批次 1（文档）──┐
批次 2（skill）──┴──> 复验（W-SKILL-001=0 + 三件套全绿）
                        │
                        ▼
              批次 3：CHG-8 立项（E1，full workflow）
                        │
                        ▼
              S2b（删 workflow.yaml graph/presets）──> 批次 4（P1/P2 打磨）
```

批次 1/2 相互独立可并行；批次 3 必须在人确认 D3 后立项；S2b 依赖 E1。

## 7. 风险与回退

| 风险 | 缓解 | 回退 |
|---|---|---|
| S2 决策核并入后 `mumuspec-workflow` 过长 | 决策核控制在 +150 行内（表格化、删重复），Decision Core 仍居首屏 | git revert + 重装 |
| E1 schema 扩展破坏旧项目 | 可选段 + fail-safe 忽略 + AC 同构测试 | change 流程自带回退（回退边 verify→build） |
| 重装覆盖 B 面人工改动 | B 面 8 件全部由安装器生成（无人工增删，昨日审计 F1 已证） | 不适用 |
| 守卫测试因 skill 正文变化误报 | `tests/guard/skill-registry.test.ts` 断言的是 guard 目标阶段合法性/参数签名，S1-S4 不触碰这些形态 | 调整断言须在同一 change 内裁决 |

## 8. 明确不做（延续既有裁决）

- 不改 18 BP 的存在性与人工确认机制；不引入自动重装钩子；不重命名遗留 `E-` 前缀码；不据 `sync` 的 missing exports 警告扩写冻结契约。

---

## 附：工作量与 workflow 映射

| 批次 | 映射 | 规模 | 前置 |
|---|---|---|---|
| 批次 1 | 直接执行 | 4 项，≤4 文件 | 无 |
| 批次 2 | hotfix | 5 项，≤4 文件 + 1 次重装 | 批次 1 可并行 |
| 批次 3 | full（CHG-8） | 引擎 schema + loader + graph verify + dashboard + 测试 | D3 确认 |
| 批次 4 | 顺带 tweak | 2 项 | S2b / 任意时点 |
