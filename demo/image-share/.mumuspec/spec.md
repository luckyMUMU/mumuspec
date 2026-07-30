---
layer: 0
scope: "."
last_updated: "2026-07-29"
---

# LAN Image Share — 项目规范

## Requirement: 核心功能 — 图片上传

### SHALL
- 上传接口必须验证文件 MIME 类型仅允许图片格式（JPEG / PNG / GIF / WebP / BMP / SVG）
- 上传接口必须验证文件大小不超过 50MB
- 上传接口必须生成全局唯一 ID 标识图片
- 上传后必须返回图片元数据（ID、原始文件名、MIME类型、尺寸、上传时间、文件大小）
- 图片原始字节流必须原样存储，不做任何压缩或转换（保证高清原图）
- 存储文件名必须使用 UUID 而非原始文件名，避免路径冲突
- 必须自动解析图片分辨率（至少支持 PNG / JPEG / GIF / WebP）

### SHALL NOT
- 不允许上传 SVG 以外的非位图（.gif 已在允许列表中）
- 不允许图片存储文件名包含用户输入的原始文件名
- 不允许对下载请求返回非原始质量图片
- 不允许未经验证的文件类型写入存储目录

## Requirement: 核心功能 — 图片浏览与下载

### SHALL
- 图片列表 API 必须按上传时间倒序返回
- 下载/浏览接口必须返回正确的 Content-Type 响应头（与上传时 MIME 类型一致）
- 下载接口必须支持缓存（Cache-Control: max-age >= 1天）
- 删除接口必须同时移除图片文件和元数据记录

### SHALL NOT
- 不允许列表接口返回 null 或缺失字段的条目
- 不允许删除不存在的图片时返回成功状态

## Requirement: 安全

### SHALL
- 所有用户输入必须经过路径安全检查（防止路径遍历攻击）
- 文件上传验证必须使用 MIME 类型而非文件扩展名
- 删除操作必须验证 ID 格式（UUID v4 格式）
- 元数据文件（metadata.json）必须存放在 uploads/ 目录内，不被直接 HTTP 访问

### SHALL NOT
- 不允许使用用户提供的文件名拼接文件路径
- 不允许 URL path 中的 ID 包含路径分隔符（`/`、`..`、`\`）
- 不允许元数据文件被 HTTP 直接访问（`/metadata.json` 路径不应暴露）

## Requirement: CORS 与局域网访问

### SHALL
- API 必须返回 CORS 头（Access-Control-Allow-Origin: *）
- 服务器必须监听 0.0.0.0 以接受局域网其他设备的连接
- /api/info 端点必须返回本机局域网 IP 地址

### SHOULD
- 应对简单请求和预检请求正确响应

## Requirement: Web UI

### SHALL
- 必须支持拖拽上传
- 必须支持点击选择文件
- 必须支持灯箱预览高清原图
- 必须支持一键复制图片分享链接
- UI 必须是响应式的（适配手机和桌面）

### SHOULD
- 上传进度条应符合 50%（前端）+ 50%（服务端）的视觉模型

## Requirement: 编码规范（Ponytail）

### SHALL
- 必须使用 Node.js 标准库实现 HTTP 服务（不接受 Express/Koa 等框架）
- 必须使用 UUID v4（crypto.randomUUID）生成标识
- 文件流操作必须使用 Buffer 的流式读取或完整读取（不允许部分写入）
- 有意简化或 Trade-off 必须用 `// ponytail:` 注释标记原因

### SHALL NOT
- 不允许在项目运行时依赖任何第三方 npm 包（devDependencies 除外）
- 不允许引入未被请求的工具类/工具函数（YAGNI）
- 不允许为未观测到的场景编写防御性代码

### SHOULD
- 使用标准 Path API 处理路径拼接
- 错误日志应有足够信息供排查，但不打印敏感数据

## Requirement: 测试

### SHALL
- 所有公开模块（upoader.ts, image-manager.ts, server.ts）必须有对应的单元测试
- 测试必须覆盖核心成功路径和边界失败路径
- 测试必须可无网络依赖运行（纯 Node Test Runner 或 Vitest）

### SHOULD
- 测试应使用真实 HTTP 请求而非 mock stream（确保解析器在生产环境行为正确）

## Requirement: 知识沉淀

### SHALL
- 架构决策必须记录在 .mumuspec/knowledge/decision/ 下
- 编码模式必须记录在 .mumuspec/knowledge/pattern/ 下

### SHOULD
- 有意选型的注释（ponytail:）应被提取为决策知识

## Requirement: AI 协作

### SHALL
- 项目必须包含 CLAUDE.md 和 AGENTS.md 供 AI 工具加载
- 规范文件中不可变部分必须明确标识

### MAY
- AI 协作文件可以包含示例代码片段辅助理解项目约定

---

## Enforcement

- SEC-1: ID 路径参数必须通过安全字符校验
- SEC-2: 文件路径必须基于 UUID 而非用户输入
- FN-1: 上传接口必须同时校验 MIME 和大小
- FN-2: 列表必须按时间倒序
- ARCH-1: 禁止运行时第三方依赖
- TEST-1: src/ 下每个 .ts 模块必须有对应 tests/ 下的测试文件
