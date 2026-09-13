# New SHALL Constraints

## Requirement: Delta Merge Integrity

归档时的 delta-spec 合并必须留下可判定事实：合并成功、幂等跳过或显式失败三态之一，不允许静默丢弃。

- SHALL: 归档合并 delta-spec 时，对每个无法解析合并目标或读写失败的 delta 文件以 `E-CHANGE-022` 中断归档并留 audit 记录
- SHALL: `mergeDeltaSpecsToMain` 返回包含已合并文件与未解决文件（含原因）的结果对象
