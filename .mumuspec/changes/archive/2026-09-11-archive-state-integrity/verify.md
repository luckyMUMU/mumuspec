# Verify: archive-state-integrity

## 测试结果

### 单元测试

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/change/archive-state-integrity.test.ts | 7 | PASS |
| tests/change/state-resolution.test.ts | 4 | PASS |
| tests/change/branch-commit-failure.test.ts | 4 | PASS |
| tests/change/archive.test.ts | 45 | PASS |
| tests/change/archive-branches.test.ts | 20 | PASS |
| tests/change/branch.test.ts | 24 | PASS |
| **合计** | **104** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 259（258 PASS / 1 FAIL） |
| 测试用例 | 4984（4983 PASS / 1 FAIL） |

唯一失败：`tests/cli/cli-smoke.test.ts > mumuspec check runs (dogfooding) with exit 0`。
根因为既有 E-GUARD-003 宽匹配（基线 59 条 + 本次新增文件 1 条 = 60 条），
新增的一条来自 `src/change/archive-consistency.ts` 中的 `.mumuspec.yaml` 字面量，
与既有 59 条属同一通道、同一误报形态，按既定纪律不为此扭曲代码或改通道派生逻辑。

### TypeScript 编译

- `npx tsc --noEmit` — 0 errors

## SHALL / SHALL NOT 校验记录

| 约束 | 判定 | 依据 |
|------|------|------|
| SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录） | 合规 | `commitChangeBranch` 检查提交返回状态，非 0 即抛错并记 `result: 'failed'` 审计；L0-3 用例覆盖 |
| SHALL NOT 在用户未确认时执行不可逆操作 | 合规 | 上一变更已移除归档目录删除；本次无新增不可逆操作 |
| SHALL NOT 存在产出物无消费者的死端（权威源唯一性） | 合规 | 状态随变更写入归档目录，活跃区不再产生残留副本；L0-1 覆盖 |
| SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净 | 合规 | 门禁不再依赖残留目录中的陈旧状态，状态解析以归档目录为权威回退；L0-2 覆盖 |

## 行为验证

| 验证项 | 方法 | 结果 |
|--------|------|------|
| 归档后状态落在归档目录 | L0-1：断言 `saveChangeStateInDir` 以归档目录为参数且 phase 为 archive-completed，且不再回写活跃区 | PASS |
| 状态解析回退 | L0-2：活跃区缺失时解析到归档目录；两侧缺失时回退写场景 | PASS |
| 提交失败中断 | L0-3：status 非 0 抛错、`branch_status` 不变、不保存、记失败审计 | PASS |
| 提交触发条件与阶段解耦 | 条件改为 `isolation === 'branch' && branch_status !== 'handled'` | PASS |
| tweak 携带规范工件被拒 | L0-5：抛 E-CHANGE-012；L0-6：无工件时正常归档 | PASS |
| 一致性检查 | L0-7 残留目录报 E-ARCH-001；L0-8 归档阶段错误报 E-ARCH-002，历史无 phase 格式不误报 | PASS |
| 归档目录名不重复日期前缀 | L0-9 | PASS |

## 存量迁移

一次性迁移已完成（脚本执行后删除）：

- 7 个归档状态阶段修正为 `archive-completed`
- 4 个残留状态目录删除（`2026-09-09-review-followup-hardening`、`archive-prune-safety`、`freedom-metrics-loop-closure`、`spec-lexical-channel-hygiene`）

迁移后 `mumuspec check` 的 E-ARCH-001 / E-ARCH-002 均为 0；剩余 2 条 E-ARCH-003 为历史归档目录重复日期前缀（WARN，不自动重命名以免破坏 git 路径引用）。

## 测试不可变性

- `test-cases lock` 已执行，hash: `e3131bebf61c9c4c`
- Layer 0 用例 9 条全部有对应实现与断言覆盖
