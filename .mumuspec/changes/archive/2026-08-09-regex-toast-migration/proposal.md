# Proposal: regex-toast-migration (Regex → AST 大型迁移)

## Why

审查发现 Guard Layer 和 Contract Layer 中存在 **7 处关键正则实现**，它们在复杂代码场景下会产生误报或漏检：

| 位置 | 函数 | 问题 |
|------|------|------|
| `guard/checker.ts` | `detectJsxSyntax()` | 无法区分 JSX 与 TS 泛型、字符串中的 HTML |
| `guard/checker.ts` | `stripStringLiterals()` | 不处理模板字符串，导致误判 |
| `guard/checker.ts` | `usesHtmTemplate()` | 仅匹配 `htm\`` 模式，变量名为 htm 时误判 |
| `guard/checker.ts` | `checkProhibitionViolation()` | 正则模式匹配无法理解代码语义 |
| `guard/checker.ts` | `checkFileCoexistence()` | `\w+\.md` 不匹配含连字符文件名 |
| `contract/manager.ts` | `detectExports()` | 无法覆盖 `export * from`、`export =`、默认导出变体 |
| `contract/manager.ts` | `detectImports()` | 遗漏 namespace import、dynamic import |

基础设施（`ILanguageProvider`、`LanguageProviderRegistry`、`typescript-provider.ts`）已在 `ast-guard` 变更中完成，但未全面接入核心检测流程。

## What

**目标**：将所有代码结构性检测从正则迁移到 TypeScript Compiler API (AST-based)。

**迁移范围（3 个文件，7 个函数）**：

1. **`src/guard/checker.ts`**：
   - `detectJsxSyntax()` → 使用 `ts.createSourceFile` + 节点类型判断
   - `stripStringLiterals()` → 使用 AST 遍历替代字符串处理
   - `usesHtmTemplate()` → 基于 AST 的 CallExpression + TaggedTemplate 判断
   - `checkFileCoexistence()` → 改进正则连字符支持
   - `checkProhibitionViolation()` → AST provider 路由

2. **`src/contract/manager.ts`**：
   - `detectExports()` → AST-based 全覆盖导出检测
   - `detectImports()` → AST-based 全覆盖导入检测

3. **新增文件**：
   - `src/guard/ast-checker.ts` — 新建模块，封装 AST-based 检测逻辑
   - `src/contract/ast-analyzer.ts` — 新建模块，封装 AST-based 代码分析

## Impact Scope

- 修改: `src/guard/checker.ts` (重构为路由层 + 简化)
- 修改: `src/contract/manager.ts` (使用新 AST 分析)
- 修改: `src/core/types-constraint-ast.ts` (扩展 Constraint 类型)
- 新增: `src/guard/ast-checker.ts` (AST 检测核心)
- 新增: `src/contract/ast-analyzer.ts` (AST 分析核心)
- 新增: `tests/guard/ast-checker.test.ts` (≥12 test cases)
- 新增: `tests/contract/ast-analyzer.test.ts` (≥8 test cases)
- 修改: `tests/guard/checker.test.ts` (更新 mock 适配新接口)

**向后兼容**：所有正则路径保留为 fallback，新增能力通过 AST provider 扩展。

## Workflow

full
