---
scope: src/contract/formatter
layer: 3
---

# Product Requirements: contract/formatter

## 模块职责 (What this module does)

契约报告格式化模块，将 DriftReport 转换为标准化的机器可读输出格式。

- **sarif.ts** — SARIF 2.1.0 格式输出（toSarif / toSarifString），供 IDE 与 CI 平台消费
- 其他格式化器（按 BOUNDARY.md 声明的对外接口演进）

## 存在理由 (Why it exists)

将"报告数据"与"展示格式"分离：核心 drift 检测（src/contract）只产出结构化报告，
格式化职责集中在本模块，新增输出格式（SARIF、JUnit 等）不污染检测逻辑，
也便于外部工具（IDE 插件、CI 门禁）以标准格式消费 MumuSpec 的检查结果。

## 用户场景 (User scenarios)

1. **CI 集成**：CI 流水线读取 SARIF 输出，在 PR 上标注 drift 违规
2. **IDE 展示**：编辑器插件以 SARIF 标准格式渲染问题列表
3. **报表定制**：新增目标格式时只扩展本模块，检测层零改动

## 验收标准 (Acceptance criteria)

- 输出符合 SARIF 2.1.0 schema，可被主流 SARIF 消费者解析
- 格式化器为纯函数：输入 DriftReport，输出字符串/对象，无副作用
- 新增格式化器只在本模块内扩展，不修改 src/contract 检测层
