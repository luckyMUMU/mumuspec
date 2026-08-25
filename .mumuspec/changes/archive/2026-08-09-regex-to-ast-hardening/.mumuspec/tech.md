doc_type: tech

# Tech Spec: regex-to-ast-hardening

## 1. Overview

Harden the previous regex-to-ast migration by:
- Removing ALL regex fallback paths from the JSX/prohibition detection flow
- Updating directory boundary documents
- Completing contract audit trail
- Improving test coverage and edge case detection

## 2. Affected Files

| File | Change Type | Description |
|------|-------------|-------------|
| `src/guard/ast-checker.ts` | Remove | `checkRegexConstraints`, `escapeRegExp`, `checkCodeViolations` (regex portion) |
| `src/guard/ast-checker.ts` | Modify | Merge htm + JSX detection into single AST walk |
| `src/guard/ast-checker.ts` | Modify | `findEvalUsage` / `findNewFunction` cover aliases |
| `src/guard/ast-checker.ts` | Add | Return line numbers from walk instead of separate regex scan |
| `src/guard/checker.ts` | Modify | `findJsxLine` → AST-based line detection |
| `src/guard/checker.ts` | Simplify | `checkProhibitionViolation` removes regex branches |
| `src/contract/ast-analyzer.ts` | Modify | Force TSX ScriptKind for all content |
| `src/contract/ast-analyzer.ts` | Modify | Preserve function signatures in ExportInfo |
| `src/contract/manager.ts` | Modify | `adaptExportInfo` populate signature field |
| `tests/guard/ast-checker.test.ts` | Modify | Fix AC-09/AC-10, add AST evaluation tests |
| `tests/guard/ast-checker.test.ts` | Add | Tests for `findEvalUsage` / `findNewFunction` |
| `tests/guard/checker-deep.test.ts` | Modify | Add tests for AST-based line reporting |

## 3. API Changes

### 3.1 `ast-checker.ts` — Modified API

```typescript
// New: walkForJsx now returns line info, not just boolean
export function detectJsxUsage(content: string, filename: string): JsxDetectionResult;

// New: detect violations and return line/column info directly
export interface ViolationLocation {
  line: number;      // 1-based
  column: number;    // 0-based
  matched: string;   // violation description
  source: string;    // constraint id like 'ast:no-eval'
}

// Removed: checkCodeViolations (replaced with pure AST routing)
// Removed: checkRegexConstraints
// Removed: escapeRegExp
```

### 3.2 `ast-analyzer.ts` — Extended ExportInfo

```typescript
export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'type' | 'const' | 'interface';
  file?: string;
  signature?: string;  // NEW: function signature like "(a: number, b: string) => boolean"
}
```

### 3.3 `checker.ts` — Modified `JsxDetectionResult`

```typescript
// Updated: detectJsxUsage returns line number when hasJsx is true
export interface JsxDetectionResult {
  hasJsx: boolean;
  reason: 'jsx-node' | 'generic-only' | 'htm-template' | 'parse-error';
  details?: string;
  line?: number;        // NEW: 1-based line of first JSX node
}
```

## 4. Implementation Details

### 4.1 Single-Pass AST Walk (Performance)

Before: Two AST parses per file (one for htm, one for JSX)
After: One AST parse, simultaneous htm + JSX detection

```typescript
interface WalkResult {
  hasJsx: boolean;
  jsxLine?: number;
  hasHtm: boolean;
}

function walkForJsxAndHtm(node: ts.Node): WalkResult { ... }
```

### 4.2 Indirect Eval Detection

Detect:
- `eval('x')` — direct
- `globalThis.eval('x')` — member access
- `(0, eval)('x')` — indirect via comma operator
- `const e = eval; e('x')` — alias
- `window.eval('x')` — browser global

Strategy: Walk all CallExpressions; for identifier callees named `eval`/`Function`, check if binding is the global (no local declaration).

### 4.3 AST-Based Line Reporting for JSX

`findJsxLine` currently uses regex. Replace with:

```typescript
function findFirstJsxLine(sourceFile: ts.SourceFile): number | undefined {
  let result: number | undefined;
  function visit(node: ts.Node): void {
    if (result !== undefined) return;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) {
      result = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}
```

## 5. Test Strategy

### 5.1 Fixed Tests

| Test ID | Old Assertion | New AC |
|---------|---------------|--------|
| AC-09 | `Array.isArray(violations)` | `expect(violations.length).toBeGreaterThan(0)` + validate `eval` at line 1 |
| AC-10 | `Array.isArray(violations)` | `expect(violations.length).toBeGreaterThan(0)` + validate pattern match |

### 5.2 New Tests

| Test ID | Description |
|---------|-------------|
| AC-13 | `findEvalUsage` detects direct `eval()` call |
| AC-14 | `findEvalUsage` detects alias `const e = eval; e('x')` |
| AC-15 | `findNewFunction` detects `new Function('...')` |
| AC-16 | `detectJsxUsage` returns `line` for first JSX node |
| AC-17 | `detectJsxUsage` reports `reason: 'jsx-node'` + correct line for nested JSX |
| AC-18 | `usesHtmLibrary` + `detectJsxUsage` works in single pass |

### 5.3 Updated Tests

| Test ID | Change |
|---------|--------|
| checker-deep: `.jsx file extension` | Now verifies `.jsx` file is NOT flagged as violation when content has no JSX nodes (AST-based) |
| checker-deep: `JSX violation reporting` | Updated to verify line number comes from AST, not regex |

## 6. Compliance Checklist

- [ ] `src/guard/.mumuspec/BOUNDARY.md` — add ast-checker exports, update typescript dependency
- [ ] `src/contract/.mumuspec/BOUNDARY.md` — add ast-analyzer exports, ExportInfo signature
- [ ] `.mumuspec/contracts/audit-log.jsonl` — append change record
- [ ] `regex-toast-migration` delta-spec updated (or new delta-spec in this change) for contract drift traceability

## 7. Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Existing tests depend on regex fallback behavior | Tests reviewed and updated before code change |
| AST parsing slower than regex for simple patterns | Benchmark: typical files < 100ms, acceptable for CI workflow |
| Signature extraction may fail for complex TS types | Graceful fallback to `signature: undefined` with warning |

## 8. Acceptance Criteria

1. Zero regex patterns in `src/guard/ast-checker.ts`
2. Zero regex patterns in `src/guard/checker.ts` related to JSX detection
3. ALL tests pass: `tests/guard/ast-checker.test.ts` (expanded), `tests/guard/checker-deep.test.ts`
4. `mumuspec check` passes for both `guard` and `contract` directories
5. Contract audit trail created in `.mumuspec/contracts/`
6. `detectJsxUsage` returns accurate line number matching actual JSX location
