---
id: DS-EVAL-004
layer: 0
scope: .
delta: ADDED
---

## Requirement: 语料位置隔离与汇总报告出口

### SHALL
- SHALL 评测语料库存放于 findSpecDirs 不扫描的隐藏目录 .eval-corpus，bad-case 语料覆盖可发射集 15 码各至少 1 例：E-SPEC-001、E-SPEC-002、E-SPEC-003、E-SPEC-004、E-SPEC-006、E-SPEC-008、E-SPEC-009、E-SPEC-010、E-SPEC-011、E-SPEC-013、E-SPEC-014、E-SPEC-015、W-SPEC-016、E-GUARD-010、E-CHANGE-022，并附带 clean 语料。
- SHALL E-SPEC-005、E-SPEC-007、E-SPEC-012 标注为 registered-but-not-emitted（M1 出范围，与 E-DESIGN-001/002/009 前例一致），不为其建立必须命中的语料。
- SHALL eval 命令提供 --report 汇总输出（文本与 JSON 双形态），聚合 corpus recall/noise、可验证率、fail-open 计数与测试覆盖率引用。
- SHALL report 汇总附 corpus 聚合精度（mustContainSatisfied 的命中比率），仅展示、不设阈值。

### SHALL NOT
- SHALL NOT 语料文件位于 tests、temp 等会被规范 walker 递归扫描的路径。
- SHALL NOT report 输出改变 check 与 validate 命令的既有 JSON schema。
- SHALL NOT 让语料期望与引擎实际发射面脱钩（为无发射点的码建立必须命中的语料）。

Enforcement: fixture-location 断言单测（仓库根 validate 的 coverage 计数不含语料条目）；report 渲染单测快照。
