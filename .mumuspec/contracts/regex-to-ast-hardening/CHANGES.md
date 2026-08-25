# AST Migration Hardening Contract Change Record

**日期**: 2026-08-10
**变更名称**: regex-to-ast-hardening
**版本**: 0.19.0 → 0.20.0（建议）

---

## 变更摘要

对首次正则→AST 迁移（regex-to-ast-migration）的硬化处理：
- 移除所有正则回退路径（`checkRegexConstraints`、`findJsxLine`、通用正则违规检测）
- 增强 eval/Function 检测（别名、间接调用、globalThis）
- 合规文档补全（BOUNDARY.md 更新、契约审计记录）

---

## 对外契约变更清单

| 变更 | 类型 | 说明 | 影响 |
|------|------|------|------|
| `ast-checker.ts` 新建 | 模块 | 纯 AST 检测器（JsxDetectionResult/CodeViolation 导出） | 新增导出 |
| `ast-checker.ts detectJsxUsage` | API | 返回类型新增 `line?: number` 字段 | 向后兼容扩展 |
| `ast-checker.ts checkAstConstraints` | API | 替代 `checkCodeViolations`，纯 AST 无正则回退 | 调用方需适配 |
| `ast-checker.ts checkCodeViolations` | 删除 | 混合 AST+regex 的旧 API | breaking |
| `ast-checker.ts checkRegexConstraints` | 删除 | 纯正则回退函数 | breaking（仅内部调用） |
| `checker.ts` | 修改 | `findJsxLine` 删除，直接使用 `detectJsxUsage.line` | 内部实现 |
| `typescript` | 外部依赖 | 新增为 guard/contract 层依赖 | 需 npm install |

---

## 上游/下游依赖方

| 依赖方 | 方向 | 兼容性 |
|--------|------|--------|
| `src/guard/checker.ts` | 内部 | `detectJsxUsage` 接口扩展，调用方式不变 |
| `src/contract/ast-analyzer.ts` | 平级 | 无影响，各自独立 |
| `tests/guard/ast-checker.test.ts` | 测试 | AC-09/AC-10 重写，新增 AC-13~AC-18 |
| `tests/guard/checker-deep.test.ts` | 测试 | 验证新 AST 行号定位 |

---

## 风险与缓解

- **checkCodeViolations 删除**：生产代码中未使用（仅测试），无调用方断裂风险
- **typescript 作为外部依赖**：已在根 package.json 中列为依赖（tsx 和 TypeScript 编译需要），不增加新安装负担
- **`line` 字段为可选**：向后兼容，旧调用方无需修改

---

## 用户征询记录

- 2026-08-10 审查发现正则迁移不完整，用户指令创建新改进 loop 修复
