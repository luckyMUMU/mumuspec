---
title: Structured Design Template Enforcement
id: DS-001
scope: src/guard/phase-guard.ts
status: proposed
priority: P0
---

# Delta Spec: 结构化设计模板

## Current Behavior
Design.md 自由格式，无强制字段。guard 仅检查文件存在性。

## New Behavior
1. 定义 design-schema.yaml，列出必须字段及其验证规则
2. guard checkDesignToBuild 增加字段完整性检查
3. 缺少必填字段时返回 E-DESIGN-009

## Schema Definition
required_sections:
  - name: API Contracts
    patterns: ["## .*API", "## .*Endpoint"]
    required_for: [full]
  - name: Data Flow
    patterns: ["## .*Data Flow", "## .*数据流"]
    required_for: [full]
  - name: Error Specification
    patterns: ["## .*Error", "## .*错误"]
    required_for: [full]
  - name: Architecture Overview
    patterns: ["## .*Architecture", "## .*架构"]
    required_for: [full, tweak]
  - name: Implementation Layers
    patterns: ["## .*Implementation", "## .*Layer", "## .*实现"]
    required_for: [full, hotfix, tweak]
  - name: Constraints Analysis
    patterns: ["## .*Constraint", "## .*约束"]
    required_for: [full]
  - name: Risk Mitigation
    patterns: ["## .*Risk", "## .*风险", "## .*Mitigation"]
    required_for: [full]
  - name: Test Strategy
    patterns: ["## .*Test", "## .*测试"]
    required_for: [full, hotfix, tweak]

## Error Code
- E-DESIGN-009: Design 文档缺少必填字段，列出缺失 section
