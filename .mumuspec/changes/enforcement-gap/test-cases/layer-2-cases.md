# Layer 2 — status-assertion 对账通道（vitest: tests/guard/status-assertion.test.ts + eval-corpus）

## TC-L2-001: 版本断言
| facts | STATUS 文本 | 期望 |
|-------|------------|------|
| version=0.43.0-alpha.0 | "当前包版本: 0.43.0-alpha.0" | 无 drift |
| version=0.43.0-alpha.0 | "当前包版本: 0.35.0" | 1 条 `type:'status_assertion'` 矛盾，含两值 |

## TC-L2-002: 能力层进度矛盾（双向）
| facts | 断言行 | 期望 |
|-------|--------|------|
| contract 行数 2543 | "Contract Layer … 0%" | 矛盾 drift |
| contract 行数 0/目录缺失 | "Contract Layer … 85%" | 矛盾 drift |
| 行数 2543 | "Contract Layer … 80%" | 无 drift |
| 无映射行（如 "Ponytail"） | 任意百分比 | 跳过，无 drift |

## TC-L2-003: 数量断言
| facts | 断言 | 期望 |
|-------|------|------|
| commandCount=40 | "43+ 命令可用" | 矛盾 drift |
| commandCount=46 | "43+ 命令可用" | 无 drift |
| toolCount=30 | "25+ 工具可用" | 无 drift |

## TC-L2-004: 新鲜度与 fail-safe
| 输入 | 期望 |
|------|------|
| last_updated 距今 45 天 | INFO/WARN 级 `status_assertion`，不阻断 |
| STATUS.md 不存在 | 单条 WARN"对账跳过"，check 不 throw |
| 能力层表头畸形 | 同上，fail-safe |

## TC-L2-005: check 发射与 schema
| 步骤 | 期望 |
|------|------|
| `checkCompliance` 在矛盾 fixture 上运行 | drift 数组含 `type:'status_assertion'`；既有 drift 项结构字段不变（append-only） |
| strict=true 下矛盾项 | severity=error；strict=false 为 warn |

## TC-L2-006: eval-corpus 回归
| fixture | probe | 期望 |
|---------|-------|------|
| `.eval-corpus/bad-drift-001`（0% vs 有实现） | check | mustContain E-DRIFT-016 |
| `.eval-corpus/clean-04`（STATUS 与事实一致） | check | mustNotContain E-DRIFT-016 |
| `mumuspec eval-corpus`（或既有聚合命令） | — | precision=1，kill 判定绿 |

## TC-L2-007: ci-check 接入
| 步骤 | 期望 |
|------|------|
| 仓库 STATUS 存在矛盾行时 `node scripts/ci-check.mjs` | exit 1 且输出矛盾项 |
| 修正 STATUS 后 | 对账步骤 0 矛盾 |
