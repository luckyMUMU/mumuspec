---
id: KE-build-frontend-patterns
title: Architecture patterns from build-frontend
type: pattern
status: confirmed
scope: build-frontend
created_at: 2026-08-01
tags:
  - auto-extracted
  - pattern
  - architecture
  - build-frontend
graph_bindings: []
---
> Auto-extracted from build-frontend/design.md

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
--weight-normal: