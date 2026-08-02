---
scope: .
layer: 0
last_updated: "2026-08-02"
---

# 前端设计风格: MumuSpec

> MumuSpec 主体是 CLI 工具，但 demo 项目（demo/image-share）包含 Web UI。
> 本文件为项目中任何前端工作提供设计指导。

## 设计理念

- **简洁优先** — UI 是工具的延伸，不是主角；功能清晰胜过视觉炫技
- **内容驱动** — 布局围绕内容组织，不为了布局而创造内容
- **渐进增强** — 核心功能不依赖 JavaScript，JS 层仅增强体验
- **零框架偏好** — 能用原生 HTML/CSS 实现就不引入前端框架（ponytail: 零运行时依赖偏好）

## 配色方案

| 语义 | 色值 | 用途 |
|------|------|------|
| Primary | `#2563eb` (blue-600) | 主操作按钮、活跃链接 |
| Success | `#16a34a` (green-600) | 成功状态、完成提示 |
| Warning | `#d97706` (amber-600) | 警告信息、待处理项 |
| Danger | `#dc2626` (red-600) | 错误状态、删除操作 |
| Background | `#f8fafc` (slate-50) | 页面背景 |
| Surface | `#ffffff` | 卡片、面板背景 |
| Text Primary | `#0f172a` (slate-900) | 主文本 |
| Text Secondary | `#64748b` (slate-500) | 辅助文本 |

## 组件风格

### 按钮
- 主按钮：Primary 色背景 + 白色文字 + 8px 圆角 + 0.5rem 垂直内边距
- 次要按钮：透明背景 + 1px Primary 色边框
- 危险按钮：Danger 色背景 + 白色文字
- 禁用状态：`opacity: 0.5` + `cursor: not-allowed`

### 卡片
- 白色背景 + 1px slate-200 边框 + 12px 圆角 + 1rem 内边距
- 阴影仅在有交互意图时出现：`box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)`

### 表单
- 输入框：1px slate-300 边框 + 8px 圆角 + 0.5rem 内边距
- Focus 状态：2px Primary 色 outline
- Label 在输入框上方，14px font-size，font-weight: 500

### 列表与表格
- 行高 48px，斑马纹可选（偶数行 slate-50 背景）
- 操作列右对齐，状态列居中

## 交互模式

### 反馈
- 操作成功：Toast 通知（绿色，3 秒自动消失）
- 操作失败：Toast 通知（红色，需手动关闭）
- 加载中：Skeleton 占位或 spinner（不阻塞 UI）

### 导航
- 顶部导航栏：固定高度 56px，白色背景 + 底部 1px 边框
- 面包屑：显示当前路径层级，每级可点击

### 表单提交
- 提交前客户端校验，错误信息显示在字段下方（Danger 色文字）
- 提交按钮在请求期间显示 loading 状态并禁用

## 响应式设计

| 断点 | 宽度 | 布局调整 |
|------|------|---------|
| Mobile | < 640px | 单列布局，导航折叠为汉堡菜单 |
| Tablet | 640px - 1024px | 双列布局，导航可见 |
| Desktop | > 1024px | 多列布局，完整导航 |

通用规则：
- 内容区域最大宽度 1280px，居中
- 间距使用 4px 基准网格（4px / 8px / 12px / 16px / 24px / 32px）
- 触摸目标最小尺寸 44x44px（移动端）
- 图片必须设置 `max-width: 100%` + `height: auto`
