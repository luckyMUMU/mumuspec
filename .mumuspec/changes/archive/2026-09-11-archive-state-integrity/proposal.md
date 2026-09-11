# Proposal: archive-state-integrity

## Why

变更生命周期引擎存在四处一致性缺陷，全部属于"执行了动作但没留下可判定的事实，或把事实留在了错误的位置"：

1. 归档在物理移动变更目录之后，仍按变更名派生原路径写回状态；写盘函数会自动重建已搬走的目录，
   于是活跃区残留一个仅含状态文件的目录（阶段为 `archive-completed`），而随变更永久留存的归档状态
   停在 `archive-in-progress`。门禁与合并流程读到的是残留目录而非真实档案。
2. 分支提交使用容错调用且未检查返回状态，提交失败仍标记为已处理并记成功审计；
   提交动作的触发条件又被绑定到守卫的目标阶段名，从其它阶段执行时提交被静默跳过。
3. tweak 工作流归档时静默跳过 delta-spec 合并，命令行输出与审计均无痕迹，
   携带 delta-spec 的变更归档后规范不更新。
4. 校验面只检查规范文本与代码的一致性，不检查引擎状态工件与物理布局的一致性，
   上述三类问题均无任何防线可捕获。

## What

- 状态路径解析改为"活跃目录优先、归档目录兜底"；归档后状态直接写入归档目录，不再在活跃区重建目录。
- 分支提交检查返回状态，失败即中断并记录失败审计；触发条件改为"分支隔离且未提交"，与阶段名解耦。
- tweak 归档前检出 delta-spec / constraints 内容，非空则拒绝归档并提示改用 hotfix。
- 新增归档一致性检查（残留目录、归档状态阶段、活跃区与归档区重名、重复日期前缀），接入 `check`。

## Impact Scope

- `src/change/state.ts`（状态路径解析）
- `src/change/archive.ts`（归档写回位置、tweak 检出）
- `src/change/branch.ts`（分支提交结果校验）
- `src/cli/commands/guard.ts`（提交触发条件）
- `src/change/archive-consistency.ts`（新增，一致性检查）
- `src/cli/commands/check.ts`（接入一致性检查）

## Workflow
hotfix

## Workflow Path Recommendation

**Recommended Path:** hotfix
**Confidence:** 80%

**Rationale:**
Pure bugfix with confirmed root cause and low risk. Hotfix path appropriate.

> L1 Suggestion mode — awaiting user confirmation before proceeding.
