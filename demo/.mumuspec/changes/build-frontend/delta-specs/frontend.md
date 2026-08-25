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

## Requirement: 前端服务

### SHALL
- SHALL 提供 `scripts/start.mjs` 统一启动脚本
- SHALL 统一启动脚本同时启动 API 服务和静态文件服务
- SHALL 静态文件服务可配置端口（默认与 API 不同端口）
- SHALL API 服务支持 CORS（允许前端跨域访问）或由同源服务提供静态文件

### SHALL NOT
- SHALL NOT 修改现有 API 路由逻辑（仅添加 CORS 头或静态文件服务）
- SHALL NOT 引入 Express 或其他 Web 框架来提供静态文件

## Requirement: design.md 前端风格规范

### SHALL
- SHALL 在 design.md 中定义前端视觉风格规范
- SHALL 包含设计令牌：颜色、排版、间距、圆角、阴影
- SHALL 定义组件视觉规范：卡片、按钮、输入框、状态标签
- SHALL 遵循现代极简风格（Notion/Linear 参考）
- SHALL 支持响应式布局（移动端适配）

### SHALL NOT
- SHALL NOT 在 design.md 中定义具体代码实现
