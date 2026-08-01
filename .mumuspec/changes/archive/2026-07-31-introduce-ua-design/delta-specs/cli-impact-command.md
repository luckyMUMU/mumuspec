---
id: "UA-001"
title: "新增 impact 命令"
scope: "src/cli.ts"
type: "shall"
layer: 0
---

## SHALL

新增 `mumuspec impact` CLI 命令，用于分析变更影响范围并关联知识页面。

### 参数

```
mumuspec impact [--diff <range>] [--scope <path>] [--json] [--with-knowledge]
```

- `--diff <range>`: Git diff 范围（如 `HEAD~3..HEAD`），默认分析 working tree
- `--scope <path>`: 限定分析范围
- `--json`: JSON 格式输出
- `--with-knowledge`: 关联 Knowledge Page 生成预警

### 输出

输出包含：变更文件列表、直接影响节点、间接影响节点、知识预警、回归建议。

## Reason

开发者需要快速了解修改代码的连锁影响，避免无意中偏离架构决策。
