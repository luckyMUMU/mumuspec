---
scope: tests
layer: 1
---
# Product Requirements: tests

## 模块职责
tests 目录是 MumuSpec 的测试套件集合，使用 Vitest 框架验证各模块的正确性。
它覆盖 spec 解析、CLI 端到端、约束强度系统、状态机、继承冲突、Ponytail 约束、
版本管理、环境检测等核心功能，确保规范与实现一致。

## 存在理由
MumuSpec 的规范驱动开发要求"测试即契约"——测试用例在 Design 阶段锁定后不可变更。
tests 目录通过单元测试验证每个模块的输入输出符合规范定义，通过端到端测试验证
CLI 命令的完整流程。测试是漂移检测的第一道防线：实现偏离规范时测试失败。

## 用户场景
1. **开发者运行测试**：npm test 执行全部测试，验证代码变更未破坏现有功能
2. **CI 集成**：CI pipeline 运行 npm test，失败时阻断合并
3. **验证解析逻辑**：parser.test.ts 验证 spec.md 的 frontmatter 解析与 requirement 提取
4. **验证 CLI 流程**：cli.test.ts 执行端到端测试（init → validate → check）
5. **验证约束系统**：constraint-strength.test.ts 验证 resolveConstraintTree 与 evaluateConstraint
6. **验证状态机**：state-machine.test.ts 验证五阶段流转与回退逻辑
7. **验证继承冲突**：inheritance.test.ts 验证 SHALL/SHALL NOT 极性冲突检测

## 验收标准
- parser.test.ts 覆盖 spec.md 解析（valid/invalid frontmatter、多 requirement、序列化）
- cli.test.ts 覆盖 CLI 端到端（--version、--help、init、validate）
- constraint-strength.test.ts 覆盖 resolveConstraintTree + evaluateConstraint + loadConstraintsFile
- state-machine.test.ts 覆盖五阶段正向流转与回退路径
- ponytail.test.ts 覆盖 7 级优先阶梯约束注入与标记解析
- version-bump.test.ts 覆盖版本号递增逻辑
- 所有测试使用 Vitest（describe/it/expect），临时目录使用 mkdtempSync 隔离
