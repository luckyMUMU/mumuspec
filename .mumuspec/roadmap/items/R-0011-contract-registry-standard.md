---
id: "R-0011"
title: "Contract Registry 标准化：漂移检测 + 影响分析的行业提案"
status: planning
priority: P2
scope: "src/core/contracts, .mumuspec/contracts, docs/"
created_at: "2026-08-06"
target_date: "2027-02-28"
owner: ""
depends_on: ["R-0001", "R-0002"]
mutex_with: []
excludes: []
capacity_cost: 5
---

# R-0011: Contract Registry 标准化

## 背景

> 调研发现当前没有行业标准定义"AI 编程工具应该如何检测规范与代码的不一致性"。
> MumuSpec 的 6 类契约漂移检测是一个事实上的标准草案。
> 如果能推动此机制成为 IDE/DevTool 行业的共同实践（类似 ESLint 对 JS linting 的标准化效应），
> MumuSpec 将获得巨大的行业标准红利。
> 同时，Contract Impact Analysis 是走向企业级合规审计市场的关键门票。

## 范围

### 包含（Includes）
- Contract Registry 格式标准化文档（JSON Schema 定义）
- 漂移检测报告格式标准化（兼容 IDE Problem Matcher）
- 向 MCP 协议工作组提交 Guard/Drift 工具 Schema 标准化提案
- 面向金融/医疗等合规敏感行业的 Contract Impact Analysis 审计报告导出（PDF/HTML）
- Audit Log 跨变更聚合分析（时间线视图、决策热力图）
- 与 ESLint Plugin 体系的互操作适配

### 不包含（Excludes）
- 创立新标准组织（先贡献现有开源标准）
- 跨语言统一契约格式（仅 TypeScript 生态先行）
- 商业化审计功能（保持开源基础能力）

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | Contract Registry JSON Schema 发布 | schema 文档可被 ajv 校验 |
| 2 | 漂移检测报告输出 IDE-compatible 格式 | VS Code 扩展可消费报告 |
| 3 | MCP Tool Schema 标准化提案文档 | 完整 proposal markdown |
| 4 | Contract Impact Analysis 支持 PDF/HTML 导出 | 给定变更范围生成审计报告 |
| 5 | Audit Log 支持跨变更聚合分析（时间线 + 热力图） | HTML Dashboard 输出 |
| 6 | 至少 1 篇面向 MCP 工作组的正式提案发布 | 文档或 GitHub Discussion |

## 工作量预估

`capacity_cost`: 5（≈ 10-15 人天）

| 子任务 | 预估（人天） |
|--------|-------------|
| JSON Schema 定义 | 2 |
| 标准化提案文档 | 4 |
| 审计报告导出 | 4 |
| Audit Log 聚合分析 | 3 |
| MCP 生态互操作 | 2 |

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| MCP 工作组不接受提案 | 中 | 中 | 保持内部能力完整，不依赖外部采纳 |
| 竞品先发布类似标准 | 低 | 高 | 先发制人 + 绑定社区生态 |
| 审计报告功能开发超预期 | 中 | 中 | 最小可用版本先行（纯文本 → HTML → PDF） |

## 互斥理由（Mutex Rationale）

- 本 item 与所有其他 item 无互斥，是构建在 Contract Registry 基础上的长期战略投资。

---

> **关联**: depends_on [R-0001, R-0002] | mutex_with [] | excludes [跨语言, 商业化审计]
