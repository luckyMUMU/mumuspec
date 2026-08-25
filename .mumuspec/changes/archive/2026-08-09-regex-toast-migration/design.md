# Design: regex-toast-migration — Regex → AST 大型迁移

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Caller (checker.ts / manager.ts)                               │
│  detectJsxSyntax() / detectExports() / detectImports()          │
│  checkProhibitionViolation() / checkFileCoexistence()           │
├─────────────────────────────────────────────────────────────────┤
│  New Module: src/guard/ast-checker.ts                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ isJsxFile(content, filename) → boolean                  │    │
│  │   - Parses with ts.createSourceFile                     │    │
│  │   - Checks for JSX node kinds in AST                    │    │
│  │   - Returns: hasGenericOnly / hasStringHtml / hasJsx    │    │
│  │                                                         │    │
│  │ usesHtmLibrary(content) → boolean                       │    │
│  │   - Looks for import declarations with module='htm'     │    │
│  │   - Checks for tagged template expressions              │    │
│  │                                                         │    │
│  │ checkProhibitionInCode(content, prohibitions, file)     │    │
│  │   - Routes ast: prefixed constraints to LanguageProvider│    │
│  │   - Falls back to regex for legacy constraints          │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  New Module: src/contract/ast-analyzer.ts                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ analyzeExports(dir) → BoundaryExport[]                  │    │
│  │   - Uses ts.createSourceFile per file                   │    │
│  │   - Handles: export function/class/const/type/interface │    │
│  │   - Handles: export default, export * from, export {x}  │    │
│  │   - Handles: export = (CommonJS)                        │    │
│  │                                                         │    │
│  │ analyzeImports(dir) → Set<string>                       │    │
│  │   - Handles: named imports, default imports             │    │
│  │   - Handles: namespace imports (* as X)                 │    │
│  │   - Handles: dynamic imports (import())                  │    │
│  │   - Handles: require() calls                            │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Reuses: ts.createSourceFile (typescript, already in devDeps)   │
│  Reuses: ILanguageProvider, LanguageProviderRegistry            │
└─────────────────────────────────────────────────────────────────┘
```

## API Contracts

### ast-checker.ts

```typescript
/** JSX detection result (as-built) */
export interface JsxDetectionResult {
  hasJsx: boolean;
  reason: 'jsx-node' | 'generic-only' | 'htm-template' | 'parse-error';
  details?: string;
}

/** Main entry: detect whether file uses JSX (not generic-only) */
export function detectJsxUsage(content: string, filename: string): JsxDetectionResult;

/** Check if file uses htm library as JSX alternative */
export function usesHtmLibrary(content: string): boolean;

/** Check prohibition violations with AST-aware routing */
export function checkCodeViolations(
  content: string,
  filePath: string,
  prohibitions: string[]
): Array<{ line: number; column: number; matched: string }>;
```

### ast-analyzer.ts

```typescript
/** Export detection using AST (replaces regex detectExports) */
export function analyzeExports(dirPath: string): BoundaryExport[];

/** Import detection using AST (replaces regex detectImports) */
export function analyzeImports(dirPath: string): Set<string>;

/** Internal: parse file with error handling */
function safeParseSource(filePath: string): ts.SourceFile | null;
```

### types-constraint-ast.ts Extension

```typescript
/** New constraint type for AST-based prohibition routing */
export interface AstConstraint {
  type: 'no-jsx' | 'no-eval' | 'no-new-function' | 'no-tsx-file';
  fileTypes?: string[];  // ['.ts', '.tsx'] etc.
}

/** Expand GuardConstraint union */
export type GuardConstraint = (SemanticConstraint | RegexConstraint | AstConstraint) & {
  parser?: 'regex' | 'ast-ts' | 'ast-js' | 'ast-ts-compiler';
};
```

## Data Flow

### JSX Detection Flow (new)

```
1. Read file content
2. ts.createSourceFile(filename, content, ScriptTarget.Latest, true)
3. Walk AST looking for:
   - JsxElement, JsxFragment, JsxSelfClosingElement → hasJsx=true
   - Only TypeReference/TypeParameter with `<T>` → hasJsx=false
4. If .tsx/.jsx extension AND no Jsx node → check if generic-only
5. Check for htm tagged template expressions (parent: CallExpression)
6. Return { hasJsx, reason, details }
```

### Export Detection Flow (new)

```
1. For each .ts/.js file in dir:
   a. ts.createSourceFile(filePath, content)
   b. Visit top-level statements:
      - ExportDeclaration:
        * clause: NamedExports → extract specifiers
        * clause: NamespaceExport → name
        * moduleSpecifier → re-export from
      - ExportAssignment (export default / export =)
      - SyntaxList with modifiers: [ExportKeyword] → declaration name
   c. Collect into BoundaryExport[] with kind metadata
2. Deduplicate by name (same name from multiple files → keep first)
3. Return sorted BoundaryExport[]
```

### Import Detection Flow (new)

```
1. For each .ts/.js file in dir:
   a. ts.createSourceFile(filePath, content)
   b. Visit:
      - ImportDeclaration → moduleSpecifier value
      - CallExpression with `import` identifier → dynamic import arg
      - CallExpression with `require` identifier → require arg
      - ExportDeclaration with moduleSpecifier → re-export source
   c. Add to Set<string>
