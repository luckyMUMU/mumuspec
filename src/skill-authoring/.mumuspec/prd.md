---
scope: src/skill-authoring
layer: 2
---

# Product Requirements: skill-authoring

## 模块职责 (What this module does)

技能创作协议模块，提供技能验证和脚手架生成能力。

- `validateSkill()` — 验证技能是否符合 AUTHORING_PROTOCOL schema
- `scaffoldSkill()` — 生成技能脚手架文件结构
- `listCustomSkills()` — 列出项目中的自定义技能
- `AUTHORING_PROTOCOL` — 创作协议常量（version、schema、subagents、templates）

## 存在理由 (Why it exists)

MumuSpec 技能需要遵循统一的创作协议，确保技能结构一致、可验证、可发现。
skill-authoring 模块定义了协议规范并提供验证工具，让技能作者在创建技能时
有标准可循，同时支持脚手架快速生成。

## 用户场景 (User scenarios)

1. **创建技能**：`mumuspec skill scaffold <name>` 生成技能脚手架
2. **验证技能**：`mumuspec skill validate <name>` 检查技能结构合规性
3. **列出技能**：`mumuspec skill list` 查看项目中的自定义技能
4. **协议参考**：代码中引用 AUTHORING_PROTOCOL 获取协议定义

## 验收标准 (Acceptance criteria)

- 提供技能验证功能（validateSkill）
- 提供技能脚手架生成（scaffoldSkill）
- 创作协议包含 version、schema、subagents、templates 字段
- 无外部 npm 依赖
- 不创建不符合 AUTHORING_PROTOCOL 的技能
