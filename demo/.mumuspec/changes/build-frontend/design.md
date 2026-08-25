# Design: Frontend UI — Task Manager

## Architecture Overview

Task Manager 前端是一个基于 Preact 的单页应用，使用 htm tagged template 语法。

### 分层架构

```
┌─────────────────────────────────────────────────────┐
│                    public/index.html                 │
│              HTML 入口 + CDN Import Map              │
├─────────────────────────────────────────────────────┤
│                     public/app.js                    │
│         Preact 组件 + htm 模板 + 状态管理            │
├─────────────────────────────────────────────────────┤
│                    public/styles.css                 │
│             CSS 变量（设计令牌）+ 组件样式             │
└─────────────────────────────────────────────────────┘
```

### 请求流程

```
用户交互 → 组件事件处理 → fetch API 调用 → Task API (/tasks)
         → 状态更新 → 重新渲染 UI
```

## Design Tokens (设计令牌)

### 颜色系统

```css
/* Primary Palette */
--color-primary: #6366f1;        /* Indigo-500 — 主操作色 */
--color-primary-hover: #4f46e5;  /* Indigo-600 — 悬停色 */
--color-primary-light: #e0e7ff;  /* Indigo-100 — 淡背景 */

/* Neutral Palette */
--color-bg: #ffffff;            /* 页面背景 */
--color-surface: #f8fafc;       /* 卡片/容器背景 */
--color-border: #e2e8f0;        /* 边框 */
--color-text-primary: #1e293b;  /* 主要文字 */
--color-text-secondary: #64748b;/* 次要文字 */
--color-text-muted: #94a3b8;    /* 弱化文字 */

/* Semantic Colors */
--color-success: #10b981;       /* Done 状态 */
--color-warning: #f59e0b;       /* In-Progress 状态 */
--color-neutral: #6b7280;       /* Todo 状态 */
--color-danger: #ef4444;        /* 删除/错误 */
```

### 排版系统

