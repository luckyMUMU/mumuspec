---
scope: src/knowledge/scanners
layer: 3
---

# Technical Design: knowledge/scanners

## SHALL constraints

- 所有扫描器必须实现统一的扫描结果契约（ScanSource / ScanSourceResult）
- 对外导出必须与 BOUNDARY.md 函数表一致，新增导出须同步更新 BOUNDARY.md
- 每个扫描器必须可独立实例化与测试（依赖以参数注入）

## SHALL NOT constraints

- 禁止扫描器直接写入知识页（产出结构化结果，写入归 knowledge 域）
- 禁止扫描器之间相互依赖或共享可变状态
- 禁止扫描器依赖上层域（cli、mcp 等分发层）
