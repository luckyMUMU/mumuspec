---
scope: scripts
layer: 1
---
# Product Requirements: scripts

## 模块职责
scripts 目录是 MumuSpec 的构建与维护工具脚本集合。
它提供 prebuild 检查、enforcement 规则扫描、prerelease 版本号递增、
继承冲突调试与修复等自动化脚本，保障构建质量与规范一致性。

## 存在理由
MumuSpec 的规范体系要求代码与版本号严格一致、约束规则可执行校验。
手动检查容易遗漏，CI 集成需要可执行的脚本。scripts 目录将这些检查自动化：
prebuild 在 tsc 前阻断错误构建，enforcement-check 扫描 Ponytail 与结构规则，
bump-prerelease 管理语义化版本的预发布标签递增。

## 用户场景
1. **构建前检查**：npm run prebuild 触发 prebuild-check.mjs，校验版本一致性与文件完整性
2. **规范扫描**：node scripts/enforcement-check.mjs 扫描 PONYTAIL-1~4、STRUCT-1~2、CHANGE-3、ENV-3
3. **发布预发布版**：node scripts/bump-prerelease.mjs alpha 递增 alpha 标签
4. **调试继承冲突**：node scripts/debug-inheritance.mjs 排查 SHALL/SHALL NOT 冲突检测逻辑
5. **修复继承逻辑**：node scripts/fix-inheritance.mjs 修复极性检查 bug

## 验收标准
- prebuild-check.mjs 校验 SemVer 有效性、CLI 版本与 package.json 一致性、files[] 与 bin 源文件存在
- enforcement-check.mjs 支持 --strict 模式（CI 中 warning 视为 error）
- bump-prerelease.mjs 支持 alpha/beta/rc 三种标签，同标签递增、切换标签归零
- 所有脚本仅使用 Node.js 内置模块（node:fs、node:path、node:url），零外部依赖
- 脚本退出码：0 = 成功，1 = 失败
