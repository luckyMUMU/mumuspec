# Delta Spec: 知识提取扩展

> 类型: ADDED | 范围: Archive 阶段知识提取

---

## MODIFIED: Archive 阶段知识提取

在 Archive 阶段自动提取知识时，grill-me 的决策记录也应被提取：

```
grill-me 决策 → 自动识别为 type:decision 知识候选
  - question 作为决策背景
  - answer 作为决策结论
  - Q1 引用作为推理链

提取规则:
  1. 遍历 cognitive-map.yaml grill_me.entries
  2. status == "confirmed" 的条目
  3. 生成 Knowledge Page (type: decision)
  4. 自动关联到 affected_scopes
```

## ADDED: 新知识模式

```
# .mumuspec/knowledge/patterns/KP-0035-grill-me-integration.md

---
id: "KP-0035"
title: "grill-me 深度追问机制集成到 Design 阶段"
type: pattern
status: confirmed
scope: "global"
tags: ["grill-me", "design-phase", "cognitive-framework", "questioning"]
---

背景、设计决策、与认知框架的关系、触发条件等...
```
