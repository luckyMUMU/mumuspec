# New SHALL Constraints

- eval runner corpus 场景类型按 corpusDir 下 fixture 子目录独立运行并聚合 recall 与 noise，kill 判定采用多信号 diff（新增码 ∪ coverage 五字段 delta）
- corpus 语料样本输出 Wilson 95% 置信区间，样本数不足 3 时标注置信不足
- custom 场景类型仅执行 assertions 断言，不执行引擎动作
- verifiable-ratio 评估器以 weight 0 注册，value 为 validate coverage 的 strong_ratio
- fail-open-count 评估器以 weight 0 注册，统计 audit.log 中 result 非 success 条目并按 action 分组
- 评测语料库位于 .eval-corpus/ 隐藏目录，位置隔离经 fixture-location 断言验证
- eval 命令提供 --report 汇总输出（文本与 JSON 双形态）
- corpus 聚合区分 killed、missed、errored 三态，探针启动失败或输出不可解析的 fixture 不计入 recall 分母并作为场景 warning 列明
- 未声明 corpusExpect 聚合阈值时输出 report-only 模式 warning，不改变 passed 语义
- 被声明的聚合阈值（minRecall、recallBySeverity、maxNoise）对应分母为 0 时报配置错误（fail-closed）
- corpusDir 下含 .mumuspec 子目录但缺 expected.yaml 的子目录发出 warning 并计数，不计入任何分母
- report 汇总附 corpus 聚合精度（mustContainSatisfied 命中比率），仅展示、不设阈值
- bad-case 语料覆盖可发射集 15 码各至少 1 例（E-SPEC-001、E-SPEC-002、E-SPEC-003、E-SPEC-004、E-SPEC-006、E-SPEC-008、E-SPEC-009、E-SPEC-010、E-SPEC-011、E-SPEC-013、E-SPEC-014、E-SPEC-015、W-SPEC-016、E-GUARD-010、E-CHANGE-022）；E-SPEC-005、E-SPEC-007、E-SPEC-012 为 registered-but-not-emitted（M1 出范围），不建必须命中语料
