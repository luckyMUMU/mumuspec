---
scope: docs/reference
layer: 2
---
# Product Requirements: reference

## 模块职责
reference 目录是 MumuSpec 的 Level 2 操作参考文档集合。
它提供 CLI 命令参考、MCP 工具列表、配置项参考、Phase Guard 规则、
漂移检测规则、错误码、术语表等面向操作者与 CI 配置的实用文档。

## 存在理由
设计文档（design/）解释"为什么这样设计"，而操作者需要"如何使用"的速查参考。
reference 目录将所有操作面向的技术参考集中管理，让 CI 工程师、运维人员、
AI 工具用户能快速查到命令语法、配置项含义、错误码含义与排查指引。

## 用户场景
1. **查找 CLI 命令**：查阅 cli-commands.md 获取全部命令的语法、参数与示例
2. **配置 MCP Server**：查阅 mcp-tools.md 了解 MCP 工具列表与配置方法
3. **配置 config.yaml**：查阅 configuration.md 获取所有配置项的完整参考
4. **排查 Phase Guard**：查阅 phase-guards.md 了解工作流守卫规则与漂移检测分级
5. **解决错误**：查阅 error-codes.md 获取统一错误码体系与 --force 说明
6. **理解术语**：查阅 glossary.md 获取核心术语中英文映射与定义
7. **查阅 Skill 生态**：进入 skills/ 子目录阅读各 Skill 的详细设计规范

## 验收标准
- cli-commands.md 覆盖全部 40+ CLI 命令，含语法、参数与示例
- configuration.md 覆盖 config.yaml 所有配置项（含 workflow.*、constraint_strength）
- error-codes.md 覆盖统一错误码体系（E-DOMAIN-XXX），含错误信息模板
- phase-guards.md 覆盖工作流守卫、漂移检测守卫分级（P0/P1/P2）与回退守卫
- 子目录 skills/ 提供各原生 Skill 的详细设计规范
