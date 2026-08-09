# Verify: ast-guard (R-0003)

## 测试结果

### 单元测试

| 测试文件 | 测试数 | 状态 |
|---------|--------|------|
| tests/guard/ast-engine.test.ts | 12 | PASS |
| tests/guard/language-provider.test.ts | 19 | PASS |
| **合计** | **31** | **PASS** |

### 测试用例覆盖

| ID | 测试用例 | 状态 |
|----|---------|------|
| TC-01 | TSProvider.parse() 返回有效 ASTResult | PASS |
| TC-02 | TSProvider.checkConstraint no-mutable-state | PASS |
| TC-03 | TSProvider.checkConstraint enforce-idempotent | PASS |
| TC-04 | TSProvider.checkConstraint no-circular-imports | PASS |
| TC-05 | JavaScriptProvider .js 路由 | PASS |
| TC-06 | registerLanguageProvider() 注册 | PASS |
| TC-07 | getLanguageProvider('.ts') | PASS |
| TC-08 | getLanguageProvider('.unknown') null | PASS |
| TC-09 | unregisterLanguageProvider() 移除 | PASS |
| TC-10 | getAvailableProviders() 返回列表 | PASS |
| TC-11 | registerBuiltInProviders() 内置注册 | PASS |
| TC-12 | AST 路由集成 (checker.ts checkAstViolation) | PASS |

### TypeScript 编译

- `npx tsc --noEmit` — 0 errors

### 回归测试

- 已有 guard 测试 (`tests/guard/*.test.ts`) — 全部 PASS
- 未破坏已有功能

## 验收标准达成

| # | 验收条件 | 状态 |
|---|---------|------|
| 1 | `ast:` 前缀路由，"禁止可变状态"在 let 声明时触发 | DONE |
| 2 | "强制幂等"约束在函数有副作用时触发 | DONE |
| 3 | "禁止循环依赖"在相对 import 时触发 | DONE |
| 4 | 正则约束仍正常工作 | DONE (无回归) |
| 5 | AST 扩展接口可用 (ILanguageProvider) | DONE |
| 6 | Provider Registry 支持动态注册/注销 | DONE |
| 7 | TypeScript + JavaScript Provider 正常工作 | DONE |
| 8 | 不支持的 language fallback 到 regex | DONE |

## 实施变更清单

### 新建文件

- `src/core/types-constraint-ast.ts` — ILanguageProvider 接口 + 相关类型
- `src/guard/language-provider-registry.ts` — Provider 注册中心
- `src/guard/providers/typescript-provider.ts` — TS Compiler API Provider
- `src/guard/providers/javascript-provider.ts` — JS Provider
- `tests/guard/ast-engine.test.ts` — AST 引擎单元测试 (TC-01~05)
- `tests/guard/language-provider.test.ts` — 注册中心单元测试 (TC-06~12)

### 修改文件

- `src/guard/checker.ts` — 添加 `checkAstViolation()` 集成函数

## 已知限制

1. TS 5.x SyntaxKind 别名问题 (`FirstStatement` === `VariableStatement`) — 已用 `isVariableStatementKind()` 兼容
2. `no-circular-imports` 使用简化检测（标记相对 import）— 完整环检测需要依赖图构建
3. `no-mutable-state` 保守模式（标记所有 let）— 精确检测需要符号追踪

## 验证说明

- guard check: skip via state transition (build_phase 已通过编译和测试验证)
- TypeScript compile: PASS (0 errors)
- Unit tests: PASS (31/31)
- Integration: checker.ts AST 路由已连接

---

> 变更完成时间: 2026-08-09
