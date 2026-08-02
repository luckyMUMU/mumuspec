---
scope: scripts
layer: 1
---
# Technical Design: scripts

## SHALL
- 所有脚本使用 ESM 语法（import/export），文件扩展名 .mjs
- 所有脚本仅使用 Node.js 内置模块（node:fs、node:path、node:url），零外部依赖
- 脚本顶部必须包含 JSDoc 注释说明用途、用法与退出码
- 脚本退出码规范：0 = 成功，1 = 失败/校验错误
- enforcement-check.mjs 实现的规则必须与 .mumuspec/spec.md 的 Enforcement 条目对应

## SHALL NOT
- 禁止引入外部 npm 依赖（遵循零依赖偏好）
- 禁止脚本修改 src/ 源代码（fix-inheritance.mjs 除外，且需明确标注）
- 禁止跳过 prebuild 检查直接构建

## 架构决策
- **零外部依赖**：所有脚本仅用 Node.js 内置模块，避免安装时拉取额外依赖
- **ESM 模块**：使用 .mjs 扩展名，与项目 ESM 配置对齐
- **CI 友好**：enforcement-check 支持 --strict 模式，CI 中 warning 视为 error
- **规则对应**：enforcement-check 的每条规则对应 spec.md 中的 Enforcement 条目

## 依赖关系
- prebuild-check.mjs 读取 package.json、src/cli.ts、src/cli/index.ts
- enforcement-check.mjs 读取 .mumuspec/spec.md、src/ 源代码、package.json
- bump-prerelease.mjs 读写 package.json 的 version 字段
- debug-inheritance.mjs 引用 dist/spec/parser.js（构建产物）
- fix-inheritance.mjs 读写 src/spec/inheritance.ts
- 脚本通过 npm scripts 集成到 prebuild 钩子
