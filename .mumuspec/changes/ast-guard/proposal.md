# Proposal: ast-guard

## Why

当前 Guard Layer 的 `checkProhibitionViolation()` 基于正则匹配，无法检测语义级约束（可变状态、幂等性、循环依赖等）。需要引入 AST 分析能力提升检测深度。

## What

构建多语言可扩展的 AST 引擎：
1. `ILanguageProvider` 接口 + `LanguageProviderRegistry` 注册中心
2. TypeScript Provider（基于 Compiler API）
3. JavaScript Provider（复用 TS Provider）
4. 预留 Python/Java/Go 扩展点
5. 升级 `parser` 字段为 `ast-ts | ast-py | ast-java | ast-go`
6. 迁移 5-8 条高频语义约束

新增 AST 检测能力：
- 禁止可变状态（let 重新赋值）
- 强制幂等（函数副作用检测）
- 禁止循环依赖（import 环检测）
- 设计模式合规性
- 异步操作完整性

## Impact Scope

- 修改: `src/guard/ast-engine.ts` (重构为多语言引擎)
- 修改: `src/guard/checker.ts` (路由升级 + parser 字段增强)
- 新增: `src/core/types-constraint-ast.ts` (AST 约束类型)
- 测试: `tests/guard/ast-engine.test.ts`, `tests/guard/language-provider.test.ts`

## Workflow

full
