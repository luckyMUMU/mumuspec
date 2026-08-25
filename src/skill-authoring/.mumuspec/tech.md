---
scope: src/skill-authoring
layer: 2
last_updated: '2026-08-04'
---

# Technical Design: skill-authoring

## SHALL constraints (migrated from spec.md)

- 必须提供技能验证功能（validateSkill）
- 必须提供技能脚手架生成（scaffoldSkill）
- 创作协议必须包含 version、schema、subagents、templates 字段

## SHALL NOT constraints (migrated from spec.md)

- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止创建不符合 AUTHORING_PROTOCOL 的技能

## Enforcement (migrated from spec.md)

- SKAUTH-1: 检查无外部 import（仅 node: 前缀）
- SKAUTH-2: 检查技能符合协议 schema

## 架构决策 (Architecture decisions)

- **协议常量**：AUTHORING_PROTOCOL 定义版本、schema 名、subagent 角色、模板类型
- **技能目录结构**：技能可存为 `.mumuspec/skills/<name>/SKILL.md` 或 `.mumuspec/skills/<name>.md`
- **验证规则**：检查 SKILL.md 存在性、标题格式（以 `#` 开头）
- **零依赖**：仅使用 `node:fs`、`node:path` 内置模块
- **技能列表**：readdirSync 扫描 skills 目录，过滤 locale 子目录（en/zh）

## 接口契约 (Interface contracts)

```typescript
const AUTHORING_PROTOCOL: {
  version: string;
  schema: string;
  subagents: string[];
  templates: string[];
};

interface SkillValidationResult { valid: boolean; errors: string[]; warnings: string[]; }
interface SkillScaffoldResult { created: string[]; errors: string[]; }

function validateSkill(projectRoot: string, skillName: string): SkillValidationResult;
function listCustomSkills(projectRoot: string): { name: string; path: string; valid: boolean }[];
```

## 依赖关系 (Dependencies)

- **上游**：仅使用 `node:fs`、`node:path` 内置模块（零外部依赖）
- **下游**：被 `src/cli/commands/skill.ts` 命令模块调用
