# New SHALL NOT Constraints

## SHALL-NOT-1: 禁止引入构建工具
- 不使用 webpack/vite/rollup/esbuild 等构建工具
- 前端直接在浏览器中运行，无需转译

## SHALL-NOT-2: 禁止引入 npm 前端依赖
- Preact 和 htm 通过 CDN import 引入
- package.json 不新增前端相关依赖

## SHALL-NOT-3: 禁止引入 CSS 框架
- 不使用 Tailwind/Bootstrap/Bulma 等 CSS 框架
- 样式使用原生 CSS（可使用 CSS 变量）

## SHALL-NOT-4: 禁止修改后端 API 业务逻辑
- 仅允许添加 CORS 头或静态文件服务
- 不修改现有 CRUD 路由逻辑

## SHALL-NOT-5: 禁止使用 JSX
- CDN 模式下不支持 JSX 编译
- 使用 htm tagged template literals 或 h() 函数
