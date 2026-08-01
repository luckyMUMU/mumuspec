---
id: "UA-004"
title: "知识覆盖度分析"
scope: "src/cli.ts"
type: "shall"
layer: 0
---

## SHALL

新增知识覆盖度分析命令。

### 命令

```
mumuspec knowledge coverage [--scope <path>] [--json]
mumuspec knowledge gaps --scope <path> [--min-importance <n>]
```

### 算法

1. 获取 scope 内所有代码节点
2. 获取 reverseIndex 覆盖的节点集合
3. uncovered = allNodes - coveredNodes
4. importance = inDegree × callFrequency
5. gaps = uncovered.filter(importance > THRESHOLD)

## Reason

识别知识盲区可帮助团队有针对性地补充缺失的设计知识。
