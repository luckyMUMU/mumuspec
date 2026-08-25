# Design: ast-guard — 多语言可扩展 AST 引擎

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Guard Layer (src/guard/checker.ts)                         │
│  checkProhibitionViolation() → 路由选择                       │
├─────────────────────────────────────────────────────────────┤
│  Parser Router                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ regex    │  │ ast-ts   │  │ ast-js   │  │ ast-py   │   │
│  │ (default)│  │ (Compiler│  │ (Compiler│  │ (sub-    │   │
│  │          │  │  API)    │  │  API)    │  │  process)│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│  LanguageProviderRegistry                                   │
│  - register(provider)                                       │
│  - get(ext) → ILanguageProvider | null                      │
│  - list(): ProviderInfo[]                                   │
├─────────────────────────────────────────────────────────────┤
│  ILanguageProvider Interface                                │
│  - language, extensions                                     │
│  - parse(source, filename): ASTResult                       │
│  - checkConstraint(ast, constraint): ConstraintViolation[]  │
│  - formatMessage?(violation): string                        │
└─────────────────────────────────────────────────────────────┘
```

新增 AST 约束类型：
- `no-mutable-state` — 禁止 let 重新赋值
- `enforce-idempotent` — 函数不得有副作用
- `no-circular-imports`— 模块间不得循环依赖
- `design-pattern-compliance` — class 结构约束
- `async-completeness` — async/await 配对检测

## API Contracts

### ILanguageProvider 接口

```typescript
// src/core/types-constraint-ast.ts
export interface ASTResult {
  root: ASTNode;
  sourceFile: string;
  language: string;
  diagnostics: ASTDiagnostic[];
}

export interface ASTNode {
  kind: string;
  text: string;
  range: { start: number; end: number };
  children: ASTNode[];
}

export interface ConstraintViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning';
  location: { file: string; line: number; column: number };
  snippet: string;
}

export interface SemanticConstraint {
  type: string;
  params?: Record<string, unknown>;
}

export interface ILanguageProvider {
  readonly language: string;
  readonly extensions: string[];
  parse(source: string, filename: string): ASTResult;
  checkConstraint(ast: ASTResult, constraint: SemanticConstraint): ConstraintViolation[];
?(violation: ConstraintViolation): string;
}
```

### LanguageProviderRegistry API

```typescript
export function registerLanguageProvider(provider: ILanguageProvider): void;
export function unregisterLanguageProvider(language: string): boolean;
export function getLanguageProvider(ext: string): ILanguageProvider | null;
export function getAvailableProviders(): ProviderInfo[];
export function listSupportedExtensions(): string[];

