---
layer: 0
scope: "."
last_updated: "2026-07-10"
---

## Requirement: Ponytail 基础编码约束

### SHALL
- 编写新代码前必须检查代码库中是否已有可复用的实现
- 新代码必须是最小可工作实现（仅写必要的代码）
- 有意简化必须用 ponytail: 注释标记原因

### SHALL NOT
- 禁止引入未被请求的抽象层（YAGNI）
- 禁止在标准库/平台特性已满足需求时引入新依赖
- 禁止生成未被请求的样板代码（boilerplate）
- 禁止用复杂方案替代简单方案（boring over clever）

### SHOULD
- 优先删除而非新增代码（deletion over addition）
- 理解问题后再写代码，而非边写边理解
- 对复杂请求提出质疑而非盲目实现

### Enforcement
- PONYTAIL-1: lint rule: detect unnecessary abstraction patterns (YAGNI check)
- PONYTAIL-2: lint rule: check for unnecessary new dependencies
- PONYTAIL-3: lint rule: detect boilerplate code patterns
- PONYTAIL-4: lint rule: detect overly clever solutions

## Requirement: 项目架构

### SHALL
- 使用 Node.js 原生 http 模块构建服务（不引入 Express 等框架）
- 数据模型定义在 src/models/ 目录下
- 路由处理逻辑定义在 src/api/ 目录下
- 存储逻辑定义在 src/storage/ 目录下
- 响应格式统一为 { success, data, error } JSON 结构

### SHALL NOT
- 禁止引入外部 Web 框架（Express / Fastify / Koa）
- 禁止使用 ORM 框架（Sequelize / TypeORM）
- 不允许在根级规范中定义具体模块的实现方式

### Enforcement
- ARCH-1: 检查 package.json dependencies 不包含 Web 框架
- ARCH-2: 检查目录结构是否符合 src/models, src/api, src/storage 分层

## Requirement: 错误处理

### SHALL
- 接口调用失败必须返回对应错误码
- 服务端异常必须捕获并返回 500 响应（不暴露堆栈）
- 参数校验失败必须返回 400 响应和详细错误描述

### SHALL NOT
- 禁止将未捕获的异常直接返回给客户端
- 禁止忽略 Promise rejection

### Enforcement
- ERR-1: 检查所有路由 handler 有 try-catch 包裹
- ERR-2: 检查 500 响应不包含 stack trace

## Requirement: 数据验证

### SHALL
- 所有接口输入必须在处理前进行校验
- 任务标题必须非空且长度不超过 200 字符
- 任务状态必须为 todo / in-progress / done 之一

### Enforcement
- VAL-1: 检查 validateTask 函数覆盖所有必填字段
- VAL-2: 检查非法输入返回 400 状态码


<!-- delta-merged from portable-exe-packaging/scripts-build-exe.md -->
---
id: DS-001
layer: 1
scope: scripts
delta: ADDED
---

## SHALL
- SHALL 提供 scripts/build-exe.mjs 打包脚本
- SHALL 支持 Node.js SEA (Single Executable Application) 生成独立 exe
- SHALL 输出文件路径可配置（默认 ./dist/）
- SHALL 自动检测 Node.js 版本（要求 ≥ v20.0.0）

## SHALL NOT
- SHALL NOT 依赖外部打包工具（仅使用 Node.js 内置能力）
- SHALL NOT 修改源代码结构（仅打包，不改写源码）

### Enforcement
- DS-BLD-1: 检查 build-exe.mjs 仅使用 node:sea
- DS-BLD-2: 检查输出路径可配置



<!-- delta-merged from portable-exe-packaging/scripts-startup.md -->
---
id: DS-002
layer: 0
scope: scripts
delta: ADDED
---

## SHALL
- SHALL 提供 scripts/start.mjs 一键启动脚本
- SHALL 自动检测依赖是否安装（未安装则自动 npm install）
- SHALL 同时启动后端 API 服务和前端静态服务
- SHALL 支持环境变量配置端口和目录