2. Return Set
```

## Error Specification

| Scenario | Behavior | Return |
|----------|----------|--------|
| File not readable | Log warning, skip | (empty result) |
| Parse error (malformed TS) | Log warning, skip file | (empty result) |
| .tsx file with no JSX nodes | Report reason: 'generic-only' | hasJsx: false |
| .tsx file with JSX nodes | Report reason: 'jsx-node' | hasJsx: true |
| htm template detected | Report reason: 'htm-template' | hasJsx: false |
| Unsupported file extension (.py, .java) | Skip (no TS parsing attempted) | (empty result) |

## Constraints Analysis

### SHALL
- SHALL: `detectJsxUsage` 正确区分 JSX 与 TS 泛型
- SHALL: `analyzeExports` 覆盖 `export * from 'x'` 和 `export = x`
- SHALL: `analyzeImports` 覆盖 dynamic import 和 require()
- SHALL: Parse 失败时静默跳过（不中断流程）
- SHALL: 保持现有 BoundaryExport 接口兼容
- SHALL: 所有新函数有 ≥90% 分支覆盖率

### SHALL NOT
- SHALL NOT 引入新外部依赖（使用已有 typescript)
- SHALL NOT 删除旧的 regex 函数（标记 deprecated 但保留）
- SHALL NOT 修改 ILanguageProvider 接口签名
- SHALL NOT 改变现有 API 的公共函数签名（在兼容前提下扩展）

### Performance
- 单个文件 parse 开销 < 5ms (typical < 1ms)
- 目录级分析保持 O(n) n=文件数
- 不引入缓存层（ponytail: 当前场景无需缓存）

## Test Strategy

### Unit Tests: tests/guard/ast-checker.test.ts (≥ 12 cases)

| ID | Test Case | Validates |
|----|-----------|-----------|
| AC-01 | detectJsxUsage with simple JSX return true | Basic JSX |
| AC-02 | detectJsxUsage with TS generics only returns false | Generics exclusion |
| AC-03 | detectJsxUsage with .tsx extension + no JSX → generic-only | File extension heuristic |
| AC-04 | detectJsxUsage with htm tagged template → htm-template | htm exemption |
| AC-05 | detectJsxUsage with JSX in string literal only | String literal not JSX |
| AC-06 | usesHtmLibrary detects `import htm from 'htm'` | Import detection |
| AC-07 | usesHtmLibrary detects `htm\`...\`` usage | Tagged template |
| AC-08 | usesHtmLibrary returns false for variable named htm | Variable not library |
| AC-09 | checkCodeViolations with ast: constraint + valid TS | AST routing works |
| AC-10 | checkCodeViolations with regex constraint fallback | Fallback works |
| AC-11 | checkCodeViolations with malformed TS content | Graceful handling |
| AC-12 | checkCodeViolations with empty prohibitions list | Empty input |

### Unit Tests: tests/contract/ast-analyzer.test.ts (≥ 8 cases)

| ID | Test Case | Validates |
|----|-----------|-----------|
| AA-01 | analyzeExports detects `export function foo()` | Function export |
| AA-02 | analyzeExports detects `export default function` | Default export |
| AA-03 | analyzeExports detects `export * from './bar'` | Star re-export |
| AA-04 | analyzeExports detects `export { x as y }` | Named re-export |
| AA-05 | analyzeExports detects `export const` | Const export |
| AA-06 | analyzeExports deduplicates same name | Deduplication |
| AA-07 | analyzeImports detects `import { x } from 'y'` | Named import |
| AA-08 | analyzeImports detects dynamic `import('x')` and `require('x')` | Dynamic require |

### Integration Tests (existing tests preserved)
- `tests/guard/checker.test.ts` 更新 mock 适配
- `tests/contract/manager-deep.test.ts` 新增 AST analyzer 集成

## Implementation Layers (Bottom-Up)

| Layer | Module | Depends On | Order |
|-------|--------|------------|-------|
| 1 (leaf) | `src/guard/ast-checker.ts` | typescript, types-constraint-ast | 1 |
| 2 | `src/contract/ast-analyzer.ts` | typescript, types-contract | 1 |
| 3 | Tests (ast-checker.test.ts) | Layer 1 | 2 |
| 4 | Tests (ast-analyzer.test.ts) | Layer 2 | 2 |
| 5 (root) | `src/guard/checker.ts` integration | Layer 1, 3 | 3 |
| 6 | `src/contract/manager.ts` integration | Layer 2, 4 | 3 |

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| TS Compiler API parse failure on exotic syntax | Low | Medium | try-catch per file, skip on failure |
| Performance regression on large directories | Low | Low | Sync I/O pattern matches existing code |
| BoundaryExport interface change breaks callers | Low | High | Keep interface 100% compatible |
| Test snapshot mismatch after refactor | Medium | Low | Update tests in same PR |

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| Use `ts.createSourceFile` (not parser) | Sync parsing, no program needed, lighter weight |
| Keep old regex functions as deprecated | Backward compat for external callers |
| New files vs inline in checker.ts | Separation of concerns, testability |
| No caching layer | Existing code is sync, caching would add complexity |
