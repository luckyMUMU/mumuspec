# Tasks: dogfood-migration-b1

## L1 迁移执行（依赖逐批签收）
- [ ] T1-1 批1 清单生成并签收 → 根 spec.md 回写（annotation/lex:/manual(reason)）
- [ ] T1-2 批2 清单 → roadmap/spec.md 回写
- [ ] T1-3 批3 清单 → constraints.yaml 回写
- [ ] T1-4 legacy_lexical_channel=false 演练（临时翻转，验证后还原）
- [ ] T1-5 STATUS coverage 运行时字段同步 + regen-rules + 全量回归（check/validate/eval-corpus/vitest）