export interface ProviderInfo {
  language: string;
  extensions: string[];
  registeredAt:;
}
```

### Parser 字段扩展

原: `parser: 'regex' | 'ast'`
新: `parser: 'regex' | 'ast-ts' | 'ast-js' | 'ast-py' | 'ast-java' | 'ast-go'`

## Data Flow

### Constraint 检测流程

```
1. 读取 constraint frontmatter → 获取 parser 字段
2. 若 parser 以 'ast-' 开头 → 提取语言标识 ('ts' | 'py' | ...)
3. 根据文件扩展名查找 Provider
4. Provider.parse(source, filename) → ASTResult
5. Provider.checkConstraint(ast, constraint) → ConstraintViolation[]
6. 格式化为 GuardError 返回
7. 若 Provider 不存在或 parse 失败 → fallback 到 regex
```

### 扩展新语言流程

```
1. 实现 ILanguageProvider 接口
2. 调用 registerLanguageProvider(new MyProvider())
3. Guard 自动路由到该 Provider
4. 无需修改 checker.ts 核心逻辑
```

## Error Specification

| 场景 | 行为 | 返回 |
|------|------|------|
| Provider 存在且 parse 成功 | 使用 AST 检测 | AST 约束违规列表 |
| Provider 不存在 | 回退到 regex | regex 匹配结果 |
| Provider.parse() 抛异常 | 降级到 regex + 日志告警 | regex 匹配结果 + warning |
| 文件扩展名无对应 Provider | 使用 regex | regex 匹配结果 |
| 不支持的 parser 字段值 | 报错 E-GUARD-AST-001 | "不支持的 AST parser: X" |

## Constraints Analysis

### SHALL
- SHALL: Provider Registry 支持运行时动态注册/卸载
- SHALL: 至少实现 TypeScriptProvider 和 JavaScriptProvider
- SHALL: AST 失败时自动降级到 regex（不中断 Guard 流程）
- SHALL: 所有 parser 字段值通过 validate 接受
- SHALL: 第三方 Provider 错误隔离（单个 Provider 失败不影响其他）
- SHALL: 文档包含如何扩展新语言 Provider

### SHALL NOT
- SHALL NOT 删除 regex 引擎（结构性约束仍用 regex）
- SHALL NOT 引入 tree-sitter 作为初始依赖（保持轻量）
- SHALL NOT 强制所有语言立即实现（Provider 为可选扩展）
- SHALL NOT 修改 constraint_strength 的评估逻辑

### Performance
- Provider 注册表使用 Map 缓存，查找 O(1)
- AST 解析结果按文件缓存（同一文件不重复 parse）
- 懒加载：Provider 在首次使用时才初始化

## Risk Mitigation

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| TS Compiler API 解析失败 | 中 | 中 | fallback 到 regex + 日志告警 |
| Provider 注册表线程不安全 | 低 | 低 | Node.js 单线程无此问题 |
| 第三方 Provider 崩溃影响主流程 | 中 | 中 | Provider 调用 try-catch 隔离 |
| 性能下降（初版） | 中 | 低 | AST 缓存 + 懒加载 |
| 语义约束误报 | 中 | 高 | 保守阈值 + warn 级别先行 |

## Test Strategy

### 单元测试 (tests/guard/ast-engine.test.ts)

| ID | 用例 | 验证 |
|----|------|------|
| TC-01 | TypeScriptProvider.parse() 解析 TS 源码 | 返回有效 ASTResult |
| TC-02 | TSProvider.checkConstraint no-mutable-state | 检测 let 重新赋值 |
| TC-03 | TSProvider.checkConstraint enforce-idempotent | 检测函数副作用 |
| TC-04 | TSProvider.checkConstraint no-circular-imports | 检测 import 环 |
| TC-05 | JavaScriptProvider 路由正确 | .js 文件 → JSProvider |

### 单元测试 (tests/guard/language-provider.test.ts)

| ID | 用例 | 验证 |
|----|------|------|
| TC-06 | registerLanguageProvider() 注册 | Provider 添加到注册表 |
| TC-07 | getLanguageProvider('.ts') | 返回 TypeScriptProvider |
| TC-08 | getLanguageProvider('.unknown') | 返回 null |
| TC-09 | unregisterLanguageProvider() | 从注册表移除 |
| TC-10 | listProviders() | 返回所有已注册 Provider |
| TC-11 | 不支持的 parser 字段值 | validate 报错 |

### 集成测试

- AST 约束检测端到端 → 给定 TS 源码文件，约束正确触发
- fallback 机制 → Provider parse 失败时 regex 生效

### 测试覆盖目标: ≥ 12 个测试用例

## Implementation Layers

| Layer | 模块 | 依赖 | 顺序 |
|-------|------|------|------|
| 1 (叶) | `src/core/types-constraint-ast.ts` (类型定义) | 无 | 1 |
| 2 | `src/guard/language-provider-registry.ts` (注册表) | Layer 1 | 2 |
| 3 | `src/guard/providers/typescript-provider.ts` (TS Provider) | Layer 1, 2 | 3 |
| 4 | `src/guard/providers/javascript-provider.ts` (JS Provider) | Layer 3 | 3 |
| 5 (根) | `src/guard/checker.ts` (路由升级) | Layer 2, 3, 4 | 4 |
| 6 | Tests | Layer 5 | 5 |

自底向上实现：1 → 2 → 3+4 (并行) → 5 → 6