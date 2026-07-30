---
type: decision
id: KD-002
title: 手写 multipart/form-data 解析器
scope: src/uploader.ts
created_at: "2026-07-29"
status: fresh
---

# 决策：手写 multipart 解析器替代 busboy/multer

## 背景
零运行时依赖原则（KD-001）要求不能引入 busboy、multer、formidable 等成熟库。

## 决策
手写一个基于 Buffer indexOf + 边界 parsing 的 multipart 解析器。

## 关键技术点

- **边界匹配**：搜索 `--{boundary}` 字节序列，而非字符串（支持二进制内容）
- **头部解析正则**：使用 tempered greedy token `(?:(?!name=).)*` 防止 `filename=` 被误匹配为 `name=`
- **字段提取**：`Content-Disposition` 头部解析文件名和表单字段名

## 已知陷阱

- **Greedy Match**：正则 `[^\r\n]*name="..."` 会跨 `filename=` 边界贪婪匹配，tempered token 是正确解法
- **二进制安全**：必须使用 Buffer 而非 string 处理 body，否则多字节字符/非文本字节会被破坏

## 何时重构

如果项目超越 demo 阶段或生产用户量 > 100，优先切换到 busboy（MIT 协议，零外部依赖）。
