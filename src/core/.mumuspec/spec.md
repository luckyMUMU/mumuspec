---
layer: 2
scope: "src/core"
last_updated: "2026-08-01"
---

## Requirement: Environment Detector Module Standards

### SHALL
- env-detector.ts MUST 使用并行检测（Promise.all）以在 2 秒内完成全量检测
- 单项工具检测 MUST 有 1 秒超时保护
- 检测命令 MUST 仅执行只读操作（`--version`、`which`、`echo`）
- 检测结果 MUST 过滤敏感环境变量（password/secret/token/key）
- 工具未安装时 MUST NOT 阻断整体检测流程
- DETECTOR_CONFIGS MUST 包含 Java、Node、Python、Go、Rust 生态配置

### SHALL NOT
- env-detector MUST NOT 执行网络请求
- env-detector MUST NOT 修改任何系统配置或文件
- detectEnvironment MUST NOT 因单个工具检测失败而抛出异常

### Enforcement
- ENV-DET-1: 检测超时 <= 1000ms
- ENV-DET-2: 敏感变量过滤覆盖率 100%
- ENV-DET-3: 并行检测执行
