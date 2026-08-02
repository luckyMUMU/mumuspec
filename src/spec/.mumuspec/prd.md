---
scope: src/spec
layer: 2
---

# Product Requirements: spec

## 模块职责 (What this module does)

规范解析与加载模块，负责 spec.md 文件的解析、加载、校验和继承管理。

- **parser.ts** — 解析 spec.md（YAML frontmatter + Markdown body → SpecFile 结构）
- **loader.ts** — 渐进式加载 spec 上下文（Layer 0 → 1 → 2，最多 3 层）
- **validator.ts** — 规范校验（检测 SHALL without Enforcement、layer depth、design.md 缺失）
- **inheritance.ts** — 继承冲突检测（子层不能放松父层约束）
- **ponytail.ts** — Ponytail 约束定义与注入（7 级优先阶梯、硬约束）

## 存在理由 (Why it exists)

规范是 MumuSpec 的核心产物。spec 模块负责将 Markdown 格式的规范文件转化为
结构化数据，供 guard 模块检查、rules 模块生成规则文件。渐进式加载确保 AI 助手
只加载与当前目录相关的规范层，避免上下文过载。Ponytail 约束确保编码遵循
YAGNI 和最小实现原则。

## 用户场景 (User scenarios)

1. **上下文加载**：AI 助手在 `src/core/` 工作时，加载 Layer 0/1/2 的 spec 上下文
2. **规范校验**：`mumuspec validate` 检查所有 spec.md 格式和约束完整性
3. **Ponytail 注入**：init 时将 Ponytail 约束注入到根 spec.md
4. **继承检查**：子目录的 SHALL NOT 不能与父目录的 SHALL 冲突

## 验收标准 (Acceptance criteria)

- spec.md 解析支持 YAML frontmatter（layer、scope、last_updated）
- 渐进式加载最多支持 3 层（Layer 0 → 1 → 2）
- 规范校验检测 SHALL without Enforcement 违规
- 继承冲突检测识别子层放松父层约束的非法行为
- Ponytail 约束注入保留原有需求不丢失
- frontmatter 格式错误必须报错
- 不加载过期 spec（freshness check_on_load 必须执行）
