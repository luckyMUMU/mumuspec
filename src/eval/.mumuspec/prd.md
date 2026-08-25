---
scope: src/eval
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: eval

## 模块职责 (What this module does)

评估场景运行器，加载 YAML 场景文件并执行自动化验证。

- `loadScenario()` — 解析 YAML 场景文件为 EvalScenario 结构
- `runScenario()` — 执行单个场景（compliance/drift/phase-guard/custom）
- `runEvalSuite()` — 批量运行多个场景，生成 EvalReport
- 支持断言表达式动态求值与期望结果验证

## 存在理由 (Why it exists)

MumuSpec 自身的合规检查、漂移检测和阶段门禁需要可重复的自动化验证。
eval 模块提供了场景化的测试框架，让开发者可以编写 YAML 场景文件来验证
MumuSpec 的 guard 层行为是否符合预期。

## 用户场景 (User scenarios)

1. **回归测试**：修改 guard 逻辑后，运行 eval 场景验证未破坏现有行为
2. **场景定义**：开发者编写 YAML 场景文件，定义 compliance/drift/phase-guard 测试
3. **断言验证**：场景中定义 expected.minErrors/maxErrors，自动断言结果范围
4. **自定义表达式**：通过 assertions 字段编写 JS 表达式进行复杂断言

## 验收标准 (Acceptance criteria)

- 支持 compliance、drift、phase-guard、custom 四种场景类型
- 场景文件使用 YAML 格式，包含 name 和 type 必需字段
- 断言表达式安全执行，不执行未经验证的代码
- EvalReport 包含 total/passed/failed 计数和每个场景的详情
- 每个场景记录执行耗时（duration）
