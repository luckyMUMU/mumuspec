# Tasks: dogfood-migration-b1

## L1 迁移执行（依赖逐批签收）
- [x] T1-1（根 spec.md 已回写：A50+B20+D45） 批1 清单生成并签收 → 根 spec.md 回写（annotation/lex:/manual(reason)）
- [x] T1-2（23 条 manual 显式化；B类 9 条经批1实测偏差登记取消） 批2 清单 → roadmap/spec.md 回写
- [x] T1-3（批3为 no-op：10 条 enforcement 均为机器通道指针，见 batch3-mapping） 批3 清单 → constraints.yaml 回写
- [x] T1-4（legacy=false 演练 exit 0，unverifiable=0，已还原配置） legacy_lexical_channel=false 演练（临时翻转，验证后还原）
- [ ] T1-5 STATUS coverage 运行时字段同步 + regen-rules + 全量回归（check/validate/eval-corpus/vitest）
