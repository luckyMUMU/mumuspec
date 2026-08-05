---
scope: src/i18n
layer: 2
---

# Boundary Document: i18n

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `initLocale` | `(workspacePath?: string) => Locale` | locales.ts | 从环境变量/配置初始化语言 |
| `getLocale` | `() => Locale` | locales.ts | 获取当前语言 |
| `setLocale` | `(locale: Locale) => void` | locales.ts | 设置当前语言 |
| `listAvailableLocales` | `(projectRoot: string) => Locale[]` | locales.ts | 列出可用的语言列表 |
| `resolveSkillPath` | `(projectRoot: string, skillName: string) => string \| null` | locales.ts | 解析本地化技能文件路径 |
| `t` | `(template: string, vars?: Record<string, string \| number>) => string` | locales.ts | 模板字符串插值翻译 |
| `uiString` | `(key: string) => string` | locales.ts | 获取 UI 本地化字符串 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `Locale` | 语言标识符（'zh' \| 'en'） |
| `LocaleConfig` | 语言配置（locale + fallback） |
| `SkillI18n` | 技能 i18n 文本（name/description/instructions） |

### 导出常量

| 常量 | 用途 |
|------|------|
| `UI_STRINGS` | 双语文本映射表 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| 无 | 零运行时依赖（仅 Node.js 标准库） |

### 外部依赖

无

## 数据契约

### 输入

- 翻译模板（含 `{key}` 占位符）
- 插值变量表
- 技能名称

### 输出

- 翻译后的字符串

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 修正函数名：getAvailableLocales→listAvailableLocales，移除不存在的 getDefaultLocale | 文档-代码一致性修复 |
