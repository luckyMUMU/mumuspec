# Build Plan: introduce-ua-design

> 模式: TDD (Red-Green-Refactor) | 方向: Bottom-Up (Layer 1 → Layer 0)

---

## Layer 1: 类型定义与核心函数（叶子层）

### Task 1.1: types.ts — 新增 7 个接口 [PONYAITL: 最小可工作实现]

- [x] **RED**: 编写类型测试 — 验证 ImpactAnalysis / LearningPath / CoverageReport 接口存在 ✅
- [x] **GREEN**: 在 `src/core/types.ts` 新增 11 个接口 ✅
- [x] **REFACTOR**: 接口导出正确，无循环依赖 ✅
- [x] **PONYAITL**: 所有字段必要，无过度设计（`distance` 用 number 而非 literal union；`by_type` 用 Record 支持任意类型） ✅

### Task 1.2: knowledge/manager.ts — analyzeImpact 函数

- [ ] **RED**: 编写测试 — 变更文件 → 关联知识预警
- [ ] **GREEN**: 实现 `analyzeImpact()` 函数
  - 获取 git diff 变更文件
  - 从 Reverse Index 查关联 Knowledge Page
  - BFS 扩展 3 跳（上限 1000 节点）
  - 生成 KnowledgeWarning
  - 组装 ImpactRecommendation
- [ ] **REFACTOR**: 提取公共逻辑（git diff 获取、BFS 遍历）
- [ ] **PONYAITL**: 降级逻辑是否最小化

### Task 1.3: knowledge/manager.ts — generateOnboardingPath 函数

- [ ] **RED**: 编写测试 — scope + role → 有序学习路径
- [ ] **GREEN**: 实现 `generateOnboardingPath()` 函数
  - 获取 scope 内代码节点
  - 计算入口节点（入度最小）
  - BFS 拓扑排序
  - 关联 Knowledge Page
  - 按角色过滤详细程度
- [ ] **REFACTOR**: 排序逻辑提取为独立函数
- [ ] **PONYAITL**: 降级模式（无 Code Graph）是否简洁

### Task 1.4: knowledge/manager.ts — analyzeCoverage 函数

- [ ] **RED**: 编写测试 — 覆盖率统计 + gaps 排序
- [ ] **GREEN**: 实现 `analyzeCoverage()` 函数
  - 获取 scope 内所有代码节点
  - 从 Reverse Index 获取已覆盖节点
  - 计算 uncovered 节点
  - importance = backwardRefCount × graphBindingsCount
  - 按 importance 降序排列 gaps
- [ ] **REFACTOR**: importance 计算提取为可配置策略
- [ ] **PONYAITL**: 默认公式是否足够

---

## Layer 0: CLI + Hook + MCP（根层）

### Task 0.1: cli.ts — impact 命令

- [ ] **RED**: 编写测试 — `mumuspec impact` 输出格式
- [ ] **GREEN**: 实现 `impact` 子命令
  - 参数: `--diff`, `--scope`, `--json`, `--with-knowledge`
  - 调用 `analyzeImpact()`
  - 终端 TUI 输出（面板样式）
  - JSON 输出模式
- [ ] **REFACTOR**: 输出格式化提取为独立模块
- [ ] **PONYAITL**: 参数是否最小必要

### Task 0.2: cli.ts — onboard 命令族

- [ ] **RED**: 编写测试 — `mumuspec onboard init/start/next/complete-step/progress`
- [ ] **GREEN**: 实现 5 个 onboard 子命令
  - `init`: 生成学习路径 YAML
  - `start`: 终端交互 UI
  - `next`: 前进到下一步
  - `complete-step`: 标记步骤完成
  - `progress`: 显示学习进度
- [ ] **REFACTOR**: 交互 UI 逻辑提取为独立模块
- [ ] **PONYAITL**: 子命令是否可合并（init+start?）

### Task 0.3: cli.ts — knowledge coverage / gaps / graph-export

- [ ] **RED**: 编写测试 — coverage/gaps/graph-export 输出
- [ ] **GREEN**: 实现 3 个 knowledge 子命令
  - `coverage`: 覆盖率统计面板
  - `gaps`: 未覆盖节点列表
  - `graph-export`: 导出 UA 风格 JSON
- [ ] **REFACTOR**: 复用 coverage 逻辑
- [ ] **PONYAITL**: graph-export 是否可集成到现有命令

### Task 0.4: hooks/guard.ts — post-commit 增量更新

- [ ] **RED**: 编写测试 — post-commit 刷新 verified_at
- [ ] **GREEN**: 实现 `postCommitKnowledgeUpdate()` 函数
  - 获取 HEAD~1..HEAD 变更文件
  - 从 Reverse Index 查受影响页面
  - 刷新 verified_at（< 500ms）
  - 超时保护 + 队列写入
- [ ] **REFACTOR**: 超时逻辑提取为装饰器
- [ ] **PONYAITL**: 500ms 超时是否合理

### Task 0.5: hooks/guard.ts — Knowledge-Impact 提交消息解析

