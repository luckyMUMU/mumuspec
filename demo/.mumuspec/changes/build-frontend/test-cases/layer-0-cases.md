# Layer 0 Test Cases — HTML 骨架 + CSS 设计令牌

## TC-0-001: HTML 入口文件存在且包含必要元素

- **Given**: `public/index.html` 被请求
- **Then**: 返回 HTML 文档，包含：
  - DOCTYPE 声明
  - lang 属性设置为 zh-CN
  - viewport meta 标签（响应式）
  - 挂载点 `<div id="app"></div>`
  - Import map 引入 Preact 和 htm

## TC-0-002: CSS 设计令牌定义完整

- **Given**: `public/styles.css` 被加载
- **Then**: 包含所有 design.md 中定义的设计令牌：
  - 颜色系统（primary/neutral/semantic）
  - 排版系统（font-family/scale/weight/line-height）
  - 间距系统（space-1 到 space-12）
  - 圆角与阴影（radius-* / shadow-*）

## TC-0-003: 响应式布局基础

- **Given**: 视口宽度 < 768px
- **Then**: 容器 max-width 变为 100%，padding 缩小，卡片单列排列

## TC-0-004: 浏览器兼容性

- **Given**: 现代浏览器（Chrome/Firefox/Safari 最近 2 个版本）
- **Then**: 应用正常渲染，CSS 变量和 flexbox 被正确解析
