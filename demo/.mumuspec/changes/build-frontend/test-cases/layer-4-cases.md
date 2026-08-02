# Layer 4 Test Cases — 集成与启动

## TC-4-001: start.mjs 启动 API 服务

- **Given**: 运行 `node scripts/start.mjs`
- **Then**: API 服务在 port 3000 启动，控制台输出 "API running on http://localhost:3000"

## TC-4-002: start.mjs 启动前端静态服务

- **Given**: 运行 `node scripts/start.mjs`
- **Then**: 静态文件服务在 port 3001 启动，控制台输出 "Frontend running on http://localhost:3001"

## TC-4-003: CORS 跨域访问

- **Given**: 前端运行在 port 3001，API 在 port 3000
- **When**: 前端 fetch GET http://localhost:3000/tasks
- **Then**: 请求成功，响应头包含 `Access-Control-Allow-Origin: *`

## TC-4-004: 前端 HTTP 服务返回静态文件

- **Given**: 浏览器访问 http://localhost:3001/
- **Then**: 返回 public/index.html 内容，Content-Type: text/html

## TC-4-005: 前端 HTTP 服务返回 CSS

- **Given**: 浏览器访问 http://localhost:3001/styles.css
- **Then**: 返回 public/styles.css 内容，Content-Type: text/css

## TC-4-006: 前端 HTTP 服务返回 JS

- **Given**: 浏览器访问 http://localhost:3001/app.js
- **Then**: 返回 public/app.js 内容，Content-Type: text/javascript

## TC-4-007: 404 处理

- **Given**: 访问不存在的路径 http://localhost:3001/nonexistent
- **Then**: 返回 404 状态码，错误信息 "Not Found"
