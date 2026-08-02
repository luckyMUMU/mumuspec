# New SHALL Constraints

## SHALL-1: 前端必须使用 Preact via CDN
- 前端 UI 渲染使用 Preact，通过 esm.sh CDN 引入
- 不需要 npm install，不需要构建步骤

## SHALL-2: 前端必须实现完整 CRUD + 筛选排序
- 任务列表、创建、编辑、删除、按状态筛选、按时间排序

## SHALL-3: design.md 必须作为前端风格规范文件
- 定义设计令牌（颜色、排版、间距、圆角、阴影）
- 定义组件视觉规范
- 驱动前端实现

## SHALL-4: 统一启动脚本
- scripts/start.mjs 必须同时启动 API 和前端服务
- 用户一键启动完整应用

## SHALL-5: 响应式布局
- 前端必须适配移动端视口
