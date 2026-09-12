# Decision Log: evaluator-weight-single-source


## [build] 2026-09-12T14:43:16.513Z

P1-3 实施：4 个 evaluator 成功返回 weight 全部改为引用自身 defaultWeight（消除字面量副本，D2 重平衡首次真正生效）；types.ts 固化 weight:0=不参与 composite 语义；新增 weight-single-source 防漂移测试（成功路径逐项一致 + 5 active 之和=1）。顺带收尾 P0-1 遗留：.mumuspec/evolution/ 补登 structure-validator 白名单（否则 validate E-SPEC-013）。E17（spec-compliance/drift-score CLI 参数与输出契约不匹配）经核实现状更深——guard --json 输出 {passed:boolean} 而非计数、drift --json 输出数组而非 totalViolations，需评估器数据源重新设计，单独变更，本变更不做。全量 265 文件/5044 测试全绿，check exit 0，validate 通过
