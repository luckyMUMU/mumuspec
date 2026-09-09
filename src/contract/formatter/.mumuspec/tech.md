---
scope: src/contract/formatter
layer: 3
---

# Technical Design: contract/formatter

## SHALL constraints

- 格式化器必须是纯函数：DriftReport 进，目标格式出，不做 IO
- SARIF 输出必须符合 SARIF 2.1.0 schema（version/$schema/runs 字段齐全）
- 对外接口必须与 BOUNDARY.md 声明一致，新增导出须同步更新 BOUNDARY.md

## SHALL NOT constraints

- 禁止在格式化器中执行 drift 检测逻辑（检测归 src/contract）
- 禁止引入对领域模块（change/guard/spec 等）的直接依赖
- 禁止格式化器之间相互依赖（各自独立转换）
