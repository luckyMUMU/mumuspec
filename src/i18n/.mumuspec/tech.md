---
scope: src/i18n
layer: 2
---

# Technical Design: i18n

## SHALL constraints (migrated from spec.md)

- 必须支持 zh（中文）和 en（英文）两种语言
- UI 字符串必须通过 uiString() 函数获取（支持插值）
- 技能文件路径解析必须支持 locale fallback（zh → en）

## SHALL NOT constraints (migrated from spec.md)

- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止硬编码 UI 字符串（必须通过 UI_STRINGS 常量）

## Enforcement (migrated from spec.md)

- I18N-1: 检查无外部 import（仅 node: 前缀）
- I18N-2: 检查 UI_STRINGS 包含所有必需键

## 架构决策 (Architecture decisions)

- **全局状态**：currentLocale/currentFallback 使用模块级变量，简单高效
- **优先级链**：MUMUSPEC_LANG → LANG 环境变量 → `.mumuspec.yaml` language 字段 → 默认 zh
- **UI_STRINGS 常量**：所有 UI 字符串集中定义在常量对象中，按 locale 分组
- **技能路径解析**：先尝试 `{locale}/skill.md`，不存在则回退到默认路径
- **零依赖**：仅使用 `node:fs` 和 `node:path`

## 接口契约 (Interface contracts)

```typescript
type Locale = 'zh' | 'en';

function initLocale(workspacePath?: string): Locale;
function getLocale(): Locale;
function setLocale(locale: Locale): void;
function uiString(key: string, params?: Record<string, string>): string;
function resolveSkillPath(skillsDir: string, skillName: string): string;
```

## 依赖关系 (Dependencies)

- **上游**：仅使用 `node:fs`、`node:path` 内置模块（零外部依赖）
- **下游**：被 `src/cli/index.ts`（初始化 locale）、`src/skill-authoring/protocol.ts` 调用
