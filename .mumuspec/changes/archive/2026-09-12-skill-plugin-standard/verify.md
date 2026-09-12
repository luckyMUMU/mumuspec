# Verify Report: skill-plugin-standard

> 阶段：Verify（full 模式）· 变更：skill-plugin-standard · 基线：`c72d351`
> 规模评估：Tasks 0 / Delta specs 1 / Build layers 6 → **full 验证**

## 结论

**验证通过（verify_result: pass）**。全部验证维度实跑通过，无 CRITICAL 项、无接受的偏差。

## 1. 规范一致性（3a）

| 检查 | 命令 | 结果 |
|---|---|---|
| SHALL | `mumuspec check --shall` | ✓ All checks passed |
| SHALL NOT | `mumuspec check --shall-not` | ✓ All checks passed |
| 规范格式 | `mumuspec validate` | ✓ All specs are valid；unverifiable = **0** |
| 合规总门 | `mumuspec check` | ✓ exit **0** |

## 2. 漂移检测（3b）

`mumuspec drift` → **No drift detected**。`check --json` 的 drift 数组：**errors 0 / warnings 0**，
其中 `W-SKILL-001`（本变更新增的技能副本漂移）为 **0**。

> 该维度本轮**实测闭环**：实现漂移检测后立刻报出 **7 个**技能源/副本不一致（mumuspec-workflow、
> phase-{open,design,build,verify,archive}、workflow-presets），重装后归零。这是"检测器真的会响"
> 的证据，而不只是"跑通没报警"。

## 3. 代码图谱（3c）

`mumuspec graph verify --change skill-plugin-standard` → ✓ All checks passed
（rollback 0/3、rebuild 0/5、path to archive-completed 存在）。

## 4. 测试不可变性（3d）

`mumuspec test-cases verify skill-plugin-standard` → ✓ verified
（`design_content_hash` 与逐层 `suites_hash` 均匹配；分层编号重排后已按新语义重新锁定）。

## 5. 契约（3e）

`mumuspec contract verify --change skill-plugin-standard` → **No critical contract drift**（drifts 0）。

## 6. 知识新鲜度（3f）

`mumuspec knowledge verify --all` → 全部 `fresh`，无 stale / unverified。

## 7. 测试全绿

- `npx vitest run` → **271 文件全通过、0 失败**（含本轮新增 5 个测试文件）
- `npm run ci:check` → **0 error / 0 warning**

## 8. 本轮 Verify 阶段发现并修复的项（ENF-16 的真实残留）

进入 Verify 后，按技能文本实际执行命令，暴露 **9 处 flag 级签名漂移**——这是 Build 阶段 ENF-16
只校验"命令+子命令"而未覆盖"参数签名"留下的缺口：

| 技能文本原写法 | 真实签名 | 处置 |
|---|---|---|
| `validate --change <name>` | `validate`（无 `--change`） | 改文本 |
| `drift detect [--change]`（3 处） | `drift [--change]`（`detect` 已弃用） | 改文本 |
| `check --shall(‑not) --change <name>` | `check --shall(‑not)`（无 `--change`） | 改文本 |
| `test-cases lock/hash/verify --change <name>` | 三者均取**位置参数** `<name>` | 改文本 |

**并补上守卫**：`tests/guard/skill-registry.test.ts` 新增"命令参数签名命中注册表"断言——
逐行解析技能文本中的 `mumuspec <cmd> [<sub>]` 与随后的 `--flag`，与命令注册表的 option 集合比对。
该断言当场抓出上述 3 处 `test-cases ... --change`，修复后 10/10 通过。
**这一类缺陷此后可被机械拦住，而非靠人对。**

## 9. 门禁与假设的复核

- `tests/guard/error-code-registry.test.ts` ✓：四个新码（`W-SKILL-001` / `E-SKILL-002` /
  `E-SKILL-003` / `E-BUNDLE-001`）在册且已入生成文档（109 码）。
- `assumptions.yaml` AS-1..AS-7 全部 accepted，无被推翻项。AS-1（宿主登记文件结构仅有磁盘实证）
  的缓解措施（dry-run + fail-closed）已落地并测试覆盖。

## 10. 与 proposal 验收场景的对应

| 场景 | 结果 | 证据 |
|---|---|---|
| S1 产出标准插件包且字段合规 | ✓ | `tests/bundle/plugin-package.test.ts` 断言产物过校验器 |
| S2 安装幂等 + 登记不重复 | ✓ | `tests/install/plugin-install.test.ts`：两次安装条目数为 1、installedAt 保留 |
| S3 改正文必报、仅改版本行不报 | ✓ | `tests/guard/skill-drift.test.ts` 双向断言；实跑 7→0 闭环 |
| S4 幽灵字段零命中、workflow.yaml 与引擎一致 | ✓ | `tests/guard/skill-registry.test.ts`；`workflow.yaml:424-427` 已换为引擎真实读取项 |
| S5 companion 可枚举、缺失不阻断 | ✓ | `mumuspec skill companions` 实跑 11/28 |
| S6 守卫目标阶段改错则测试失败 | ✓ | 该断言已在 `skill-registry.test.ts` 中就位 |

## 11. 偏差与降级记录

**分支隔离降级（必须记录）**：变更声明 `isolation: branch`、`branch: mumuspec/skill-plugin-standard`，
但该分支**实际从未建立**（`git branch --list 'mumuspec/*'` 无此项），三个提交（`417b281` / `e09f14d` /
`2243981` / `fd41f6b`）全部落在 `master` 上。即隔离**降级为就地开发**，与 open 阶段声明的 `worktree_created`
同类失效——本平台 `git` 无法自建嵌套 ref 目录（既有已知环境约束）。

**影响评估**：不影响产物的正确性（自检三件套与全量测试均在 master 上通过），
但**削弱了"变更隔离"这道防线**：期间另一路进程的 `git add -A` 曾把本变更在途工件扫进它的提交，
并因其 merge 静默回退本变更的未提交编辑（本轮已实际发生两次）。这正是隔离缺失的直接代价。

**处置**：记录为降级事实，`branch_status` 置 `handled`（工作在主线已完成，无需合并动作）；
不做事后补分支（rm+重建历史会重写已推送/已合并的提交，风险大于收益）。
**后续建议**：把"isolation 声明必须被落实校验"作为独立项——当前 `isolation` 字段的语义仅在 guard 的
分支提交路径被消费，缺少"声明的隔离模式与实际 HEAD 是否一致"的检查。

## 12. 未验证项（诚实标注）

- 宿主是否采信写入的 `installed_plugins.json` 条目**无法在本仓库验证**（AS-1）。
- `W-SKILL-001` 对 **plugin-cache 形态**安装的比对路径已实现但未在真实插件包上端到端实跑
  （本轮实跑覆盖的是用户级 `~/.workbuddy/skills/` 形态）。
