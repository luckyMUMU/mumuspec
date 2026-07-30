# CLAUDE.md — LAN Image Share

> AI 协作规则（Claude Code / Cursor / Windsurf 自动生成 + 人工补充）

## 项目概述

- **名称**: lan-image-share
- **语言**: TypeScript (strict mode + ESM)
- **目标**: 局域网高清图片分享服务（demo）
- **约束**: 零运行时依赖，所有功能基于 Node.js 标准库

## 项目结构

```
src/
├── types.ts              # ImageRecord 接口 + ALLOWED_TYPES 常量
├── uploader.ts           # multipart 解析器（手写的零依赖实现）
├── image-manager.ts      # 文件系统 CRUD + 元数据持久化 + 尺寸解析
└── server.ts             # HTTP 服务器 + 路由分发
tests/
└── uploader.test.ts      # ⚠️ 需补充 image-manager / server 测试
public/
└── index.html            # 原生 HTML/CSS/JS 单页应用
```

## 不可违反的规范

### 安全红线
1. 存储文件名 = UUID + 后缀，绝不使用用户输入的原始文件名做路径
2. 上传校验：MIME 类型必须在白名单 + 大小 <= 50MB
3. 删除/读取前必须验证 UUID 在内存 Map 中存在
4. `/api/info` 必须返回 CORS 头和局域网 IP

### 编码红线
1. 不安装任何 package.json 中的 dependencies（仅 devDependencies 合法）
2. 不引入第三方 npm 包于 src/ 代码中（包括 Express、busboy、sharp 等）
3. 不使用 eval / Function 构造器 / vm 模块

### 测试红线
1. src/ 中每个公开模块必须有对应 tests/ 的测试文件
2. 测试必须可无外部依赖运行
3. 不允许跳过的测试（无 .skip）

## 已知技术债

1. ~~multipart 正则贪婪匹配~~ → 已修复（tempered greedy token）
2. **缺少 image-manager 测试** → 需补充 CRUD 全路径覆盖
3. **缺少 server 路由测试** → 需补充 HTTP 接口测试
4. **metadata.json 可被 HTTP 访问** → 需路径过滤

## 架构决策速查

| 决策 | 文档 |
|------|------|
| 零运行时依赖 | `.mumuspec/knowledge/decision/KD-001-zero-runtime-deps.md` |
| 手写 multipart | `.mumuspec/knowledge/decision/KD-002-handwritten-multipart.md` |
| 路径安全模式 | `.mumuspec/knowledge/pattern/KP-001-path-safety.md` |
| 正则陷阱 | `.mumuspec/knowledge/lesson/KL-001-greedy-regex-trap.md` |

## 核心 API 摘要

```
POST   /api/upload          上传图片 (multipart/form-data)
GET    /api/images          获取图片列表（按时间倒序）
GET    /api/images/:id      获取图片元数据
DELETE /api/images/:id      删除图片
GET    /images/:id          获取图片文件（二进制流）
GET    /                     Web UI
GET    /api/info             服务状态
```

## 关键实现细节

- **multipart 边界匹配**: 基于 Buffer indexOf，不使用中间 string 转换
- **Content-Disposition 解析**: 使用 `(?:(?!name=).)*` 防止 filename/name 误匹配
- **图片尺寸解析**: 直接读取 PNG/JPEG/GIF/WebP 文件格式头（Buffer 操作）
- **元数据持久化**: 全量 JSON 写入 `uploads/metadata.json`

## 编码规范

1. 文件命名: kebab-case（如 `image-manager.ts`）
2. 行尾: LF (Unix)
3. 引号: 双引号（字符串内单引号可免转义）
4. 分号: 必须
5. 无 any: unknown 替代，类型断言需显式 narrowing

## 安全规则（非懒惰域）

- 输入验证: 第一个 defensive check
- 错误处理: 不能丢失原始错误上下文
- 敏感信息: 不在日志/响应中暴露路径/内部结构
- 路径安全: join + normalize + UUID 生成的白名单
