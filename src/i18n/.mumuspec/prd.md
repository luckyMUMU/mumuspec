---
scope: src/i18n
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: i18n

## 模块职责 (What this module does)

国际化支持模块，提供 UI 字符串管理和技能文件路径的 locale fallback。

- `initLocale()` — 从环境变量或配置文件初始化 locale
- `getLocale()` / `setLocale()` — 获取/设置当前 locale
- `uiString()` — 通过 key 获取 UI 字符串（支持插值）
- `resolveSkillPath()` — 技能文件路径解析，支持 locale fallback（zh → en）
- 支持 zh（中文）和 en（英文）两种语言

## 存在理由 (Why it exists)

MumuSpec 面向中文和英文用户，UI 输出和技能文件需要根据用户 locale 展示对应语言。
i18n 模块集中管理字符串，避免硬编码。技能文件的 locale fallback 确保
当某语言版本缺失时能回退到默认语言。

## 用户场景 (User scenarios)

1. **语言切换**：`mumuspec i18n set en` 切换到英文输出
2. **技能本地化**：技能目录有 `zh/` 和 `en/` 子目录，根据 locale 加载对应版本
3. **环境检测**：根据 LANG 环境变量自动选择 locale
4. **配置覆盖**：`.mumuspec.yaml` 中的 `language` 字段覆盖环境变量

## 验收标准 (Acceptance criteria)

- 支持 zh 和 en 两种语言
- UI 字符串通过 uiString() 函数获取，支持变量插值
- 技能文件路径解析支持 locale fallback（zh → en）
- locale 初始化优先级：环境变量 → 配置文件 → 默认 zh
- 无外部 npm 依赖
