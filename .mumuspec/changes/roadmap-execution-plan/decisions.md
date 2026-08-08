# Decision Log: roadmap-execution-plan

## D1: 执行 R-0001 + R-0002 作为本变更范围
- **日期**: 2026-08-08
- **决策**: 本变更执行 roadmap 中已就绪的 P0 item：R-0001（sync 命令）与 R-0002（模块级审查维度 D8）。
- **理由**: 两者均已在 `src/cli/commands/sync.ts` / `review.ts` 实现并有测试覆盖（tests/cli/sync.test.ts、review.test.ts 等），roadmap 状态需与实际一致。
- **影响**: 无外部契约变更；新增 CLI 命令。

## D2: R-0001/R-0002 状态标记为 completed
- **日期**: 2026-08-08
- **决策**: 将 R-0001、R-0002 的 frontmatter `status: active` → `completed`。
- **理由**: 实现与测试均已存在（sync.ts、review.ts D8 维度），DoD 验收条件满足。
- **影响**: roadmap 状态反映真实进度；后续 item 的 depends_on 依赖可正常解析。

## D3: roadmap item 文件重命名 R-NNNN.md
- **日期**: 2026-08-08
- **决策**: 11 个 item 文件按 ROADMAP-10 规范重命名为 `R-0001.md` ~ `R-0011.md`。
- **理由**: 原命名不符合规范（ROADMAP-10 校验失败）。
- **影响**: 文件路径变更，frontmatter id 不变；已提交 commit 12fdc17。

## D4: R-0008/R-0010 scope 路径修正
- **日期**: 2026-08-08
- **决策**: R-0008、R-0010 的 scope 从 `src/core/guard` 修正为 `src/guard`。
- **理由**: 代码实际位置为 `src/guard/`（guard.ts、hooks/guard.ts），原 scope 路径漂移。
- **影响**: 仅元数据修正，无代码变更。

## D5: R-0008/R-0010 mutex_with 清空
- **日期**: 2026-08-08
- **决策**: 清空 R-0008、R-0010 的 `mutex_with`（原与 depends_on 交叠），保留 depends_on 依赖关系；正文"互斥理由（Mutex Rationale）"章节改为"依赖说明（Dependency Rationale）"。
- **理由**: mutex_with 与 depends_on 交叠违反数据约束（同一 item 不能同时互斥与依赖）；实际为依赖关系而非互斥。
- **影响**: 仅元数据修正，已提交。

## D6: 分支覆盖率缺口作为独立 chore 处理
- **日期**: 2026-08-08
- **决策**: 全局 branches 覆盖率 90.34% < 95% 阈值，作为独立 chore 并行补齐（6 个 agent 分组补充测试），不阻塞本变更的 Design 推进。
- **理由**: 覆盖率缺口涉及 15+ 文件、约 278 个分支，与 roadmap 数据修复无耦合。
- **影响**: 新增/扩展 tests/ 下测试文件；不改 src/ 代码。