- [ ] **RED**: 编写测试 — 解析 IMPLEMENTS/AFFECTS/SUPERSEDES
- [ ] **GREEN**: 实现 `parseKnowledgeImpact()` 函数
  - 正则匹配 Knowledge-Impact 块
  - 解析为结构化数据
  - SUPERSEDES 时 block 提交
  - 结果写入 .commit-context.json
- [ ] **REFACTOR**: 正则提取为常量
- [ ] **PONYAITL**: 解析逻辑是否最小化

### Task 0.6: mcp-server.ts — 5 个新 MCP 工具

- [ ] **RED**: 编写测试 — MCP 工具注册和调用
- [ ] **GREEN**: 实现 5 个 MCP 工具
  - `analyze_impact`
  - `generate_onboarding_path`
  - `get_knowledge_coverage`
  - `find_knowledge_gaps`
  - `detect_decision_deviation`
- [ ] **REFACTOR**: 工具定义提取为配置对象
- [ ] **PONYAITL**: 工具粒度是否合适

### Task 0.7: config.yaml schema 扩展

- [ ] **RED**: 编写测试 — 新配置项验证
- [ ] **GREEN**: 扩展 config schema
  - `knowledge.commit_update.*`
  - `knowledge.commit_message.*`
  - `knowledge.coverage.*`
- [ ] **REFACTOR**: 配置验证逻辑复用
- [ ] **PONYAITL**: 配置项是否最小必要

---

## Layer 2: Chat & Dashboard (新增)

### Task 1.5: answerQuery 函数 — Chat 核心

- [x] **RED**: 编写测试 — answerQuery 返回 ChatAnswer ✅
- [x] **GREEN**: 实现 `answerQuery()` 函数 ✅
  - 获取全部 Knowledge Pages
  - 计算相关性分数（ID/标题/内容/标签匹配）
  - 排序取 Top 5
  - 组装 answer 文本
  - 确定 confidence
- [x] **REFACTOR**: 分数计算提取为独立函数 ✅
- [x] **PONYAITL**: 关键词匹配，无 LLM 依赖 ✅

### Task 1.6: getDashboardData 函数 — Dashboard 增强

- [x] **RED**: 编写测试 — getDashboardData 返回完整 DashboardData ✅
- [x] **GREEN**: 实现 `getDashboardData()` 函数 ✅
  - 获取 Knowledge Pages + stale + coverage
  - 提取 Goals (tags: goal/vision/milestone)
  - 提取 Roadmap (tags: roadmap)
  - 生成 Alerts
- [x] **REFACTOR**: 标签提取逻辑复用 ✅
- [x] **PONYAITL**: 复用已有数据，无新存储格式 ✅

### Task 0.8: chat CLI 命令

- [x] **GREEN**: 实现 `mumuspec chat` 命令 ✅
  - 直接查询模式
  - 交互模式
  - `--json` 输出
  - 终端面板样式
- [x] **PONYAITL**: 支持 query 参数 + 交互模式 ✅

### Task 0.9: dashboard 命令增强

- [x] **GREEN**: 扩展 `mumuspec dashboard` ✅
  - 使用 getDashboardData()
  - 增加 Coverage 面板
  - 增加 Goals 面板
  - 增加 Roadmap 面板
  - 增加 Alerts 面板
- [x] **PONYAITL**: 保持向后兼容 ✅

### Task 0.10: query_knowledge MCP 工具

- [x] **GREEN**: 实现 `query_knowledge` MCP 工具 ✅
  - 注册工具定义
  - 实现 handler 调用 answerQuery()
- [x] **PONYAITL**: 工具单一职责 ✅

---

## 执行顺序（Bottom-Up）

```
Layer 1 (叶子)
  ├── Task 1.1 types.ts
  ├── Task 1.2 analyzeImpact
  ├── Task 1.3 generateOnboardingPath
  ├── Task 1.4 analyzeCoverage
  ├── Task 1.5 answerQuery (Chat)
  └── Task 1.6 getDashboardData (Dashboard)

Layer 0 (根)
  ├── Task 0.1 impact 命令
  ├── Task 0.2 onboard 命令族
  ├── Task 0.3 coverage/gaps/graph-export
  ├── Task 0.4 post-commit hook
  ├── Task 0.5 Knowledge-Impact 解析
  ├── Task 0.6 MCP 工具 (5 个)
  ├── Task 0.7 config schema
  ├── Task 0.8 chat 命令
  ├── Task 0.9 dashboard 增强
  └── Task 0.10 query_knowledge MCP 工具
```

---

## Ponytail 检查清单

每层实现后检查：
- [ ] YAGNI — 代码是否需要存在？
- [ ] 复用 — 是否有已有实现可复用？
- [ ] 标准库 — 标准库是否已提供？
- [ ] 平台特性 — 平台原生特性是否支持？
- [ ] 已有依赖 — 已安装的依赖是否能做？
- [ ] 一行代码 — 能否一行写完？
- [ ] 最小可工作 — 是否仅写必要的代码？
