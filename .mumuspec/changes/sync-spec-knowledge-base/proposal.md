# Proposal: sync-spec-knowledge-base

## Why

当前 mumuspec 项目存在以下规范化缺口：

1. **根级 design.md 为空模板** — 架构概览与关键决策未填写
2. **根级 prohibitions.md 为空模板** — 全局禁止约束未定义
3. **src/ 核心代码完全没有 spec.md** — 自用 CLI 工具的 27 个模块无规范约束
4. **demo 项目 42 个警告** — spec 缺少 Enforcement 机制
5. **知识库未同步代码现状** — 28 个 knowledge pages 记录设计决策但缺少与代码模块的显式绑定

导致：AI 工具加载 mumuspec 自身项目时缺乏规范指导，无法用 mumuspec 自己的工具链校验自身代码合规性。

## What

1. **填充根级 design.md** — 编写六层架构概览、模块职责、关键设计决策
2. **填充根级 prohibitions.md** — 定义全局禁止约束（零运行时依赖规则、错误码标准化等）
3. **为 src/ 核心模块创建分层 spec.md** — 按模块/子目录编写最小可工作规范
4. **修复 demo Enforcement** — 为 demo/image-share 和 demo/src 的 spec 补充 Enforcement
5. **更新知识库** — 添加与代码模块绑定的 pattern/lesson 知识页
6. **重建索引** — 更新 index.yaml，确保所有 spec 被发现

## Impact Scope

- `.mumuspec/design.md` (修改)
- `.mumuspec/prohibitions.md` (修改)
- `.mumuspec/spec.md` (修改 — 补充 Enforcement)
- `src/` 下新增 `src/<module>/.mumuspec/spec.md`
- `demo/image-share/.mumuspec/spec.md` (修改 — 补充 Enforcement)
- `demo/src/*/.mumuspec/spec.md` (修改 — 补充 Enforcement)
- `.mumuspec/knowledge/` — 新增知识页
- `.mumuspec/index.yaml` — 更新

## Workflow

full — 需要完整设计 + TDD + 验证
