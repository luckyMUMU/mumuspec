# Proposal: roadmap-execution-plan

## Why
- 执行 `.mumuspec/roadmap/` 中已就绪的 P0 item：R-0001（sync 命令：代码现状 → 双向同步到持久化）与 R-0002（模块级审查维度 D8 + 各模块独立评分）。
- 修复 roadmap 数据合规问题：item 文件命名不符合 ROADMAP-10（应为 R-NNNN.md）、R-0008/R-0010 scope 路径漂移（src/core/guard → src/guard）、R-0008/R-0010 mutex_with 与 depends_on 交叠、R-0001/R-0002 状态未反映实际完成情况。

## What
- 实现 `mumuspec sync` 命令：扫描 src/ 模块、更新 BOUNDARY.md 导出接口、校验 index.yaml children、生成 contracts/ 契约快照、作为 init 统一入口。
- 实现模块级审查维度 D8：`mumuspec review --module <name>` 输出模块名 + 7 维度子评分，完整审查后输出模块维度汇总。
- 修复 roadmap 数据：11 个 item 文件重命名为 `R-NNNN.md`；R-0001/R-0002 状态 active → completed；R-0008/R-0010 scope 修正为 `src/guard`；mutex_with 清空（保留 depends_on 依赖关系）；正文"互斥理由"章节改为"依赖说明"。
- 补齐分支覆盖率缺口（独立 chore）：全局 branches 覆盖率从 90.34% 提升至 ≥ 95%（vitest 阈值）。

## Impact Scope
- `src/cli/commands/sync.ts`（新增）、`src/cli/commands/review.ts`（扩展 D8 维度）
- `src/core/`（sync 相关核心逻辑）
- `.mumuspec/roadmap/items/R-0001.md` ~ `R-0011.md`（数据修复）
- `tests/`（sync/review 测试 + 分支覆盖补充）
- 无外部 API 契约变更；CLI 命令为新增，不破坏现有命令

## Workflow
full