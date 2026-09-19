# Delta Spec: 归档状态不变量覆盖废弃变更

本变更修复 discard 路径的状态写回目标与归档一致性检查的覆盖范围。两处缺陷同源：
状态的物理位置在目录移动后发生变化，但写回与检查两端都仍按移动前的位置/范围工作。

下列条目均为机器可判定的形式，或有显式人工通道声明。

## Requirement: 归档状态写回与检查覆盖废弃子树

Enforcement: 见下方 ### Enforcement 清单（SCF-1 / SCF-2）

### SHALL

- SHALL 将变更状态写入其当前物理位置：任何移动变更目录的动作之后，状态写回必须落在移动后的目标目录内。
- SHALL 使归档一致性检查的归档名收集覆盖 changes/archive/discarded/ 子树。
- SHALL 使归档阶段判定对该子树内的状态文件同样生效，使废弃归档的阶段不是未完成阶段的判定不留盲区。

### SHALL NOT

- SHALL NOT 通过按名推导的活跃路径写回已被移走的变更状态。
- SHALL NOT 让活跃区残留判定对废弃变更静默失效。

### Enforcement

- SCF-1: manual(代码审阅：discard 与 archive 两条路径的状态写回均落在移动后的目标目录，且 discard 不再重建活跃区目录)
- SCF-2: manual(单元测试：discarded 子树内的条目参与归档名收集，ARCH-001 可命中该子树对应的活跃区残留)
