---
layer: 0
scope: "."
last_updated: "2026-07-29"
---

# LAN Image Share — 设计文档

## 1. 架构概览

```
┌─────────────────────────────────────────────────┐
│                  Web Browser                      │
│              public/index.html                    │
│         (vanilla HTML/CSS/JS)                    │
└──────────────────┬──────────────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────────────┐
│              server.ts (node:http)               │
│              0.0.0.0:3100                        │
│  ┌─────────┬──────────┬──────────┬─────────────┐│
│  │  GET /  │ POST /   │  GET /   │ DELETE /    ││
│  │ index   │ upload   │ images   │ images/:id  ││
│  └────┬────┴────┬─────┴────┬─────┴──────┬──────┘│
└───────┼─────────┼──────────┼────────────┼───────┘
        │         │          │            │
        │    ┌────▼────┐     │            │
        │    │uploader │     │            │
        │    │.ts      │     │            │
        │    │(parse   │     │            │
        │    │multipart│     │            │
        │    └────┬────┘     │            │
        │         │          │            │
   ┌────▼─────────▼──────────▼────────────▼──────┐
   │           image-manager.ts                   │
   │  - 文件存储（UUID命名）                       │
   │  - 元数据持久化（metadata.json）               │
   │  - 尺寸解析（Buffer.decode）                   │
   └──────────────────────────────────────────────┘
```

## 2. 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **入口** | `server.ts` | HTTP Server 启动、路由分发、CORS |
| **解析器** | `uploader.ts` | multipart/form-data 解析（零依赖手写） |
| **管理器** | `image-manager.ts` | 图片 CRUD + 元数据持久化 + 尺寸解析 |
| **类型** | `types.ts` | 共享类型定义 + 常量 |

## 3. 数据模型

```typescript
interface ImageRecord {
  id: string;            // UUID v4
  filename: string;      // UUID + 后缀（存储文件名）
  originalName: string;  // 用户上传时的文件名（不参与路径操作）
  mimeType: string;      // image/jpeg、image/png 等
  size: number;          // 字节数
  width: number | null;  // 像素宽（可能解析失败）
  height: number | null; // 像素高（可能解析失败）
  uploadedAt: string;    // ISO 8601
}
```

元数据以 JSON 数组形式存储在 `uploads/metadata.json` 中，每次变更全量写入。

## 4. 存储方案

```
uploads/
├── metadata.json          ← 元数据索引（UUID数组 + 基本信息）
├── <uuid-1>.png
├── <uuid-2>.jpg
└── ...
```

**为何用文件系统而非数据库**：
- Ponytail 阶梯 Level 7：最小实现，demo 项目无需数据库服务器
- 单用户局域网使用场景，并发低，JSON 文件追加足够

## 5. 关键决策记录

| 决策 | 理由 | Trade-off |
|------|------|-----------|
| 手写 multipart 解析器 | 零运行时依赖目标 | 手写解析器需要更多测试覆盖 |
| UUID 作存储名 | 安全、避免冲突 | 失去原始文件名可读性 |
| JSON 元数据 | 简单、零配置 | 不支持并发写入（demo 可接受） |
| 流式文件读取 | 简单可靠 | 内存占用可能增大（50MB ceiling 可控） |

## 6. 安全考量

1. **路径遍历防护**：存储路径 = `uploadDir/<uuid><ext>`，用户输入不参与路径拼接
2. **ID 安全**：ID 仅用于 Map 查找，不用于文件系统路径
3. **类型白名单**：MIME 类型校验使用 Map，不依赖扩展名
4. **大小限制**：50MB ceiling，防止存储耗尽

## 7. 已知限制

- 不支持图片编辑/转换
- 不支持用户认证
- 不支持文件夹/相册组织
- 元数据全量写入，数百张图片后可能有性能瓶颈
