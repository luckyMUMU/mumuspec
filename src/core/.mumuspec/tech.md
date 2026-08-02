---
scope: src/core
layer: 2
---

# Technical Design: core

## SHALL constraints (migrated from spec.md)

- env-detector.ts MUST 使用并行检测（Promise.all）以在 2 秒内完成全量检测
- 单项工具检测 MUST 有 1 秒超时保护
- 检测命令 MUST 仅执行只读操作（`--version`、`which`、`echo`）
- 检测结果 MUST 过滤敏感环境变量（password/secret/token/key）
- 工具未安装时 MUST NOT 阻断整体检测流程
- DETECTOR_CONFIGS MUST 包含 Java、Node、Python、Go、Rust 生态配置

## SHALL NOT constraints (migrated from spec.md)

- env-detector MUST NOT 执行网络请求
- env-detector MUST NOT 修改任何系统配置或文件
- detectEnvironment MUST NOT 因单个工具检测失败而抛出异常

## Enforcement (migrated from spec.md)

- ENV-DET-1: 检测超时 <= 1000ms
- ENV-DET-2: 敏感变量过滤覆盖率 100%
- ENV-DET-3: 并行检测执行

## 架构决策 (Architecture decisions)

- **纯函数与 I/O 分离**：`constraint-evaluator.ts` 为纯函数（无 I/O），`constraints-loader.ts` 负责 I/O
- **约束强度二维模型**：technical_design（HOW）和 requirement_goals（WHAT）两个独立维度
- **强度求值顺序**：exception list → explicit override → dimension strength（§9.1）
- **敏感变量过滤**：使用正则模式列表（SENSITIVE_PATTERNS）匹配 password/secret/token/key 等
- **约束树分布式布局**：`.mumuspec/constraints.yaml` 可在任意目录层级存在，loader 遍历发现
- **SKIP_DIRS 优化**：加载时跳过 node_modules/.git/dist/build 等噪声目录

## 接口契约 (Interface contracts)

```typescript
// constraint-evaluator.ts
function evaluateConstraint(check: ConstraintCheck, config: ConstraintStrengthField): ConstraintEvalResult;

// constraints-loader.ts
function loadConstraintsFromTree(projectRoot: string, options?: LoadConstraintsOptions): ConstraintsFile[];

// env-detector.ts
function detectEnvironment(projectRoot: string): Promise<EnvironmentDetection>;

// project-analyzer.ts
function analyzeProject(projectRoot: string): ProjectAnalysis;
```

## 依赖关系 (Dependencies)

- **上游**：仅依赖 `node:` 内置模块和 `yaml` 包（env-detector 使用）
- **下游**：被所有其他 src/ 模块依赖——是整个系统的基石
- **关键消费者**：spec/loader.ts、change/manager.ts、guard/checker.ts、cli/index.ts
