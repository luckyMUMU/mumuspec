# AGENTS.md — LAN Image Share

> Agent 协作规则（Claude Code / Codex / Windsurf 等）

## 项目信息

- **名称**: lan-image-share
- **语言**: TypeScript (strict + ESM)
- **类型**: 局域网图片分享 demo 服务
- **核心约束**: 零运行时依赖（zero runtime dependencies）

## 首次接入必读

1. 阅读 `.mumuspec/spec.md` 了解 SHALL/SHOULD/MAY
2. 阅读 `.mumuspec/prohibitions.md` 了解反向禁止
3. 阅读 `.mumuspec/design.md` 了解架构决策
4. 阅读 `CLAUDE.md` 了解安全与编码红线

## 不可违反的规则

### 架构红线
- `src/` 代码只能使用 Node.js 标准库
- 不使用 Express/Koa/Fastify
- 不使用 busboy/multer 等第三方 multipart 库
- 不使用 sharp/jimp 等第三方图片库

### 安全红线
- 存储文件名必须是 UUID（源自 crypto.randomUUID()）
- 用户上传的原始文件名仅存储在 ImageRecord.originalName，不参与路径操作
- 上传 MIME 类型必须在 ALLOWED_TYPES 白名单中

### 数据红线
- metadata.json 存储在 uploads/ 目录，不应通过 HTTP 静态服务暴露
- 删除操作必须同步移除文件和元数据

## 代码编写指南

### 路径处理
```typescript
// CORRECT
const ext = ALLOWED_TYPES.get(mimeType) ?? ".bin";
const filename = `${uuid}${ext}`;
const filePath = join(this.uploadDir, filename);
```

### 错误处理
```typescript
// CORRECT: 保留原始错误
catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error";
  return { success: false, error: message };
}
```

## 测试指南

- 遵循 SDD 思想：先写测试，再实现功能
- 使用真实 HTTP 请求测试 multipart 解析（避免 mock stream）
- 二进制数据用 base64 字符串对比

## API 路径

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Web UI |
| POST | `/api/upload` | 上传图片 |
| GET | `/api/images` | 图片列表 |
| GET | `/api/images/:id` | 图片元数据 |
| DELETE | `/api/images/:id` | 删除图片 |
| GET | `/images/:id` | 获取图片文件 |
| GET | `/api/info` | 服务信息 |

## 关键决策

详见 `.mumuspec/knowledge/decision/`:
- KD-001: 零运行时依赖决策
- KD-002: 手写 multipart 解析器决策
