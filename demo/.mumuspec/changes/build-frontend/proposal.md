# Proposal: build-frontend

## Why

demo Task API 目前只有后端 REST API，缺少用户界面。用户需要通过 curl 或 Postman 等 HTTP 客户端才能操作任务，无法直观地管理任务。构建一个现代极简风格的前端界面，使 Task API 成为一个完整可演示的应用。

本变更同时验证 MumuSpec 新版本（0.15.0-alpha.1）的前端构建工作流，以 design.md 作为前端风格规范文件驱动设计与实现。

## What

为 Task API 构建一个基于 Preact（CDN 引入）的前端界面，包含以下内容：

1. **前端界面**：使用 Preact via CDN（esm.sh），零构建步骤，单页应用
2. **功能**：完整 CRUD + 按状态筛选 + 排序
   - 任务列表展示（卡片式布局）
   - 创建新任务（标题输入 + 状态选择）
   - 编辑任务（inline 编辑标题/状态）
   - 删除任务（带确认）
   - 按状态筛选（全部/todo/in-progress/done）
   - 按创建时间/标题排序
3. **视觉风格**：现代极简（Notion/Linear 风格），由 design.md 定义
4. **服务方式**：scripts/start.mjs 统一启动前后端
5. **design.md**：作为前端风格规范文件，定义颜色、排版、间距、组件等设计令牌

## Impact Scope

- `public/` — 新建前端静态文件目录（index.html, styles.css, app.js）
- `scripts/start.mjs` — 修改统一启动脚本，同时启动 API 和静态文件服务
- `src/api/server.ts` — 可能修改以支持静态文件服务或 CORS（Design 阶段确定）
- `src/api/routes.ts` — 可能添加 CORS 头（Design 阶段确定）
- `.mumuspec/design.md` — 更新，增加前端设计规范
- `package.json` — 无新增依赖（Preact 通过 CDN 引入）

## Workflow

full
