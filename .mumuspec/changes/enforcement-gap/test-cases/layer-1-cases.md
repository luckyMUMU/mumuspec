# Layer 1 — constraints.yaml 注解通道（vitest: tests/spec/verifier-entry-annotation.test.ts, tests/guard/constraints-entry.test.ts）

## TC-L1-001: classifyConstraintEntry 判定序四类
| 输入 | 期望 |
|------|------|
| entry 带 `annotation{type:'no-new-dependency'}` | `'enforced-strong'` |
| entry content 以 `lex:` 前缀开头，无注解 | `'enforced-weak'` |
| entry 无注解无前缀，content 含引号术语，`legacyLexical:true`（默认） | `'enforced-weak'` |
| 同上但 `legacyLexical:false` | `'unverifiable'` |
| entry `enforcement:'manual(设计评审)'` 且无注解 | `'manual'` |
| entry 全空声明 | `'unverifiable'` |

## TC-L1-002: 向后兼容
| 步骤 | 期望 |
|------|------|
| 对既有 `.mumuspec/constraints.yaml`（无 annotation 字段）分类 | 与重写前判定逐项一致（enforcement 非空→manual；空→weak/unverifiable 依 isRegexCheckable） |

## TC-L1-003: 适配器投影
| 输入 | 期望 |
|------|------|
| `constraintEntryToItem(entry, 'forward')` | `ClassifiedItem{polarity:'shall', source:'.mumuspec/constraints.yaml#<id>'}`，cls 与 classifyConstraintEntry 一致 |
| `direction:'reverse'` | `polarity:'shall-not'` |

## TC-L1-004: guard 端到端 — E-GUARD-012
| 步骤 | 期望 |
|------|------|
| fixture 项目：forward 条目带 `no-new-dependency` 注解，源文件 import 新依赖 | `checkCompliance` errors 含 E-GUARD-012 |
| 同 fixture 无违规源文件 | errors 不含 E-GUARD-012 |

## TC-L1-005: coverage 合流
| 步骤 | 期望 |
|------|------|
| fixture 含 2 条 spec 条目 + 1 条强注解 constraints.yaml 条目 | `computeEnforcementCoverage` total=3，enforced_strong≥1 |

## TC-L1-006: annotate 建议清单（只读）
| 步骤 | 期望 |
|------|------|
| `mumuspec annotate --json` 对含可匹配条目的 constraints.yaml 运行 | 输出含该条目建议；文件内容字节不变 |
