# Test Cases — archive-prune-safety (Layer 0: 单元测试)

## L0-1 finalize-archive 不删除陈旧归档目录

- Given: `changes/archive/` 下存在 mtime 早于 30 天阈值的归档目录，且该目录完成 finalize 所需的前置条件
- When: 执行 `finalize-archive`
- Then: 该归档目录及其全部内容仍然存在，目录内文件数量与执行前一致

## L0-2 陈旧归档以只读方式报告

- Given: `changes/archive/` 下存在 mtime 早于 30 天阈值的归档目录
- When: 执行 `finalize-archive`
- Then: 输出包含该归档条目名称，且命令未调用目录删除

## L0-3 discarded 目录不受影响

- Given: `changes/archive/discarded/` 存在且 mtime 早于阈值
- When: 执行 `finalize-archive`
- Then: `discarded/` 仍存在

## L0-4 未陈旧的归档不被报告

- Given: `changes/archive/` 下存在 mtime 晚于阈值的归档目录
- When: 执行 `finalize-archive`
- Then: 输出不包含该归档条目