```css
/* Font Family */
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;

/* Font Scale */
--font-xs: 0.75rem;    /* 12px — 状态标签 */
--font-sm: 0.875rem;   /* 14px — 次要信息 */
--font-base: 1rem;     /* 16px — 正文 */
--font-lg: 1.125rem;   /* 18px — 小标题 */
--font-xl: 1.5rem;     /* 24px — 大标题 */
--font-2xl: 2rem;     /* 32px — 页面标题 */

/* Font Weight */
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;

/* Line Height */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### 间距系统

```css
/* Spacing Scale (4px base) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### 圆角与阴影

```css
/* Border Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
```

## 组件规范

### C1: 任务卡片 (TaskCard)

```
┌─────────────────────────────────────────────────┐
│  [状态圆点]  任务标题文本...                        │
│              Created: 2026-08-01                  │
│                                    [编辑] [删除]  │
└─────────────────────────────────────────────────┘
```

**视觉规范**：
- 背景色：`var(--color-surface)`
- 圆角：`var(--radius-lg)`
- 阴影：`var(--shadow-sm)` → 悬停时 `var(--shadow-md)`
- 内边距：`var(--space-5)`
- 边框：1px solid `var(--color-border)`

**状态圆点**：直径 8px，圆角 `var(--radius-full)`
- Todo: `var(--color-neutral)`
- In-Progress: `var(--color-warning)`
- Done: `var(--color-success)`

**编辑态**：
- 标题变为 `<input>` 输入框
- 状态变为 `<select>` 下拉框
- 显示 [保存] [取消] 按钮

### C2: 状态下拉 (StatusBadge)

**视觉规范**：
- 字体大小：`var(--font-xs)`
- 字体权重：`var(--weight-medium)`
- 内边距：`var(--space-1) var(--space-2)`
- 圆角：`var(--radius-full)`
- 布局：inline-flex，间距 `var(--space-2)`

**三色状态**：
| Status | Background | Text |
|--------|-----------|------|
| todo | `var(--color-neutral)` 20% opacity | `var(--color-neutral)` |
| in-progress | `var(--color-warning)` 20% opacity | `var(--color-warning)` |
| done | `var(--color-success)` 20% opacity | `var(--color-success)` |

### C3: 按钮 (Button)

**Primary Button** — 创建/保存：
- 背景色：`var(--color-primary)`
- 悬停：`var(--color-primary-hover)`
- 文字：白色，`var(--font-sm)`，`var(--weight-medium)`
- 圆角：`var(--radius-md)`
- 内边距：`var(--space-2) var(--space-4)`

**Danger Button** — 删除：
- 背景色：transparent，边框 1px `var(--color-danger)`
- 文字：`var(--color-danger)`
- 悬停：背景 `var(--color-danger)` 10% opacity

**Ghost Button** — 编辑/取消：
- 背景色：transparent
- 悬停：背景 `var(--color-surface)`

### C4: 输入框 (Input)

- 边框：1px solid `var(--color-border)`
- 圆角：`var(--radius-md)`
- 内边距：`var(--space-2) var(--space-3)`
- 聚焦：边框色变 `var(--color-primary)`，外加 2px primary-light 外发光
- 错误态：边框色变 `var(--color-danger)`

### C5: 筛选栏 (FilterBar)

- 布局：flex 行，间距 `var(--space-2)`
- 选项按钮组（全部/todo/in-progress/done）
- 当前选中项：主色背景白字
- 未选中项：surface 背景 secondary 文字

### C6: 排序选择器 (SortSelector)

- 布局：flex 行，`var(--space-4)` 间距
- 标签 + 下拉 `<select>` 组合

## Key Decisions

### D1: 通信方式 — CORS 跨域
- **Context**: 前端和后端独立运行在不同端口
- **Decision**: API 添加 CORS 响应头，前端通过 fetch 跨域访问
- **Reasoning**: 前后端分离开发更灵活，demo 项目常见模式
- **Consequences**: 需修改 server.ts 或 routes.ts 添加 CORS 头

### D2: Preact + htm via CDN
- **Context**: 零构建步骤需求
- **Decision**: 通过 esm.sh CDN import Preact + htm
- **Reasoning**: htm 提供类 JSX 标签模板语法，无需编译步骤
- **Consequences**: 需要 Import Map 或 CDN URL 直接 import

### D3: 状态管理 — Preact useState
- **Context**: 简单 CRUD 列表应用
- **Decision**: 使用 Preact 内置 useState hook
- **Reasoning**: 无需外部状态管理库，Ponytail 阶梯第 3 级（平台原生特性）
- **Consequences**: 状态在组件树顶层管理，props drilling 到子组件

### D4: 视觉风格 — 现代极简 (Notion/Linear)
- **Context**: demo 需要专业美观的界面
- **Decision**: 圆角、柔和阴影、Indigo 主色调、大留白
- **Reasoning**: 用户明确选择现代极简风格
- **Consequences**: CSS 实现需要精心调整细节

## Build Layers

### Layer 0: HTML 骨架 + CSS 设计令牌
- `public/index.html` — HTML 模板和 CDN import map
- `public/styles.css` — CSS 变量（设计令牌）和全局样式

### Layer 1: Preact 组件骨架
- `public/app.js` — 根组件、状态管理、API 调用层

### Layer 2: 功能组件
- TaskList、TaskCard、TaskForm、FilterBar、SortSelector

### Layer 3: 交互逻辑
- CRUD 操作、筛选/排序状态同步、错误处理

### Layer 4: 集成与启动
- 修改 scripts/start.mjs 统一启动

## Enforcement

### ENF-1: 零运行时依赖
- 检查：package.json 不含前端框架依赖
- 方式：Preact 和 htm 通过 CDN import map 引入

### ENF-2: CORS 头
- 检查：API 响应包含 Access-Control-Allow-Origin: *
- 方式：在 sendJSON 或主路由中添加 CORS 头

### ENF-3: 响应式布局
- 检查：移动端 (<768px) 下卡片全宽、筛选栏纵向排列
- 方式：CSS media query

### ENF-4: design.md 驱动实现
- 检查：CSS 变量使用 design.md 中定义的设计令牌
- 方式：styles.css 中所有颜色/间距/字体值取自 CSS 自定义属性
