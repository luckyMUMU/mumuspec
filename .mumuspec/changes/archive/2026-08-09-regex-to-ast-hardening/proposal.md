# Proposal: regex-to-ast-hardening

## Why

初次正则→AST 迁移（regex-to-ast-migration）存在以下问题，导致迁移目标未完全达成：

1. **正则幸存**：`ast/checker.ts` 的 `checkRegexConstraints`、`findJsxLine` 正则定位、`checkProhibitionViolation` 通用违规检测仍保留正则路径
2. **合规性缺失**：`src/guard/.mumuspec/BOUNDARY.md` 和 `src/contract/.mumuspec/BOUNDARY.md` 均未更新；`.mumuspec/contracts/` 下无本次变更审计记录
3. **测试质量差**：AC-09/AC-10 仅验证"不抛出异常"而无法验证 AST 约束是否真正被检测
4. **覆盖盲区**：`findEvalUsage`/`findNewFunction` 遗漏间接调用（别名 eval、globalThis.eval、new Function 别名等）
5. **架构不一致**：`usesHtmLibrary` 与 `detectJsxUsage` 对同一内容解析两次 AST，且 ScriptKind 不一致

## What

1. **完全消除正则回退**：移除 `ast-checker.ts` 中的 `checkRegexConstraints`，纯 AST 约束不支持 regex 降级
2. **AST 行号定位**：`findJsxLine` 改用 AST 遍历返回首个 JSX 节点位置，不再依赖正则
3. **合规文档补全**：更新两处 BOUNDARY.md、创建 `.mumuspec/contracts/` 变更记录
4. **单元测试修复**：替换 AC-09/AC-10 假测试为真实 AST 断言，补充 `findEvalUsage`/`findNewFunction` 测试
5. **完善 eval/Function 检测**：覆盖间接 eval、别名函数、globalThis.eval 等变体
6. **统一解析策略**：合并 `usesHtmLibrary` + `detectJsxUsage` 为单次 AST 遍历，统一 ScriptKind = TSX
7. **签名保留**：`adaptExportInfo` 保留函数参数列表，`scaffoldBoundary` 生成的 BOUNDARY.md 包含完整签名

## Impact Scope

- `src/guard/ast-checker.ts` — 核心重构
- `src/guard/checker.ts` — JSX 行号定位重构
- `src/contract/ast-analyzer.ts` — ScriptKind 统一
- `src/contract/manager.ts` — adaptExportInfo 完善
- `src/guard/.mumuspec/BOUNDARY.md` — 文档更新
- `src/contract/.mumuspec/BOUNDARY.md` — 文档更新
- `.mumuspec/contracts/` — 审计记录
- 测试套件：`tests/guard/ast-checker.test.ts`、`tests/guard/checker-deep.test.ts`

## Workflow
full
