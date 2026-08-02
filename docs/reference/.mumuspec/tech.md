---
scope: docs/reference
layer: 2
---
# Technical Design: reference

## SHALL
- 参考文档标注 `> 层级: Level 2 参考文档`
- CLI 命令参考必须包含语法、参数、示例与输出说明
- 错误码参考必须使用统一命名规范（E-DOMAIN-XXX，如 E-DESIGN-009）
- 配置项参考必须标注默认值、可选值与版本引入信息
- 参考文档与 src/cli/commands/ 实现保持同步

## SHALL NOT
- 禁止在参考文档中描述设计动机与架构决策（属于 design/）
- 禁止参考文档与实际 CLI 实现产生矛盾

## 架构决策
- **Level 2 定位**：面向操作者与 CI 配置，提供速查而非深度设计
- **命令分组**：CLI 命令按功能域分组（规范管理、变更管理、特性配置、诊断引导等）
- **错误码统一**：所有错误使用 E-DOMAIN-XXX 命名，便于 grep 与 CI 集成

## 依赖关系
- 引用 ../design/ 各架构层设计文档的详细设计
- 引用 ../STATUS.md 的 CLI 命令数量与 MCP 工具数量
- skills/ 子目录引用 skills/ 目录中的原生 Skill 文件
- src/cli/commands/ 是 CLI 命令的实现来源
- 子目录：skills/（Skill 详细设计规范）
