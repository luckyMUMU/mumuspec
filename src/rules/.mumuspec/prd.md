---
scope: src/rules
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: rules

## 模块职责 (What this module does)

AI 规则文件生成模块，为不同的 AI 编程工具生成项目规则文件。

- `generateRulesFiles()` — 生成三种规则文件：CLAUDE.md、.cursorrules、AGENTS.md
- `generateRulesContent()` — 为特定文件名生成规则内容
- 规则内容包含：项目概述、工作流规则、Ponytail 约束、CLI 命令参考
- 生成前加载 spec 上下文（如果存在），嵌入到规则文件中

## 存在理由 (Why it exists)

AI 编程工具（Claude Code、Cursor 等）通过项目根目录的规则文件理解项目约束。
rules 模块将 MumuSpec 的规范约束转化为各工具能识别的规则文件格式，
确保 AI 助手在编程时遵循项目的 SHALL/SHALL NOT 约束和 Ponytail 编码原则。

## 用户场景 (User scenarios)

1. **初始化生成**：`mumuspec init` 时自动生成规则文件
2. **更新规则**：规范变更后重新生成规则文件以同步约束
3. **多工具支持**：同时为 Claude Code 和 Cursor 生成规则文件
4. **Spec 注入**：规则文件中嵌入当前项目的 spec 上下文

## 验收标准 (Acceptance criteria)

- 生成三种规则文件：CLAUDE.md、.cursorrules、AGENTS.md
- 规则内容包含项目概述、工作流规则、Ponytail 约束、CLI 命令参考
- 生成前加载 spec 上下文（如果存在）
- 不覆盖用户手动编辑的规则文件（除非指定 --force）
- 规则文件包含项目名称与约束信息
