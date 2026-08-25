# Delta Spec: checker.ts AST Migration

## Requirement: JSX Detection Upgrade

### SHALL
- SHALL replace regex-based `detectJsxSyntax()` with AST-based `detectJsxUsage()`
- SHALL correctly distinguish JSX syntax from TypeScript generics
- SHALL exempt files using htm tagged template library (approved JSX alternative)
- SHALL skip string literal content when detecting JSX (no more false positives on `const html = '<div>'`)

### SHALL NOT
- SHALL NOT remove the function from public API (keep backward compat wrapper if needed)

## Requirement: Prohibition Check Upgrade

### SHALL
- SHALL route `ast:` prefixed constraints to LanguageProvider.checkConstraint()
- SHALL fall back to regex matching for legacy (non-prefixed) constraints
- SHALL collect AST violations with proper line/column info

---

# Delta Spec: contract/manager.ts AST Upgrade

## Requirement: Export Detection

### SHALL
- SHALL detect all export forms via AST:
  - `export function/class/const/type/interface`
  - `export default ...`
  - `export * from 'module'`
  - `export { x, y as z }`
  - `export = ...` (CommonJS)
- SHALL preserve existing BoundaryExport interface exactly
- SHALL deduplicate exports by name

### SHALL NOT
- SHALL NOT change BoundaryExport interface shape

## Requirement: Import Detection

### SHALL
- SHALL detect:
  - `import { x } from 'module'`
  - `import X from 'module'`
  - `import * as X from 'module'`
  - `import 'module'` (side-effect)
  - `await import('module')` (dynamic)
  - `require('module')` (CommonJS)
- SHALL extract module specifier value for each detected import
