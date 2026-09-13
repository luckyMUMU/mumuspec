# New SHALL Constraints

- SHALL 支持 workflows.<workflow>.phase_bps 可选键（phase 到 BP id 列表的映射），loader 校验键为已知 phase、id 格式 BP-<数字>[.<数字>]、全配置内唯一。
- SHALL graph verify 输出当前 workflow 的 phase_bps 清单，并将 skills/mumuspec/workflow.yaml 声明的 BP 集合与引擎 phase_bps 对比，差异以 W-GRAPH-001 告警（WARN 级）。
- SHALL full workflow 的 phase_bps 并集覆盖 BP-1 至 BP-18 全部 18 个 BP。
