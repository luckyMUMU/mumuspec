---
type: pattern
id: KP-001
title: 路径安全模式
scope: src/image-manager.ts
created_at: "2026-07-29"
status: fresh
---

# 模式：路径安全

## 上下文
用户上传文件时，原始文件名可能包含恶意路径字符（`../../etc/passwd`）。

## 方案

1. **永不信任文件名**：存储时使用 `uuid + 推断后缀`
2. **路径拼接白名单**：仅允许 `[a-f0-9-]+\.(jpg|png|gif|webp|bmp|svg)` 格式的文件名
3. **读取时校验**：先检查 UUID 是否在内存 Map 中，再 readFileSync

## 代码示例

```typescript
// Correct: 路径完全由系统生成
const filename = `${uuid}${ext}`; // ext 来自 MIME 类型的白名单映射
const filePath = join(this.uploadDir, filename);

// DO NOT DO: 文件名来自用户输入
const filePath = join(this.uploadDir, userProvidedFilename);
```

## 相关规范
- spec.md: SEC-1, SEC-2
- prohibitions.md: "不允许将用户提供的原始文件名用于文件存储路径拼接"
