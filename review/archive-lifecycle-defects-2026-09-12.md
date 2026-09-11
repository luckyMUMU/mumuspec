# 变更生命周期引擎缺陷深度分析

> 日期：2026-09-12　范围：`src/change/` + `src/cli/commands/finalize-archive.ts` + `src/core/git.ts`
> 方法：逐行代码定位 → 仓库实证核对 → 与根规范既有约束比对
> 结论：4 处缺陷（含 1 处 P0 数据销毁风险）+ 1 处校验面缺口。四处全部**违反根规范已有约束**，不是"约束缺失"，是"实现未合规"。

---

## 摘要

| # | 缺陷 | 严重度 | 性质 | 违反的既有约束 |
|---|------|--------|------|----------------|
| D1 | `finalize-archive` 递归删除 >30 天的归档目录 | **P0** | 名为缓存清理，实为归档销毁，无确认、无审计、无清单 | 「SHALL NOT 在用户未确认时执行不可逆操作」 |
| D2 | 归档后状态写回失效，产生"状态分裂" | P1 | 权威状态留在错误一侧，且已污染 git | 「SHALL NOT 存在产出物无消费者的死端」同源（权威源唯一性） |
| D3 | `guard` 分支提交失败静默放行 | P1 | `allowFail` 扩散到承载门禁语义的调用点 | 「SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录）」 |
| D4 | tweak 归档静默跳过 delta 合并 | P2 | 条件分支吞掉子过程，无任何可观测信号 | 「SHALL NOT 代码静默消费校验失败的规则（fail-open）」同源 |
| D5 | 校验面对"引擎自身状态一致性"零覆盖 | P1（缺口） | 以上四处均不被 `check`/`validate`/`drift`/4969 测试捕获 | — |

**为什么现在才暴露**：D1 的触发条件是 mtime > 30 天，当前最老的归档目录 mtime 为 2026-09-06（被历史操作统一刷新），距触发约 24 天；D2 的表现是"多出一个目录"，`listActiveChanges` 恰好按 phase 过滤掉了它，因此不报错、不阻塞、不显形。两者都是**沉默的**。

---

## D1（P0）— `cleanStaleCache` 实为归档销毁

**位置**：`src/cli/commands/finalize-archive.ts:402-432`，由 Step B7 在每次 `finalize-archive` 无条件执行。

```ts
const STALE_ARCHIVE_DAYS = 30;
function cleanStaleCache(projectRoot, _config): number {
  const archiveDir = join(changesDir, 'archive');
  for (const entry of entries) {                     // entries 含 discarded/ 与所有归档目录
    const stat = statSync(join(archiveDir, entry));
    if (stat.mtimeMs < cutoff) {
      rmSync(entryPath, { recursive: true, force: true });   // ← 递归删除整个归档变更目录
      cleaned++;
    }
  }
}
```

**四项独立失效叠加**：

1. **名实不符**：函数名、输出文案（`cleaned N stale cache entries`）、注释（"清理陈旧归档项"）全部指向"缓存"，实际删除的是 `.mumuspec/changes/archive/<date>-<name>/` —— delta-specs、decisions.md、design.md、cognitive-map.yaml 的**唯一物理副本**。
2. **无确认**：`finalize-archive` 对删除旧 `spec.md`/`design.md` 有 `--delete-old`/`--keep-old` 显式二选一（L202-236），对归档目录的删除却零交互。
3. **无审计**：只返回计数，audit.log 里不记录删了哪些路径，事后无法追溯。
4. **判定依据脆弱**：用目录 mtime 判定"陈旧"。mtime 会被 git checkout、打包、任何一次写入刷新，与归档时间无因果关系 —— 实测当前所有 7-8 月归档的 mtime 统一为 2026-09-06 23:02，正是这个原因使删除至今未触发。

**实测风险**：`.mumuspec/changes/archive/` 下 29 个归档目录中，最老 mtime = 2026-09-06，cutoff = 2026-08-13。当前安全，但约 2026-10-06 起将开始批量删除 7-8 月归档。`discarded/` 同样在删除范围内。

**可恢复性（唯一的安慰）**：`git ls-files .mumuspec/changes/archive | wc -l` = 261，归档已入库，删除后理论上可从 git 恢复。**未入库的新归档会永久丢失**，且删除时不会有任何提示告诉用户"刚删的是你上个月的变更档案"。

**止血方案（建议 24h 内）**：
- 最小改动：删除动作改为"只报告不删"，输出待清理清单 + 提示改用独立命令。
- 若确需保留策略：拆为独立命令（如 `archive prune`），要求 `--confirm` + 打印完整待删路径清单 + audit 记录每条路径 + 排除 `discarded/` 与未跟踪目录。

---

## D2（P1）— 归档后状态写回失效：状态分裂

**位置**：`src/change/archive.ts:149/197` 与 `src/change/paths.ts:74-76`。

```ts
state.phase = 'archive-completed';                       // L149 仅在内存中改
...
moveDirSync(changeDir, archivedDir);                     // L168 目录已物理搬走
...
saveChangeState(projectRoot, changeName, state, scope);  // L197 仍按 name 派生原路径
```

