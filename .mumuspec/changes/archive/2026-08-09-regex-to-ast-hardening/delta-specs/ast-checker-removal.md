# Delta Spec: ast-checker.ts Hardening

## Source: src/guard/ast-checker.ts

### Removed Exports
- `checkCodeViolations(content, filePath, prohibitions)` — was hybrid AST+regex

### Modified Exports
- `detectJsxUsage(content, filename)` — now returns `line?: number` in JsxDetectionResult
- `usesHtmLibrary(content)` — now shares AST parse with detectJsxUsage

### Internal Removals
- `checkRegexConstraints()` — REMOVED (was the regex fallback)
- `escapeRegExp()` — REMOVED (no longer needed)
- `checkAstConstraints()` — REWRITTEN to return violations with line info directly
- `findEvalUsage()` — ENHANCED to detect aliases
- `findNewFunction()` — ENHANCED to detect aliases

### Internal Additions
- `findFirstJsxLine(sourceFile)` — returns line number from AST, no regex
- `walkForHtmAndJsx(node)` — single-pass detection of both htm and JSX

### Contract Impact
- `JsxDetectionResult` interface extended with optional `line: number` field
- `CodeViolation` interface now requires `source: string` (constraint id)
- `checkCodeViolations` removed → callers must use AST-only routing
