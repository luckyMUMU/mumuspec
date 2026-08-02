---
scope: src/eval
layer: 2
---

# Technical Design: eval

## SHALL constraints (migrated from spec.md)

- 必须支持 3 种场景类型：compliance、drift、phase-guard
- 场景文件必须使用 YAML 格式
- 断言必须支持 JS 表达式动态求值

## SHALL NOT constraints (migrated from spec.md)

- 禁止执行未经验证的断言表达式
- 禁止场景文件缺少 name 或 type 字段

## Enforcement (migrated from spec.md)

- EVAL-1: 检查场景文件格式正确
- EVAL-2: 检查断言表达式安全执行

## 架构决策 (Architecture decisions)

- **委托模式**：eval runner 委托 guard 模块执行实际检查（checkCompliance/detectDrift/runPhaseGuard）
- **行解析**：ponytail: 使用简单行解析而非引入完整 YAML 库，减少依赖
- **结果断言**：通过 expected 字段定义期望值范围（minErrors/maxErrors/mustContainErrorCodes）
- **自定义断言**：assertions 数组中的 JS 表达式在受控上下文中求值

## 接口契约 (Interface contracts)

```typescript
interface EvalScenario {
  name: string;
  type: 'compliance' | 'drift' | 'phase-guard' | 'custom';
  projectRoot?: string;
  changeName?: string;
  targetPhase?: string;
  expected?: { minErrors?: number; maxErrors?: number; mustContainErrorCodes?: string[] };
  assertions?: string[];
}

interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
  duration: number;
}

function loadScenario(filePath: string): EvalScenario;
```

## 依赖关系 (Dependencies)

- **上游**：`src/guard/checker.js`（compliance/drift 检查）、`src/guard/phase-guard.js`（phase-guard 检查）
- **跨模块**：`src/core/config.js`、`src/core/utils.js`
- **下游**：被 `src/cli/commands/eval.ts` 命令模块调用
