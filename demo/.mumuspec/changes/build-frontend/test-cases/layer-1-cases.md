# Layer 1 Test Cases — Preact 组件骨架 + 状态管理

## TC-1-001: Preact 应用挂载

- **Given**: 页面加载 `public/index.html`
- **Then**: Preact.render() 成功将根组件挂载到 `#app`

## TC-1-002: 初始状态为空列表

- **Given**: 应用首次加载
- **Then**: 任务列表为空，显示空状态提示「暂无任务，创建第一个任务吧」

## TC-1-003: API 数据加载

- **Given**: API 服务正常运行（有 2 个测试任务）
- **When**: 应用挂载后 fetch GET /tasks
- **Then**: 成功获取任务数据并渲染到列表中

## TC-1-004: 状态筛选状态机

- **Given**: 应用已加载任务数据
- **When**: 点击状态筛选按钮「in-progress」
- **Then**: 列表仅显示 status 为 in-progress 的任务

## TC-1-005: 排序切换

- **Given**: 应用已加载任务数据
- **When**: 切换排序方式为「按时间降序」
- **Then**: 任务列表按 createdAt 降序重新排列
