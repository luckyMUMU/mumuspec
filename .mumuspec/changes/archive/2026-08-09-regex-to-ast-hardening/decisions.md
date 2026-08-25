# Decision Log: regex-to-ast-hardening

## 2026-08-10

### 决策 1: 完全移除 checkRegexConstraints

**背景**: 初次迁移保留了正则回退系统，试图兼容所有约束类型

**决策**: 彻底移除 regex 路径，纯 AST 约束检查

**理由**:
- 正则回退使"迁移"名不副实
- 双系统增加维护负担
- 现有调用方（checker.ts）仅在 JSX 约束使用 AST，其他约束仍走正则

**影响**: 违反预期的 fallback 行为被移除，调用方必须使用 AST 约束

---

### 决策 2: eval 检测覆盖别名和间接调用

**背景**: 原实现仅检测直接 `eval('...')` 和 `new Function('...')` 调用

**决策**: 通过变量赋值跟踪实现别名检测

**检测模式**:
- 直接调用: `eval('x')`
- 成员访问: `globalThis.eval('x')`, `window.eval('x')`
- 间接调用: `(0, eval)('x')` — 穿透 ParenthesizedExpression + BinaryExpression(Comma)
- 别名: `const e = eval; e('x')`

**理由**: 安全约束必须覆盖隐蔽的间接调用模式

---

### 决策 3: 单次 AST 遍历检测 htm + JSX

**背景**: `usesHtmLibrary` 和 `walkForJsx` 分别解析 AST，对同一内容解析两次

**决策**: 合并为 `walkForHtmAndJsx`，单次遍历同时收集 htm 和 JSX 信息

**理由**:
- 减少 IO 和解析开销（文件内容可能很大）
- 统一 ScriptKind = TSX，消除不一致

---

### 决策 4: detectJsxUsage 返回行号

**背景**: 原实现仅返回 boolean + reason，行号通过单独的 `findJsxLine` 正则获取

**决策**: 将行号直接包含在 `JsxDetectionResult.line` 中

**理由**:
- 消除第二次 JSX 扫描（正则）
- 行号直接从首个 JSX 节点的 AST 位置计算，准确

---

### 决策 5: ExportInfo 保留函数签名

**背景**: 初次迁移丢失了函数参数和返回类型信息

**决策**: `ExportInfo` 接口新增 `signature` 字段，通过 AST 节点提取

**格式示例**: `"(a: number, b: string) => boolean"`

**理由**:
- `scaffoldBoundary` 生成的 BOUNDARY.md 能显示完整签名
- 用户可直接从边界文档了解函数类型，无需查看源码
