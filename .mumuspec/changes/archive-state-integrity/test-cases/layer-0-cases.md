# Test Cases — archive-state-integrity (Layer 0: 单元测试)

## L0-1 归档后状态写入归档目录

- Given: 一个处于 `archive-in-progress` 的变更
- When: 执行归档
- Then: 归档目录内 `.mumuspec.yaml` 的 phase 为 `archive-completed`，且活跃区不再存在同名目录

## L0-2 状态解析回退到归档目录

- Given: 活跃区不存在该变更目录，归档区存在对应归档目录且含状态文件
- When: 读取该变更状态
- Then: 返回归档目录内的状态，而非报"变更不存在"

## L0-3 分支提交失败不标记已处理

- Given: 变更处于分支隔离且 `branch_status` 未处理，git 提交返回非 0 状态
- When: 执行分支提交
- Then: 抛出错误，`branch_status` 保持未处理，审计记录为失败

## L0-4 分支提交触发条件与阶段解耦

- Given: 变更处于分支隔离且 `branch_status` 未处理，当前阶段不是 verify
- When: 执行 `guard --apply` 到归档阶段
- Then: 分支提交被执行

## L0-5 tweak 携带 delta-spec 时拒绝归档

- Given: 变更工作流为 tweak，且 `delta-specs/` 下存在内容非空的文件
- When: 执行归档
- Then: 拒绝归档并提示改用 hotfix

## L0-6 tweak 无 delta-spec 时正常归档

- Given: 变更工作流为 tweak，且无 delta-specs / constraints 内容
- When: 执行归档
- Then: 归档正常完成

## L0-7 一致性检查发现残留状态目录

- Given: 活跃区存在仅含状态文件的目录，且归档区存在同名归档目录
- When: 执行归档一致性检查
- Then: 报告残留目录问题

## L0-8 一致性检查发现归档状态阶段错误

- Given: 归档目录内状态文件的 phase 不是 `archive-completed`
- When: 执行归档一致性检查
- Then: 报告归档状态阶段问题

## L0-9 归档目录名不重复添加日期前缀

- Given: 变更名已以 `YYYY-MM-DD-` 开头
- When: 计算归档目录名
- Then: 结果不出现两个日期前缀