`getChangeStatePath` 由 `getChangeDir` 派生（`.mumuspec/changes/<name>/.mumuspec.yaml`），而 `writeYaml` 内部 `ensureDir(dirname(filePath))`（`core/utils.ts:52`）会**把已搬走的目录重新创建出来**。

**实证**（当前仓库）：

| 位置 | phase | 说明 |
|------|-------|------|
| `.mumuspec/changes/freedom-metrics-loop-closure/.mumuspec.yaml` | `archive-completed` | 僵尸目录，仅此一个文件 |
| `.mumuspec/changes/archive/2026-09-10-freedom-metrics-loop-closure/.mumuspec.yaml` | **`archive-in-progress`** | 真正的工件所在 |
| `.mumuspec/changes/spec-lexical-channel-hygiene/.mumuspec.yaml` | `archive-completed` | 同上 |
| `.mumuspec/changes/archive/2026-09-11-spec-lexical-channel-hygiene/.mumuspec.yaml` | **`archive-in-progress`** | 同上 |

两个僵尸状态文件**已被 git 跟踪**（`git ls-files` 确认），即错误事实源已提交进版本库。

**后果（比"阻塞 merge"更糟）**：我原先假设它会阻塞 `mumuspec merge` —— 实测恰恰相反。`checkMergeGate`（`branch.ts:114`）用 `loadChangeState(projectRoot, changeName)`，读到的正是僵尸目录里的 `archive-completed`，**门禁照常放行**。而随变更永久留存的归档状态永远停在 `archive-in-progress`，`mergeArchivedChange` 写入的 `git_merge` 记录（L196-200）也只会落进僵尸目录，归档历史永久残缺。

换言之：**门禁通过一个幽灵事实源放行，真实档案被留在未完成态，双方都不知情。** 这属于"下游恰好没炸"而非"设计自洽"，正是规范里「SHALL NOT 以'下游硬过滤兜底'替代事实源自身干净」所禁止的形态。

`listActiveChangesInScope`（`listing.ts:22`）按 phase 过滤终端态，恰好把僵尸目录排除在活跃变更之外 —— 这是它至今不显形的唯一原因。

**修复方向（两层）**：
1. 根治：`loadChangeState`/`saveChangeState` 的路径解析改为"活跃目录优先、归档目录兜底"的解析函数，而不是由 name 无条件派生活跃路径。所有调用点（`checkMergeGate`、`commitChangeBranch`、`guard`、`finalize-archive`）统一走解析结果。
2. 清理：修正归档目录内的 state 为 `archive-completed`，移除两个僵尸目录（需作为一次性迁移处理，不是每次跑的逻辑）。

---

## D3（P1）— `guard` 分支提交失败静默放行

**位置**：`src/cli/commands/guard.ts:43-55` + `src/change/branch.ts:87-107` + `src/core/git.ts:122-125`。

```ts
// git.ts
export function commitAll(cwd, message): GitResult {
  git(cwd, ['add', '-A']);
  return git(cwd, ['commit', '-m', message], { allowFail: true });  // 失败只体现在 status
}
// branch.ts —— 完全不检查返回值
commitAll(projectRoot, `chore(change): commit work for change ${changeName}`);
state.branch_status = 'handled';            // ← 无条件置位
saveChangeState(...);
appendAuditLog(..., { result: 'success' }); // ← 无条件记成功
```

`git commit` 失败（pre-commit hook 拦截、身份未配置、无改动）时 `status !== 0` 被 `allowFail` 吞掉，`branch_status` 照常被置为 `handled`，audit 记为 success。`guard.ts` 的 try/catch 只能捕获 `git add -A` 的抛出，**捕获不到 commit 失败**。这直接违反「SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录）」。

**第二个问题 —— 触发条件语义错位**：

```ts
if (options.apply && phase === 'archive-in-progress') {
  const preState = loadChangeState(root, change);
  if (preState && preState.phase === 'verify' && preState.branch_status !== 'handled') {
```

"提交分支"这一副作用的触发条件被绑定到**守卫的目标阶段名**与**当前 phase 恰好为 verify**。而真正的语义条件应是"分支隔离模式且尚未提交"（`isolation === 'branch' && branch_status !== 'handled'`）。后果：从其它阶段直接 guard、或重跑 guard 时 phase 已变更，提交被**静默跳过**，E-VERIFY-002 恒失败且不给任何提示 —— 上一轮实操中我遇到的正是这一支，只能靠手工 `git commit` + `state set branch_status handled` 绕开。

`commitChangeBranch` 内部其实已有 `if (state.phase === 'discarded' || 'archive-completed') return;` 的守卫 —— 阶段判定本就该留在函数内，调用点只需表达"是否需要提交"。

**修复方向**：
- `commitChangeBranch` 检查 `commitAll` 返回 `status`，非 0 则抛错 + `appendAuditLog(result: 'failed')`，不置位 `branch_status`。
- `guard.ts` 条件改为 `preState.isolation === 'branch' && preState.branch_status !== 'handled'`，阶段守卫下沉到函数内。