## SHALL NOT
- SHALL NOT 修改现有服务代码（通过配置适配）
- SHALL NOT 写入系统目录（仅当前目录和子目录）

### Enforcement
- DS-START-1: 检查 start.mjs 同时启动前后端服务
- DS-START-2: 检查端口可通过环境变量配置



<!-- delta-merged from build-frontend/frontend.md -->
---
id: DS-FE-001
layer: 0
scope: public
delta: ADDED
---

## Requirement: 前端架构

### SHALL
- SHALL 使用 Preact via CDN（esm.sh）作为 UI 渲染库，通过 ES Module import 引入
- SHALL 使用原生 HTML/CSS/JS，不引入构建工具（webpack/vite/rollup 等）
- SHALL 前端文件放置在 `public/` 目录下
- SHALL 提供 `public/index.html` 作为应用入口
- SHALL 使用 Preact 的 `render()` 函数将 UI 挂载到 DOM

### SHALL NOT
- SHALL NOT 引入 npm 依赖用于前端构建
- SHALL NOT 使用 JSX 语法（CDN 模式下使用 `htm` tagged template 或 `h()` 函数）
- SHALL NOT 引入 CSS 框架（Tailwind/Bootstrap 等）

### Enforcement
- FE-ARCH-1: 检查 package.json 无前端构建依赖
- FE-ARCH-2: 检查 public/ 目录下无 .jsx/.tsx 文件
- FE-ARCH-3: 检查使用 htm 或 h() 函数

## Requirement: 前端功能

### SHALL
- SHALL 展示任务列表，以卡片形式呈现每个任务
- SHALL 支持创建新任务（标题输入 + 状态选择）
- SHALL 支持编辑任务标题和状态（inline 编辑）
- SHALL 支持删除任务（带确认提示）
- SHALL 支持按状态筛选（全部/todo/in-progress/done）
- SHALL 支持按创建时间排序（升序/降序切换）
- SHALL 通过 fetch API 调用后端 REST 端点
- SHALL 处理 API 错误并显示用户友好的错误信息
- SHALL 在加载/操作时显示加载状态

### SHALL NOT
- SHALL NOT 在前端进行数据验证逻辑复制（依赖后端校验，前端仅做基本非空检查）
- SHALL NOT 使用 localStorage 缓存任务数据（数据源为 API）

### Enforcement
- FE-FUNC-1: 检查 UI 交互流程覆盖任务 CRUD
- FE-FUNC-2: 检查 API 调用使用 fetch
- FE-FUNC-3: 不存在 localStorage 缓存逻辑

## Requirement: 前端服务

### SHALL
- SHALL 提供 `scripts/start.mjs` 统一启动脚本
- SHALL 统一启动脚本同时启动 API 服务和静态文件服务
- SHALL 静态文件服务可配置端口（默认与 API 不同端口）
- SHALL API 服务支持 CORS（允许前端跨域访问）或由同源服务提供静态文件

### SHALL NOT
- SHALL NOT 修改现有 API 路由逻辑（仅添加 CORS 头或静态文件服务）
- SHALL NOT 引入 Express 或其他 Web 框架来提供静态文件

### Enforcement
- FE-SRV-1: 检查 start.mjs 同时启动 API + 静态服务
- FE-SRV-2: 检查 CORS 头或同源配置
- FE-SRV-3: 检查无外部 Web 框架引入

## Requirement: design.md 前端风格规范

### SHALL
- SHALL 在 design.md 中定义前端视觉风格规范
- SHALL 包含设计令牌：颜色、排版、间距、圆角、阴影
- SHALL 定义组件视觉规范：卡片、按钮、输入框、状态标签
- SHALL 遵循现代极简风格（Notion/Linear 参考）
- SHALL 支持响应式布局（移动端适配）

### SHALL NOT
- SHALL NOT 在 design.md 中定义具体代码实现

### Enforcement
- FE-STYLE-1: 检查 design.md 包含颜色/排版/间距令牌
- FE-STYLE-2: 检查设计规范遵循极简风格

