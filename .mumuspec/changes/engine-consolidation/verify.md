# Verify: engine-consolidation

- vitest 302/302 绿；tsc 0 错；check/validate exit 0；ci-check 0 error。
- eval-corpus：recall=1.000 (n=17) / noise=0 / precision=1.000（bad-gate-001 悬空指针必中 E-GUARD-013；clean-05 合法指针零误报；clean-06 lex 前缀系统行为零 E-GUARD-003 误报）。
- L1：stripChannelMarker 表驱动 + 端到端等价（带/不带前缀同路径，含"普通红线带前缀仍真实扫描"反例）——假豁免/假误报根因清零。
- L2：resolveGate 五态单测 + 发射面（悬空 E-GUARD-013，forceable:false + always_enforce 注册）；tech.md 契约节写明 gate 语义边界（验门禁存在，非自行扫描）。
- L3：dogfood 挂 gate 2 条（E-SPEC-015/E-SPEC-004 码+语料双核验通过），strong 2→4、legacy_weak 21→20；其余 20 条逐条归类留痕（migration/gate-mapping.md：A 共存无码承载 / B 系统行为待语料 / D roadmap 数据待 validator——均为诚实保留而非遗漏）。
- **偏差登记**：design 预估"legacy_weak ≤ 8"未达（实际 20）。原因：诚实性核验显示多数条目无可挂的真门禁（unit-test 指针形态按设计拒收；为无语料证据的码建必须命中语料触红线）。翻闸条件已在 review/legacy-flip-decision-2026-09-20.md 给出三步时序。
- 过程诚实记录：L3 首次挂 gate 时曾引入 1 条正文不存在的 frontmatter 注解（fabricated），当轮发现即删除，未进入任何提交状态。
