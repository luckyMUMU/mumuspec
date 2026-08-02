---
id: KE-build-frontend-lessons
title: Lessons from build-frontend decisions
type: lesson
status: confirmed
scope: build-frontend
created_at: 2026-08-01
tags:
  - auto-extracted
  - lesson
  - decisions
  - build-frontend
graph_bindings: []
---
> Auto-extracted from build-frontend/decisions.md

# Decision Log: build-frontend

## Open 阶段决策

### D1: 前端技术选型 — Preact via CDN
- **Context**: 需要构建前端 UI，Ponytail 约束要求优先使用标准库/平台特性
- **Decision**: 使用 Preact via esm.sh CDN，配合 htm tagged template
- **Reasoning**: 用户明确选择轻量框架方案（优先级 1: 用户显式指令）。Preact 体积小（~3KB），CDN 引入无需构建步骤，htm 替代 JSX 无需编译。符合 Ponytail 阶梯第 5 级（已安装依赖能做吗 → CDN 引入不增加 npm 依赖）
- **Consequences**: 前端代码使用 htm 语法而非 JSX，需要适应 tagged template 写法

### D2: 服务方式 — 统一启动脚本
- **Context**: 需要同时运行 API 和前端
- **Decision**: 使用 scripts/start.mjs 统一启动前后端，前端和后端运行在不同端口
- **Reasoning**: 用户明确选择统一启动脚本方案。分离运行便于开发调试，CORS 支持跨域访问
- **Consequences**: 需要在 API 中添加 CORS 头支持

### D3: design.md 作为前端风格规范
- **Context**: 需要定义前端视觉风格
- **Decision**: 在 .mumuspec/design.md 中增加前端设计规范章节
- **Reasoning**: design.md 已存在于项目根规范中，追加前端规范保持单一设计来源
- **Consequences**: design.md 将同时包含后端架构设计和前端视觉设计

### D4: 影响范围判定
- **affected_scopes**: `public`, `scripts`, `src/api`
- **Reasoning**: 新建 public/ 目录存放前端文件，修改 scripts/start.mjs 添加统一启动，可能修改 src/api 添加 CORS 支持

### D5: 知识加载摘要
- 加载了 demo 项目历史变更记录（6 个已归档变更）
- 无直接相关的前端设计历史知识
- 现有 design.md 定义了后端架构（分层架构、请求流程、关键决策）

---

## Design 阶段决策

### D6: 分层构建顺序（Bottom-Up）
- **Context**: MumuSpec config.implementation_strategy: bottom-up
- **Decision**: L0（HTML+CSS）→ L1（Preact 骨架）→ L2（功能组件）→ L3（交互逻辑）→ L4（集成启动）
- **Reasoning**: 从叶子节点（HTML/CSS 基础）向上构建到完整应用

### D7: CORS 头添加位置
- **Context**: 需要在 API 响应中添加 CORS 头支持跨域
- **Decision**: 在 `sendJSON` 辅助函数中添加 CORS 头，所有路由统一生效
- **Reasoning**: 集中管理，避免各路由重复添加

### D8: 视觉风格实现方式
- **Context**: design.md 定义了完整设计令牌
- **Decision**: 使用 CSS 自定义属性（CSS Variables）实现设计令牌，styles.css 中所有值取自 `:root` 变量
- **Reasoning**: 原生 CSS 变量支持运行时主题切换，无额外依赖

### D9: 测试用例分层设计
- **Context**: 测试用例是设计输出，需要按层组织
- **Decision**: 5 层测试用例，共 27 个测试点（L0: 4, L1: 5, L2: 7, L3: 5, L4: 7）
- **Reasoning**: 每层独立验证，从基础静态文件到集成启动

### D10: 前端静态文件服务
- **Context**: 需要 Node.js 原生方式提供静态文件服务
- **Decision**: 在 scripts/start.mjs 中使用 `node:fs` 读取 public/ 目录文件，按扩展名设置 Content-Type
- **Reasoning**: 符合 Ponytail 阶梯第 3 级（标准库已满足需求），无需引入 serve 等第三方库
