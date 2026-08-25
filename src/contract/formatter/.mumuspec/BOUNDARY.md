# Boundary: src/contract/formatter

## 对外接口

```typescript
// — sarif.ts —
export interface SarifLog { version: '2.1.0'; $schema: string; runs: SarifRun[]; }
export function toSarif(report: DriftReport): SarifLog;
export function toSarifString(report: DriftReport): string;

// — problem-matcher.ts —
export interface ProblemMatcherEntry { file: string; line: number; column: number; severity: 'error' | 'warning' | 'info'; message: string; code?: string; }
export interface ProblemMatcherOutput { problems: ProblemMatcherEntry[]; summary: { total: number; errors: number; warnings: number; infos: number; } }
export function toProblemMatcher(report: DriftReport): ProblemMatcherOutput;
export function toProblemMatcherString(report: DriftReport): string;
```

## CLI 集成

通过 `src/cli/commands/contract.ts` 注册：
- `mumuspec contract drift --format sarif` → SARIF 2.1 输出
- `mumuspec contract drift --format problem-matcher` → VS Code Problem Matcher 输出

## 依赖声明

| 依赖 | 类型 |
|------|------|
| ../../core/types-contract.ts | 内部（DriftReport 类型） |

无外部依赖 — 纯计算模块，无 I/O。

## 数据契约

- **输入**：DriftReport（来自 contract/validator.ts）
- **输出**：SARIF 2.1 JSON / Problem Matcher JSON
- **Schema 校验**：.mumuspec/contracts/standard/drift-report-schema.json

## 变更日志

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026-08-09 | 初始实现 | R-0006 SARIF + Problem Matcher 适配器 |
