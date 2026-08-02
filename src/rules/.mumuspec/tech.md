---
scope: src/rules
layer: 2
---

# Technical Design: rules

## SHALL constraints (migrated from spec.md)

- 必须生成三种规则文件：CLAUDE.md、.cursorrules、AGENTS.md
- 规则内容必须包含项目概述、工作流规则、Ponytail 约束、CLI 命令参考
- 生成前必须加载 spec 上下文（如果存在）

## SHALL NOT constraints (migrated from spec.md)

- 禁止覆盖用户手动编辑的规则文件（除非指定 --force）
- 禁止规则文件缺少项目名称与约束信息

## Enforcement (migrated from spec.md)

- RULE-1: 检查规则文件包含项目信息
- RULE-2: 检查 Ponytail 约束正确嵌入
- RULE-3: 检查 CLI 命令参考完整

## 架构决策 (Architecture decisions)

- **配置驱动**：从 `config.ai.rules_files` 读取要生成的文件列表，支持自定义
- **文件类型适配**：CLAUDE.md 使用 "# Claude Code Rules" 标题，.cursorrules 用 "# Cursor Rules"
- **Ponytail 注入**：从 `src/spec/ponytail.js` 导入 PONYTAIL_LADDER 和 NON_LAZY_DOMAINS 嵌入
- **Spec 上下文嵌入**：如果提供 specContext，将层级规范摘要注入规则文件
- **统一内容结构**：Project Overview → Workflow Rules → Ponytail Constraints → Spec Context → CLI Commands

## 接口契约 (Interface contracts)

```typescript
function generateRulesFiles(
  projectRoot: string,
  config: MumuSpecConfig,
  specContext?: SpecContext,
): string[];

function generateRulesContent(
  fileName: string,
  config: MumuSpecConfig,
  specContext?: SpecContext,
): string;
```

## 依赖关系 (Dependencies)

- **上游**：`src/core/config.js`、`src/core/types.js`、`src/core/utils.js`、`src/spec/ponytail.js`
- **下游**：被 `src/cli/index.ts`（init 命令）和 `src/mcp-server.ts` 调用
