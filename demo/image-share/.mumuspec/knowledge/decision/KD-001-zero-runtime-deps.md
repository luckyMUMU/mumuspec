---
type: decision
id: KD-001
title: 零运行时依赖
scope: .
created_at: "2026-07-29"
status: fresh
---

# 决策：零运行时依赖

## 背景
项目作为 MumuSpec demo 演示工程，需要体现 Ponytail 编码约束的极致实践。

## 决策
项目运行时零第三方 npm 依赖（devDependencies 仅 TypeScript + 测试工具）。

## 理由
- 演示目的：展示 Node.js 标准库的完整能力
- 部署简单：无需 `npm install` 生产环境依赖
- 面积最小化：减少供应链攻击面

## 已知代价
- 手写 multipart 解析器需要自行处理正则边界陷阱（见 KD-002）
- JSON 元数据全量写入，不支持并发

## 适用范围
仅适用于局域网 demo 场景。生产数据库级应用应使用 PostgreSQL + 对象存储。