**注**：commit 失败后工作区留有 staged 改动，`merge` 的 E-MERGE-006（`isWorkingTreeClean`）大概率会兜住 —— 但这是偶然兜底，不是设计。

---

## D4（P2）— tweak 归档静默跳过 delta 合并

**位置**：`src/change/archive.ts:135-159`。

```ts
const isTweak = state.workflow === 'tweak';
if (!isTweak) {
  mergeDeltaSpecsToMain(...);   // ← tweak 跳过
  mergeChangeArtifacts(...);     // ← tweak 跳过
  extractKnowledgeToGlobal(...); // ← tweak 跳过
}
```

`archive.ts:204` 的 audit 记录 `knowledge_extracted: !isTweak` 是**唯一留存信号**，且只覆盖知识提取；**delta 合并被跳过这件事在 CLI 输出和 audit 中完全没有痕迹**。上一轮实操中 `spec-lexical-channel-hygiene` 携带 delta-spec 却走了 tweak，正是掉进这个洞，靠 `finalize-archive --keep-old` 才补回。

值得注意的是 `finalize-archive.ts:131` 的 B1 步骤**不**检查 tweak（会补做 delta 合并），而 B5（L163）仍检查 tweak（不补知识提取）—— 两条路径对 tweak 的处理不一致，这也是补救能生效、但补救不彻底的原因。

**修复方向**：归档前检测 `delta-specs/*.md` 或 `constraints/*.md` 非空且 `workflow === 'tweak'` → 抛 E-CHANGE-012 并提示改用 hotfix；空则正常跳过并输出明确的 skip 说明。可选 `--allow-spec-skip` 显式覆盖并记 audit。

---

## D5（缺口）— 校验面对引擎自身状态一致性零覆盖

上述四处缺陷**没有一个**被现有防线捕获：`mumuspec validate`（302 条约束）、`mumuspec check`、`mumuspec drift`、4969 条测试全部通过。原因是校验面只检查"规范文本 ↔ 代码"的一致性，不检查"引擎产出的状态工件 ↔ 物理布局"的一致性。

建议新增归档一致性不变量检查（并入 `mumuspec check`）：

1. `.mumuspec/changes/` 下不存在"仅含 `.mumuspec.yaml`"的僵尸目录；
2. 每个 `archive/<date>-<name>/.mumuspec.yaml` 的 phase 必须为 `archive-completed`；
3. 同名变更不得在活跃区与归档区同时存在；
4. 归档目录名不得出现重复日期前缀（当前存在 `2026-09-09-2026-09-09-review-followup-hardening`、`2026-09-09-2026-09-09-completeness-artifacts-freedom-metrics` 两例，另有无前缀的 `security-hardening-residue`）。

第 4 点在实测中已确认属实，是归档命名逻辑缺少"已带日期前缀则不重复添加"判断所致。

---

## 元分析：四处缺陷的同构性

D1–D4 表面分散在四个模块，实则是同一类失效的四种表现：**引擎执行了动作，但没有留下可判定的事实，或把事实留在了错误的位置。**

| 缺陷 | 缺失的不变量 |
|------|-------------|
| D1 | 每个不可逆销毁动作必须经确认并留下路径级审计 |
| D2 | 每次持久化必须落在权威位置（路径解析须随物理布局变化） |
| D3 | 每个副作用必须可判定成功（失败须中断，不得由下游兜底） |
| D4 | 每个跳过必须可观测（不可观测的跳过等价于静默失败） |

这也解释了为什么它们能长期共存：项目对**规范文本**建立了极强的机械校验（302 条约束、词法/注解/手动四通道），而对**引擎自身**几乎没有。信任根缺少对自身的校验。

---

## 建议执行顺序

1. **D1 止血**（独立 hotfix，优先）：删除动作改为只报告；如需保留策略另开独立命令。
2. **D2 根治 + 存量清理**（hotfix）：状态路径解析统一 + 修正 2 个已归档目录的 state + 移除 2 个僵尸目录。
3. **D3**（并入 2 或独立 hotfix）：`commitChangeBranch` 检查返回状态 + `guard` 触发条件语义化。
4. **D4**（同一 hotfix 顺带）：tweak 携带 delta-spec 时报错。
5. **D5**（随之）：新增归档一致性不变量检查 + 修复重复日期前缀。

D2/D3/D4/D5 涉及引擎行为与状态路径语义变更，建议合并为一个 hotfix 变更（携带 delta-spec，须走 hotfix 而非 tweak —— 这正是 D4 的教训）。D1 因为是可逆性与数据安全问题，建议单独变更以便独立评审。

**当前仓库还有一处未提交改动**：`.mumuspec/changes/archive/2026-09-11-spec-lexical-channel-hygiene/delta-specs/*.md` 存在尾随空白/末尾空行差异（上次 finalize 的写入痕迹），不影响语义，可随下次提交一并处理。
