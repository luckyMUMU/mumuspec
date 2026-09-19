# Decision Log: evaluator-inprocess


## [open] 2026-09-18T15:14:52.004Z

无阻塞决策；实现裁决：in-process 为纯薄封装（buildCheckJsonPayload / detectDriftInProcess 共用 checkCompliance / detectDrift），指标值与输出契约零变化，子进程兜底保留。
