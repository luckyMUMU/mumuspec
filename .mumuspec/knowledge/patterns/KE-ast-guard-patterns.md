---
id: KE-ast-guard-patterns
title: Architecture patterns from ast-guard
type: pattern
status: confirmed
scope: ast-guard
created_at: 2026-08-09
tags:
  - auto-extracted
  - pattern
  - architecture
  - ast-guard
graph_bindings: []
---
> Auto-extracted from ast-guard/design.md

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
  children: 