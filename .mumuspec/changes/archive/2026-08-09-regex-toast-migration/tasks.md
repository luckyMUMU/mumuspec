# Tasks: regex-toast-migration (R-0003 延续)

## 测试用例 (Locked — Design Phase Output)

| ID | 测试用例 | 类型 | 模块 |
|----|---------|------|------|
| AC-01 | detectJsxUsage 简单 JSX 返回 true | 单元 | ast-checker |
| AC-02 | detectJsxUsage 仅 TS 泛型返回 false | 单元 | ast-checker |
| AC-03 | detectJsxUsage .tsx + 无 JSX → generic-only | 单元 | ast-checker |
| AC-04 | detectJsxUsage htm 模板 → htm-template | 单元 | ast-checker |
| AC-05 | detectJsxUsage 字符串中 HTML 不误判 | 单元 | ast-checker |
| AC-06 | usesHtmLibrary 检测 import htm | 单元 | ast-checker |
| AC-07 | usesHtmLibrary 检测 htm`` 使用 | 单元 | ast-checker |
| AC-08 | usesHtmLibrary htm 变量名不误判 | 单元 | ast-checker |
| AC-09 | checkCodeViolations ast: 约束路由 | 单元 | ast-checker |
| AC-10 | checkCodeViolations regex fallback | 单元 | ast-checker |
| AC-11 | checkCodeViolations 畸形 TS 处理 | 单元 | ast-checker |
| AC-12 | checkCodeViolations 空 prohibitions | 单元 | ast-checker |
| AA-01 | analyzeExports 检测 export function | 单元 | ast-analyzer |
| AA-02 | analyzeExports 检测 export default | 单元 | ast-analyzer |
| AA-03 | analyzeExports 检测 export * from | 单元 | ast-analyzer |
| AA-04 | analyzeExports 检测 export { x as y } | 单元 | ast-analyzer |
| AA-05 | analyzeExports 检测 export const | 单元 | ast-analyzer |
| AA-06 | analyzeExports 同名去重 | 单元 | ast-analyzer |
| AA-07 | analyzeImports 检测 import { x } | 单元 | ast-analyzer |
| AA-08 | analyzeImports 检测 import() 和 require() | 单元 | ast-analyzer |

## 实现任务

### Phase 1: 新模块创建 (叶层)

- [ ] **T-001**: 新建 `src/guard/ast-checker.ts`
  - `detectJsxUsage(content, filename): JsxDetectionResult`
  - `usesHtmLibrary(content): boolean`
  - `checkCodeViolations(content, filePath, prohibitions): CodeViolation[]`
  - 导出类型: `JsxDetectionResult`, `CodeViolation`

- [ ] **T-002**: 新建 `src/contract/ast-analyzer.ts`
  - `analyzeExports(dirPath): BoundaryExport[]`
  - `analyzeImports(dirPath): Set<string>`
  - 完全兼容现有 BoundaryExport 接口

### Phase 2: 测试编写 (TDD Red — 先写测试)

- [ ] **T-010**: 编写 `tests/guard/ast-checker.test.ts` (AC-01 到 AC-12)

- [ ] **T-011**: 编写 `tests/contract/ast-analyzer.test.ts` (AA-01 到 AA-08)

### Phase 3: 集成到现有模块 (根层)

- [ ] **T-020**: 修改 `src/guard/checker.ts`
  - `detectJsxSyntax()` → 调用 `detectJsxUsage()`
  - `usesHtmTemplate()` → 调用 `usesHtmLibrary()`
  - 原函数标记 `@deprecated`
  - `checkProhibitionViolation()` 增加 AST 路由分支

- [ ] **T-021**: 修改 `src/contract/manager.ts`
  - `scaffoldBoundary()` 改用 `analyzeExports()`
  - `detectImports()` 改用 `analyzeImports()`
  - 原函数标记 `@deprecated`

### Phase 4: 验证 & 清理

- [ ] **T-030**: 运行全量测试 `npm test`
- [ ] **T-031**: 运行 lint `npm run lint`
- [ ] **T-032**: 归档变更

---

> **Ponytail Notes**:
> - 新模块保持纯函数风格（无副作用、无 I/O）
> - 文件 I/O 在调用方管理（checker.ts / manager.ts）
> - AST 缓存暂不引入（后续按需添加）
