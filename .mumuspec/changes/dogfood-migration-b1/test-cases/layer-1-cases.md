# Layer 1 — 存量迁移结果断言（确定性可由工件状态推导）

## TC-L1-001: implicit-manual 清零
| 步骤 | 期望 |
|------|------|
| `mumuspec validate --json`（迁移批全部回写后） | 无 W-SPEC-017 触发（三源文件 Enforcement 均为 manual(...)/机器通道文本） |

## TC-L1-002: legacy weak 显式化
| 步骤 | 期望 |
|------|------|
| `check --json` coverage | `legacy_weak === 0`；`enforced_weak` 全部经显式 `lex:` 前缀 |

## TC-L1-003: legacy 通道关闭演练
| 步骤 | 期望 |
|------|------|
| 临时置 `specs.legacy_lexical_channel: false` 后 `check` | exit 0，`unverifiable === 0`；随后还原配置再跑 exit 0 |

## TC-L1-004: 语义零丢失抽样
| 步骤 | 期望 |
|------|------|
| 每源文件随机抽 10 条迁移前后 | 约束正文逐字不变（仅 Enforcement 行/前缀变化）；条目计数不变（SHALL 183 / SHALL NOT 120） |

## TC-L1-005: 回归面
| 步骤 | 期望 |
|------|------|
| vitest 全量 / eval run eval-corpus --report / ci-check | 全绿不回退；STATUS 对账 0 矛盾 |
