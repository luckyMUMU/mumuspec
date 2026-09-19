# New SHALL Constraints

- SHALL 将变更状态写入其当前物理位置：任何移动变更目录的动作之后，状态写回必须落在移动后的目标目录内
- SHALL 使归档一致性检查的归档名收集覆盖 changes/archive/discarded/ 子树
- SHALL 使归档阶段判定覆盖该子树内的状态文件，使废弃归档的阶段判定不留盲区
- SHALL 使结构白名单的权威源唯一：规范文本声明校验器为权威源，不再内联复写其成员集合
