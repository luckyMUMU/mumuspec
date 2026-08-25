# Tasks: R-0005 Meta-Spec Evolution

## 进度

- [x] Proposal（需求验证 + 影响分析）
- [x] Design（架构 + 测试用例锁定 TC-META-01~12）
- [ ] Build: 类型定义 + Effectiveness Scoring Engine
- [ ] Build: 知识层元进化 R0
- [ ] Build: Skill 推荐引擎 R1
- [ ] Build: meta-evolve CLI 命令
- [ ] Build: 影响分析 + 用户确认门
- [ ] Verify: 测试 + guard + verify.md
- [ ] Archive

## 工作分解

| 任务 | 文件 | 预估 |
|------|------|------|
| 类型定义 | src/meta-evolution/types.ts | 0.5h |
| 评分引擎 | src/meta-evolution/scoring.ts | 2h |
| 统计持久化 | src/meta-evolution/stats.ts | 1h |
| 知识层进化 | src/meta-evolution/knowledge-evolution.ts | 2h |
| Skill 推荐 | src/meta-evolution/skill-recommender.ts | 2h |
| CLI 命令 | src/cli/commands/meta-evolve.ts | 2h |
| 契约目录 | .mumuspec/contracts/meta-evolution/ | 0.5h |
| 集成到 guard | src/guard/checker.ts 集成点 | 1h |
| 测试 | tests/meta-evolution/*.test.ts | 3h |
| 文档 + verify | verify.md, decisions.md | 1h |
