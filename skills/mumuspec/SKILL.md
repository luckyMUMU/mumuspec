---
name: mumuspec
description: "MumuSpec — Spec 即 DSL，人工编写规范不写代码。以 /mumuspec 启动，自动检测阶段并分发到子命令。五阶段：open → design → build → verify → archive。"
---

# MumuSpec 工作流编排器（资源层）

> **编排决策核已并入 `mumuspec-workflow`**（预设检测、阶段分发、阻塞点、校验路由、
> guard 错误速查、`.mumuspec.yaml` 字段参考均以该文件为准）。本文件只保留资源定义，
> 不再复写判定规则。

MumuSpec 以树状双向约束规范（WHAT）为核心，外部 Skill 生态负责 HOW，Guard Layer 兜底校验：

```
MumuSpec 管 WHAT  — SHALL/SHALL NOT 约束、规范生命周期、知识管理
外部 Skill 管 HOW  — 技术设计、实现方法、验证策略
Guard Layer 兜底  — 外部 Skill 产出必须通过约束校验
```

**核心原则：brainstorming 不可跳过。每个变更必须经过深度设计（hotfix/tweak 预设除外）。**

---

## 分发表与图定义（唯一数据源）

`skills/mumuspec/workflow.yaml`：

- **dispatch** — orchestrator 入口与预设/阶段分发条件（Step 0-3 见 `mumuspec-workflow`）
- **graph** — 阶段有向图（forward / backward / skip 边 + 阻塞点锚定）
- **phases** — 各阶段 skill 的命令、required skills、阻塞点、进出场动作
- **presets** — hotfix / tweak 的默认值、必需工件、升级条件、跳过项
- **cross_cutting** — ponytail / drift / audit / 测试不可变性 / 认知框架 / 知识管理

守卫检查项清单的唯一权威源：`docs/reference/phase-guards.md`。

## 子命令 ↔ 核心工件

| 命令 | 阶段 | 管理方 | 核心工件 |
|------|------|--------|---------|
| `phase-open` | 1. Open | MumuSpec | proposal.md, delta-specs/, cognitive-map.yaml(预热) |
| `phase-design` | 2. Design | MumuSpec + 外部 Skill | design.md, cognitive-map.yaml, test-cases/, constraints/ |
| `phase-build` | 3. Build | 外部 Skill | tasks.md, suite-map.yaml, 代码提交 |
| `phase-verify` | 4. Verify | MumuSpec + 外部 Skill | verify.md, 分支处理 |
| `phase-archive` | 5. Archive | MumuSpec | 主规范合并, 知识提取, 归档记录 |
| `workflow-presets` | 预设 | 两者 | hotfix/tweak 快速路径 |

## 阶段流转概览

```
/phase-open ──→ /phase-design ──→ /phase-build ──→ /phase-verify ──→ /phase-archive
workflow-presets (hotfix/tweak)：open ──→ build ──→ verify ──→ archive
  ↑ 升级条件触发（BP-18）→ 阻塞确认 → 补充 Design → 回到 full 工作流
回退环：build→design / verify→design / verify→build / archive→build（见 graph 定义）
```

## 伴随能力

各阶段声明的 required skill 与 inline fallback 详见对应 phase skill 的"伴随能力"章节；
统一枚举用 `mumuspec skill companions`（代码侧探测，非模型现场判断）。

## 约束

- 编排器 SHALL NOT 直接编写代码或修改文件（由阶段 Skill 执行）
- 编排器 SHALL NOT 跳过状态检测直接进入阶段
- 每次操作前 SHALL 确认用户意图（可通过 AskQuestion 或直接命令）
- 操作异常时 SHALL 显示错误详情和修复建议
