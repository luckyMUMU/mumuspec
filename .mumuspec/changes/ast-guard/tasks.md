# Tasks: ast-guard (R-0003)

## 测试用例（Locked）

| ID | 测试用例 | 类型 |
|----|---------|------|
| TC-01 | TSProvider.parse() 返回有效 ASTResult | 单元 |
| TC-02 | TSProvider.checkConstraint no-mutable-state | 单元 |
| TC-03 | TSProvider.checkConstraint enforce-idempotent | 单元 |
| TC-04 | TSProvider.checkConstraint no-circular-imports | 单元 |
| TC-05 | JavaScriptProvider .js 路由 | 单元 |
| TC-06 | registerLanguageProvider() 注册 | 单元 |
| TC-07 | getLanguageProvider('.ts') | 单元 |
| TC-08 | getLanguageProvider('.unknown') null | 单元 |
| TC-09 | unregisterLanguageProvider() 移除 | 单元 |
| TC-10 | listProviders() 返回列表 | 单元 |
| TC-11 | 不支持的 parser 字段值报错 | 单元 |
| TC-12 | AST parse 失败 fallback regex | 集成 |

## 实现任务

### Phase 1: 类型与注册表

- [ ] **T-001**: 新建 `src/core/types-constraint-ast.ts` — ILanguageProvider + ASTResult + SemanticConstraint 类型
- [ ] **T-002**: 新建 `src/guard/language-provider-registry.ts` — Provider 注册中心 + 公共 API

### Phase 2: Providers

- [ ] **T-010**: 新建 `src/guard/providers/typescript-provider.ts` — TS Compiler API Provider
  - parse() 使用 ts.createSourceFile
  - checkConstraint() 实现: no-mutable-state, enforce-idempotent, no-circular-imports
- [ ] **T-011**: 新建 `src/guard/providers/javascript-provider.ts` — JS Provider（复用 TS）

### Phase 3: 路由升级

- [ ] **T-020**: 修改 `src/guard/checker.ts`:
  - 新增 parser 路由逻辑
  - AST 失败 fallback 到 regex
  - parser 字段格式支持 'ast-ts', 'ast-js' 等
- [ ] **T-021**: 修改 constraint frontmatter schema — parser 字段扩展

### Phase 4: 测试

- [ ] **T-030**: 编写 `tests/guard/ast-engine.test.ts` (TC-01 到 TC-05)
- [ ] **T-031**: 编写 `tests/guard/language-provider.test.ts` (TC-06 到 TC-11)
- [ ] **T-032**: 集成测试 (TC-012)

### Phase 5: Guard + Archive

- [ ] **T-040**: 运行 guard + 修复问题 + 归档

---

> **Ponytail Notes**:
> - Provider 使用简单 Map（不引入 DI 容器）
> - AST 缓存用 WeakMap（不引入复杂缓存层）
> - Provider 隔离用 try-catch（不引入子进程沙箱）
