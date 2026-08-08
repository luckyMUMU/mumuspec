---
scope: src/contract
layer: 2
title: 契约层 — 模块边界与外部契约验证
last_updated: '2026-08-08'
---

# 产品需求: Contract Layer

## 概述

契约层提供目录边界文档（BOUNDARY.md）的加载、验证、漂移检测与影响分析能力，确保模块间契约在各开发阶段保持一致。

## 核心概念

- **BOUNDARY.md**: 每个目录维护的边界声明文档（对外接口、依赖、数据契约、变更记录）
- **Contract**: 持久化的外部契约记录（API 签名、数据库映射、序列化格式等）
- **Drift Detection**: 检测代码实现与规范文档之间的漂移
- **Impact Analysis**: 变更影响范围评估

## 功能需求

### REQ-CONTRACT-01: BOUNDARY.md 加载
- SHALL: 支持从任意目录路径加载并解析 BOUNDARY.md
- SHALL: BOUNDARY.md 存储位置为 `dir/.mumuspec/BOUNDARY.md`（与规范文件同目录）
- SHALL: 向后兼容直接位于 `dir/BOUNDARY.md` 的旧格式（过渡期）
- SHALL: 解析 frontmatter、导出函数表、依赖声明、数据契约等结构化字段
- SHALL: 同时支持 Markdown 表格格式（`| col | col |`）和列表格式（`- item`）的解析

### REQ-CONTRACT-02: 契约持久化
- SHALL: 支持将外部契约写入 `.mumuspec/contracts/` 目录
- SHALL: 为每次契约变更记录审计日志（audit.log）

### REQ-CONTRACT-03: 漂移检测
- SHALL: 检测 BOUNDARY.md 中声明与代码 export 之间的不一致
- SHALL: 检测 contract 代码引用与代码实现之间的不一致

### REQ-CONTRACT-04: 影响分析
- SHALL: 提供 `analyzeContractImpact` 函数，逐一列出上下游依赖方与兼容性风险
- SHALL: 生成可读的影响报告

### REQ-CONTRACT-05: 文件类型覆盖
- SHALL: `validateBoundaries` 扫描代码目录时覆盖以下扩展名：`.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` `.py` `.java` `.go` `.rs` `.vue`
- SHALL NOT: 遗漏前端项目（`.tsx`/`.jsx`）和 ES Module 脚本（`.mjs`）目录
