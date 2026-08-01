---
id: "UA-002"
title: "新增 onboard 命令族"
scope: "src/cli.ts"
type: "shall"
layer: 0
---

## SHALL

新增 `mumuspec onboard` CLI 命令族，提供引导式学习路径。

### 子命令

```
mumuspec onboard init --scope <path> [--role junior|mid|senior|pm]
mumuspec onboard start --scope <path>
mumuspec onboard next --scope <path>
mumuspec onboard complete-step <n> --scope <path>
mumuspec onboard progress --scope <path>
```

### 算法

1. 从 scope 内代码图谱子图获取节点
2. 确定入口节点（入度为 0 或最小入度）
3. 从入口节点 BFS 按层遍历，按依赖顺序排序
4. 每步关联已有 Knowledge Page
5. 持久化到 `.mumuspec/onboarding/` 目录

## Reason

新人面对大型代码库缺少引导，学习路径基于拓扑排序可确保从入口到核心的正确顺序。
