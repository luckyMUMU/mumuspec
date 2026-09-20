# Tasks: engine-consolidation

## L1 根因修复
- [x] T1-1 stripChannelMarker 导出 + checker/分类器三入口归一（测试先行）
- [x] T1-2 fixture bad-lex-exempt-001

## L2 behavior-gate 契约变更
- [x] T2-1 类型扩展（type+gate_ref）+ gate-validator 纯函数（五态单测先行）
- [x] T2-2 classify R1 接入 + E-GUARD-013 注册（forceable:false, always_enforce）+ gen-error-codes
- [x] T2-3 tech.md 契约变更节（gate 语义边界）
- [x] T2-4 fixture bad-gate-001 / clean-05 + corpus-fixtures 计数同批

## L3 诚实降档与决策面
- [x] T3-1 21 条 legacy_weak 逐条三分类清单（migration/）→ 签收 → 回写
- [x] T3-2 doctor legacy advisory
- [x] T3-3 review/legacy-flip-decision-2026-09-20.md
- [x] T3-4 STATUS coverage 同步 + regen-rules + 版本/CHANGELOG + 全量回归
