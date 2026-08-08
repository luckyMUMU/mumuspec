---
scope: src/skill-authoring
layer: 2
---

# Boundary Document: skill-authoring

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `validateSkill` | `(root, skillName) => SkillValidationResult` | protocol.ts | 验证技能目录结构 |
| `listCustomSkills` | `(root) => { name, path, valid }[]` | protocol.ts | 列出工作区自定义技能 |
| `scaffoldSkill` | `(root, name, options?) => SkillScaffoldResult` | protocol.ts | 搭建技能骨架 |
| `generateAuthoringProtocol` | `(root) => { path, created }` | protocol.ts | 生成协议文档 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `SkillValidationResult` | 技能验证结果 |
| `SkillScaffoldResult` | 技能骨架生成结果 |

### 导出常量

| 常量 | 用途 |
|------|------|
| `AUTHORING_PROTOCOL` | 技能编写协议定义（YAML 字符串） |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读写 |
| `node:path` | 路径处理 |
| `../core/utils.js` | 工具函数 |

### 外部依赖

无（仅 Node.js 标准库）

## 数据契约

### 输入

- 项目根路径
- 技能名称
- 生成选项

### 输出

- 技能目录骨架：`skills/{name}/SKILL.md`
- 验证结果（errors, warnings）

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 初始创建边界文档 | 新目录边界定义 |
