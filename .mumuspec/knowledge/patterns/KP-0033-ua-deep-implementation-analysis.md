---
# === 标识 ===
id: "KP-0033"
title: "Understand-Anything 深入分析：可落地的实现方案设计"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-30T00:00:00Z"
updated_at: "2026-07-30T00:00:00Z"

# === 来源 ===
source_change: "sync-spec-knowledge-base"
source_phase: "design"
source_artifact: "KP-0029-understand-anything-design-borrowing.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["understand-anything", "implementation", "knowledge-graph", "onboarding", "impact-analysis", "git-knowledge"]
related_pages:
  - "KP-0006"
  - "KP-0028"
  - "KP-0029"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q3"
  reasoning_chain: ["KP-0029"]
  confidence: high
---

## 背景

本文档是 KP-0029（设计理念借鉴）的**实现层深入分析**。基于 MumuSpec 现有代码结构（knowledge/manager.ts、cli.ts、hooks/guard.ts）和 Understand-Anything 的设计理念，给出可直接落地的数据结构设计、算法流程和 CLI 接口定义。

---

## 1. 增强设计 A：Diff 影响分析 + 知识预警

### 1.1 现状分析

MumuSpec 当前已有：
- `mumuspec search` — 搜索 Spec 节点
- `knowledge verify` — 验证知识新鲜度
- `knowledge context` — 获取路径相关的知识上下文

缺失：
- 分析 Working Directory 未提交变更对代码结构的影响
- 将影响范围与已有 Knowledge Page 关联
- 提供预警和建议

### 1.2 数据结构设计

```yaml
# .mumuspec/changes/<name>/impact-analysis.yaml (新增)
impact_analysis:
  generated_at: "2026-07-30T10:00:00Z"
  scope: "."
  
  changed_files:
    - path: "src/services/payment.service.ts"
      change_type: modified  # added | modified | deleted
      lines_changed: 45
    
  direct_impact:
    - node: "src/services/payment.service.ts"
      node_type: Function
      dependents:
        - "src/api/payment.routes.ts"
        - "src/services/order.service.ts"
      impacted_specs:
        - id: "PAY-001"
          shall: "所有支付操作必须实现补偿回滚"
      impacted_knowledge:
        - id: "KP-0007"
          type: decision
          title: "支付模块使用 Saga 分布式事务模式"
          risk: "修改可能影响补偿事务边界"
          severity: high
    
  indirect_impact:
    - node: "src/jobs/reconciliation.job.ts"
      distance: 2
      path: "payment.service → order.service → reconciliation.job"
      risk: "对账作业依赖订单数据一致性"
      severity: low
    
  knowledge_warnings:
    - knowledge_id: "KP-0007"
      warning_type: "SCOPE_OVERLAP"
      message: "本次修改范围与已确认决策「KP-0007: Saga 模式」重叠"
      suggestion: "确认修改不影响补偿事务的完整性"
    
    - knowledge_id: "KP-0020"
      warning_type: "RISK_AMPLIFY"
      message: "本次修改可能加剧已知风险「KP-0020: 并发幂等性」"
      suggestion: "建议增加幂等性测试用例"
  
  recommendations:
    regression_scope: ["payment.service", "order.service", "reconciliation.job"]
    review_focus: ["补偿事务边界", "幂等性保证"]
    knowledge_pages_to_review: ["KP-0007", "KP-0020"]
```

### 1.3 核心算法流程

```
算法: analyzeImpact(projectRoot, config, options)
输入: projectRoot, config, diffRange (默认 working tree)
输出: ImpactAnalysis

1. 获取变更文件列表
   changedFiles = git diff --name-only [diffRange]
   
2. 对每个变更文件，从 Reverse Index 查找关联知识
   for each file in changedFiles:
     normalizedPath = normalize(file)  # src/services/payment.service.ts
     relatedPages = reverseIndex.lookup(normalPath)
     for each page in relatedPages:
       warnings += generateWarning(page, file)
       
3. 对每个关联知识，查找直接依赖代码
   for each page in relatedPages:
     boundNodes = page.graph_bindings
     for each node in boundNodes:
       dependents = codeGraph.getDependents(node)  # CALLS, IMPORTS
       directImpact += dependents
       
4. BFS 扩展 2 跳，获取间接影响
   indirectImpact = bfs(directImpact, maxDepth=2)
   
5. 去重 + 严重度排序
   allImpacts = deduplicate(directImpact + indirectImpact)
   sortBySeverity(allImpacts)
   
6. 生成回归范围建议
   regressionScope = computeTestScope(allImpacts)
   
7. 组装输出
   return ImpactAnalysis {
     changedFiles, directImpact, indirectImpact,
     knowledgeWarnings, recommendations
   }
```

### 1.4 CLI 接口设计

```bash
# 基础用法：分析当前未提交变更
mumuspec impact

# 分析指定 diff 范围
mumuspec impact --diff HEAD~3..HEAD
mumuspec impact --diff feature/payment..main

# 仅分析特定 scope
mumuspec impact --scope src/payment

# JSON 输出（供 CI/MCP 使用）
mumuspec impact --json

# 与知识关联分析
mumuspec impact --with-knowledge
```

输出示例（终端 TUI）：

```
╔══════════════════════════════════════════════════════════╗
║                   IMPACT ANALYSIS                        ║
╚══════════════════════════════════════════════════════════╝

Changed Files (L+/-): src/services/payment.service.ts (45+/-)

┌─── Direct Impact ───────────────────────────────────────┐
│ src/api/payment.routes.ts     [IMPORTS]                  │
│ src/services/order.service.ts [CALLS: processOrder]     │
└─────────────────────────────────────────────────────────┘

┌─── Knowledge Warnings ──────────────────────────────────┐
│ ⚠ KP-0007 [Saga 决策] — 修改可能影响补偿事务边界        │
│ ⚠ KP-0020 [并发风险] — 建议增加幂等性测试               │
└─────────────────────────────────────────────────────────┘

┌─── Recommendations ─────────────────────────────────────┐
│ Regression: payment, order, reconciliation               │
│ Review: 补偿事务边界, 幂等性保证                         │
│ Knowledge: 需要审查 KP-0007, KP-0020                    │
└─────────────────────────────────────────────────────────┘
```

### 1.5 与现有代码的集成点

| 现有模块 | 集成方式 |
|---------|---------|
| `knowledge/manager.ts` | 新增 `analyzeImpact()` 函数，利用 `rebuildReverseIndex()` 数据 |
| `cli.ts` | 在已有的 `impact` 子命令位置扩展（当前无 impact 命令，新增） |
| `hooks/guard.ts` | pre-commit hook 可调用 impact 分析，high severity 则 block |
| `guard/checker.ts` | `detectDrift()` 增加 impact-based drift 检测 |
| `mcp-server.ts` | 新增 `analyze_impact` MCP 工具 |

---

## 2. 增强设计 B：Onboarding 引导式学习路径

### 2.1 现状分析

MumuSpec 已有 `knowledge context` 返回路径相关的知识页面。但缺少：
- 基于代码拓扑的学习路径排序
- 引导式的新成员浏览体验
- 学习进度的持久化

### 2.2 学习路径数据模型

```typescript
// types.ts 新增
export interface LearningPath {
  scope: string;                    // 学习路径的代码范围
  generated_at: string;
  generated_for: string;            // 角色: junior | mid | senior | pm
  steps: LearningStep[];
  total_steps: number;
  estimated_minutes: number;
}

export interface LearningStep {
  order: number;                    // 1-based
  code_node: string;                // 代码节点 (如 src/api/routes.ts)
  code_node_type: 'File' | 'Function' | 'Class' | 'Module';
  reason: string;                   // 为什么按这个顺序学
  knowledge_pages: string[];        // 关联的知识页面 ID
  learning_objectives: string[];    // 本步骤应理解什么
  check_questions: string[];        // 自检问题
  next_step_condition: string;      // 满足什么条件进入下一步
}
```

### 2.3 拓扑排序算法

```
算法: generateLearningPath(projectRoot, config, scope, role)
输入: projectRoot, config, scope 路径, role 角色
输出: LearningPath

1. 构建 scope 内的代码子图
   subGraph = codeGraph.getSubgraph(scope)
   nodes = subGraph.getNodes()   # Files, Functions, Classes
   edges = subGraph.getEdges()   # CALLS, IMPORTS, IMPLEMENTS
   
2. 确定入口节点（入度为 0 或入度最小的节点）
   entryNodes = nodes.filter(inDegree == 0)
   if entryNodes.empty:
     entryNodes = nodes.topK(minInDegree, k=3)
   
3. 从入口节点开始 BFS，按层遍历
   queue = entryNodes
   visited = Set()
   order = 0
   while queue not empty:
     current = queue.dequeue()
     if current in visited: continue
     visited.add(current)
     order++
     
     step = {
       order,
       code_node: current.path,
       reason: generateReason(current, role),  # LLM 生成
       knowledge_pages: reverseIndex.lookup(current.path),
       learning_objectives: generateObjectives(current, role),
     }
     path.steps.push(step)
     
     for each neighbor in subGraph.getNeighbors(current):
       if neighbor not in visited:
         queue.enqueue(neighbor)
   
4. 后处理
   path.total_steps = path.steps.length
   path.estimateMinutes = path.total_steps * ESTIMATES[role]
   
5. 持久化
   saveTo(.mumuspec/onboarding/<scope>-<role>.yaml)
```

### 2.4 CLI 接口

```bash
# 生成学习路径
mumuspec onboard init --scope src/payment --role junior

# 交互式浏览（终端 UI）
mumuspec onboard start --scope src/payment

# 标记步骤完成
mumuspec onboard complete-step 3 --scope src/payment

# 显示进度
mumuspec onboard progress --scope src/payment

# 推荐下一步
mumuspec onboard next --scope src/payment
```

### 2.5 交互式终端 UI 设计

```
Onboarding: src/payment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Step 3 of 8                      Progress: ████░░░░ 37%

┌─────────────────────────────────────────────────────────┐
│ src/api/payment.routes.ts                               │
│                                                         │
│ 📖 Why this order:                                      │
│    HTTP 是所有支付请求的入口，理解路由是理解支付流程的     │
│    第一步。后续 Service 层调用都从这里开始。              │
│                                                         │
│ 🎯 Learning objectives:                                 │
│    • 理解支付路由如何注册到 Express                      │
│    • 了解中间件链 (auth → validate → handler)           │
│    • 找出所有支付相关端点                                │
│                                                         │
│ 📚 Related knowledge:                                   │
│    • KP-0001: RESTful 路由命名规范                      │
│    • KP-0011: 中间件链式调用模式                         │
│                                                         │
│ ❓ Check yourself:                                      │
│    • POST /refund 会经过哪些中间件？                     │
│    • 路由如何委托给 Service 层？                         │
└─────────────────────────────────────────────────────────┘

  [n]ext  [p]revious  [o]pen file  [k]nowledge  [q]uit
  Choice: _
```

### 2.6 集成点

```yaml
# Open 阶段增强配置
# .mumuspec/onboarding-config.yaml
onboarding:
  enabled: true
  auto_generate_for_new_scope: true
  role_detection: auto  # 自动从 git history 推断角色
  storage_dir: .mumuspec/onboarding
  
  # 学习路径生成参数
  generation:
    max_steps_per_path: 20
    knowledge_density: medium  # low: 每3步关联知识, medium: 每步, high: 多知识交叉
    include_code_snippets: true
    snippet_max_lines: 10
    
  # 进度追踪
  progress:
    persist: true
    tracking_mode: manual  # manual | auto-detect (基于文件浏览记录)
```

---

## 3. 增强设计 C：Git 历史知识提取 + 增量更新

### 3.1 现状分析

MumuSpec 当前已有：
- `knowledge/auto_extract_on_archive: true` — Archive 阶段自动提取
- `knowledge/auto_index_on_commit: true` — commit 自动索引代码图谱
- `hooks/guard.ts` 安装 pre-commit/post-merge/post-checkout 钩子

缺失：
- 从提交消息中提取知识关联
- 增量 Knowledge Page 新鲜度更新（提交时）
- 代码偏离决策的自动检测

### 3.2 Post-Commit Hook 知识增量更新

```typescript
// hooks/guard.ts 新增函数

/** post-commit hook 触发的知识增量更新 */
export function postCommitKnowledgeUpdate(projectRoot: string): {
  updatedPages: string[];
  stalePages: string[];
  newDeviations: string[];
} {
  // 1. 获取上一次 commit 到本次 commit 的变更文件
  const changedFiles = gitDiffFiles(projectRoot, 'HEAD~1', 'HEAD');
  
  // 2. 从 Reverse Index 查找受影响的知识页面
  const affectedPages: KnowledgePage[] = [];
  for (const file of changedFiles) {
    const normalizedPath = normalizePath(file);
    const pageIds = reverseIndex.lookup(normalizedPath);
    for (const id of pageIds) {
      const page = getKnowledgePage(projectRoot, config, id);
      if (page) affectedPages.push(page);
    }
  }
  
  // 3. 去重
  const uniquePages = deduplicateById(affectedPages);
  
  const result = {
    updatedPages: [],
    stalePages: [],
    newDeviations: [],
  };
  
  // 4. 对每个受影响的 Knowledge Page，执行增量验证
  for (const page of uniquePages) {
    // 4a. 获取本次 commit 中该页面关联代码节点的 diff
    const codeNodes = page.frontmatter.graph_bindings || [];
    const nodeDiffs = getDiffForNodes(projectRoot, codeNodes, 'HEAD~1', 'HEAD');
    
    if (nodeDiffs.length === 0) continue;  // 本次 commit 未影响该页面关联代码
    
    // 4b. LLM 增量分析：变更是否偏离了已有决策
    const deviation = analyzeDeviation(page, nodeDiffs);
    
    if (deviation.isDeviation) {
      // 决策偏离：标记 stale + 创建警告
      markPageStale(page.id);
      result.stalePages.push(page.frontmatter.id);
      result.newDeviations.push(deviation.description);
    } else {
      // 正常更新：刷新 verified_at
      updateVerifiedAt(page.id, new Date());
      result.updatedPages.push(page.frontmatter id);
    }
  }
  
  return result;
}
```

### 3.3 提交消息知识关联语法

```
# 提交消息格式增强（非强制，但支持解析）

feat(payment): add refund Saga compensation

# 可选块：Knowledge-Impact（被 mumuspec hooks run commit-msg 解析）
Knowledge-Impact:
  VERIFY:        # 此次实现验证了某个知识页面
    - KP-0007   # Saga 模式决策
  IMPLEMENTS:    # 实现了某个决策的要求
    - KP-0012   # 幂等模式
  AFFECTS:       # 可能影响某个知识
    - KP-0020   # 并发风险
  SUPERSEDES:    # 替代了旧知识（需要确认）
    - KP-0008   # (old) 同步补偿模式
  
Refs: PAY-001, PAY-NOT-003
```

### 3.4 Hook 处理流程

```
commit-msg hook:
1. 读取提交消息
2. 解析 Knowledge-Impact 块
3. 如果包含 SUPERSEDES，block 并提示用户创建变更
4. 将 Knowledge-Impact 信息写入 .mumuspec/knowledge/.commit-context.json

post-commit hook:
1. 读取 .commit-context.json
2. 对 VERIFY 列表：updateVerifiedAt(页面ID, commit时间)
3. 对 AFFECTS 列表：触发 deviations 检测
4. 清除 .commit-context.json
```

### 3.5 配置扩展

```yaml
# .mumuspec.yaml 或 config.yaml 新增
knowledge:
  # ... 现有配置
  
  # 提交时增量更新
  commit_update:
    enabled: true
    mode: incremental  # incremental | full
    auto_verify_on_implement: true  # 实现某个决策时自动刷新 verified_at
    block_on_deviation: false       # 偏离决策时是否 block（默认 warn）
    deviation_notify: true          # 偏离时通知
    
  # 提交消息解析
  commit_message:
    parse_knowledge_impact: true
    require_refs_on_decision_change: true  # 修改决策相关代码需要 Refs
    
  # 图谱 JSON 版本化
  version_graph:
    format: json
    output: .mumuspec/knowledge/knowledge-graph.json
    commit_on_update: false  # 是否自动 commit
```

### 3.6 知识图谱 JSON 格式（可提交 Git）

```json
// .mumuspec/knowledge/knowledge-graph.json
{
  "version": "1.0",
  "generated_at": "2026-07-30T10:00:00Z",
  "generator": "mumuspec@0.13.0",
  "nodes": [
    {
      "id": "KP-0007",
      "type": "decision",
      "title": "支付模块使用 Saga 分布式事务模式",
      "scope": "src/payment",
      "status": "confirmed",
      "verified_at": "2026-07-30T09:30:00Z",
      "bindings": ["src/payment/processPayment", "src/payment/compensatePayment"]
    }
  ],
  "edges": [
    {
      "type": "DECIDED_BY",
      "from": "src/payment/processPayment",
      "to": "KP-0007"
    },
    {
      "type": "SUPERSEDES",
      "from": "KP-0008",
      "to": "KP-0007"
    }
  ]
}
```

---

## 4. 增强设计 D：知识覆盖度分析

### 4.1 问题

当前 MumuSpec 没有机制来回答："哪些代码还没有被任何知识页面覆盖？"

### 4.2 数据模型

```typescript
export interface CoverageReport {
  scope: string;
  generated_at: string;
  
  // 按代码粒度的覆盖情况
  coverage: {
    total_code_nodes: number;         // 代码节点总数
    covered_nodes: number;            // 有知识关联的节点数
    coverage_ratio: number;           // 覆盖率 0.0-1.0
    
    by_type: {
      Function: { total: number; covered: number };
      Class: { total: number; covered: number };
      Module: { total: number; covered: number };
      File: { total: number; covered: number };
    };
  };
  
  // 未覆盖的重要代码（按重要度排序）
  gaps: CoverageGap[];
  
  // 知识过载（多个知识页面关联同一节点）
  overloads: KnowledgeOverload[];
}

export interface CoverageGap {
  node: string;           // 代码节点 ID
  node_type: string;      // Function | Class | Module
  importance: number;     // 重要度评分 (基于入度、调用频率)
  reason: string;         // 为什么重要
  suggested_type: string; // 建议补充的知识类型
}
```

### 4.3 算法

```
算法: analyzeCoverage(projectRoot, config, scope?)
输入: projectRoot, config, scope 路径（可选，默认全部）
输出: CoverageReport

1. 获取 scope 内所有代码节点
   allNodes = codeGraph.getNodes(scope)
   
2. 获取 scope 内所有 Knowledge Pages
   pages = listKnowledgePages(projectRoot, config, { scope })
   
3. 构建已覆盖节点集合
   coveredSet = Set()
   for each page in pages:
     for each binding in page.graph_bindings:
       coveredSet.add(binding)
       
4. 计算覆盖率
   coverageRatio = coveredSet.size / allNodes.size
   
5. 标识未覆盖的重要节点
   uncovered = allNodes - coveredSet
   for each node in uncovered:
     importance = computeImportance(node)  # 入度 × 调用频率
     if importance > THRESHOLD:
       gaps.push({
         node: node.id,
         importance,
         reason: generateReason(node),
         suggested_type: suggestKnowledgeType(node),
       })
   
6. 知识过载检测
   for each node in coveredSet:
     pages_count = reverseIndex.count(node)
     if pages_count > OVERLOAD_THRESHOLD:
       overloads.push({ node, pages_count })
```

### 4.4 CLI 接口

```bash
# 全量覆盖率分析
mumuspec knowledge coverage

# 指定 scope
mumuspec knowledge coverage --scope src/payment

# 列出缺口（未覆盖的重要代码）
mumuspec knowledge gaps --scope src/payment --min-importance 5

# 导出报告
mumuspec knowledge coverage --json > coverage-report.json
```

输出示例：

```
Knowledge Coverage Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall: 73 / 120 nodes covered (60.8%)

By Type:
  Function:  45/80  (56.3%)  ████████████░░░░░░░░
  Class:     15/20  (75.0%)  ███████████████░░░░░
  Module:    13/20  (65.0%)  █████████████░░░░░░░

┌─── Top Coverage Gaps ───────────────────────────────────┐
│ 1. src/payment/reconciliateBatch (importance: 9.2)      │
│    Reason: 核心对账函数，无知识页面记录设计理由          │
│    Suggest: 补充 rationale 类型知识页面                  │
│                                                         │
│ 2. src/payment/archiveOldTransactions (importance: 7.1) │
│    Reason: 数据归档策略，无决策记录                      │
│    Suggest: 补充 decision 类型知识页面                   │
└─────────────────────────────────────────────────────────┘

┌─── Knowledge Overloads ─────────────────────────────────┐
│ src/api/routes.ts: 7 knowledge pages (建议合并)         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 综合 CLI 命令扩展汇总

```bash
# === 现有知识命令（扩展） ===
mumuspec knowledge list [--type] [--scope]
mumuspec knowledge show <id>
mumuspec knowledge search <keyword> [--tag] [--type]
mumuspec knowledge context <path>
mumuspec knowledge verify [--id] [--all]
mumuspec knowledge stale
mumuspec knowledge supersede <id> --by <newId>

# === 新增命令 ===
# Onboarding
mumuspec onboard init --scope <path> [--role junior|mid|senior|pm]
mumuspec onboard start --scope <path>
mumuspec onboard next --scope <path>
mumuspec onboard complete-step <n> --scope <path>
mumuspec onboard progress --scope <path>

# Impact Analysis
mumuspec impact [--diff <range>] [--scope <path>] [--json] [--with-knowledge]

# Knowledge Coverage
mumuspec knowledge coverage [--scope <path>] [--json]
mumuspec knowledge gaps --scope <path> [--min-importance <n>]

# Dashboard（浏览器）
mumuspec graph serve [--port 3000]
mumuspec dashboard              # 已有：文本面板，可扩展为浏览器
```

---

## 6. MCP 工具扩展

```typescript
// mcp-server.ts 新增工具

const MCP_TOOLS = {
  // ... 现有工具
  
  // 影响分析
  analyze_impact: {
    name: 'analyze_impact',
    description: 'Analyze impact of uncommitted changes with knowledge correlation',
    inputSchema: {
      type: 'object',
      properties: {
        diff_range: { type: 'string', description: 'Git diff range (e.g., "HEAD~3..HEAD")' },
        scope: { type: 'string', description: 'Limit to scope path' },
        include_knowledge_warnings: { type: 'boolean', default: true },
      },
    },
  },
  
  // Onboarding
  generate_onboarding_path: {
    name: 'generate_onboarding_path',
    description: 'Generate a learning path for a codebase scope',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', required: true },
        role: { type: 'string', enum: ['junior', 'mid', 'senior', 'pm'] },
      },
    },
  },
  
  // 知识覆盖度
  get_knowledge_coverage: {
    name: 'get_knowledge_coverage',
    description: 'Get knowledge coverage statistics for a scope',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string' },
      },
    },
  },
  
  // 知识缺口
  find_knowledge_gaps: {
    name: 'find_knowledge_gaps',
    description: 'Find important code nodes without knowledge coverage',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string' },
        min_importance: { type: 'number', default: 5 },
      },
    },
  },
  
  // 决策偏离检测
  detect_decision_deviation: {
    name: 'detect_decision_deviation',
    description: 'Detect if code changes deviate from confirmed decisions',
    inputSchema: {
      type: 'object',
      properties: {
        changed_files: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};
```

---

## 7. 实施路径

### Sprint 1（2 周）：Diff 影响分析 + 知识预警

1. 在 `knowledge/manager.ts` 中新增 `analyzeImpact()` 函数
2. 在 `cli.ts` 中新增 `mumuspec impact` 命令
3. 知识关联：利用现有 `reverseIndex` 数据
4. 测试 + 文档

### Sprint 2（1 周）：Post-Commit 增量更新

1. `hooks/guard.ts` 新增 `postCommitKnowledgeUpdate()`
2. 解析提交消息的 Knowledge-Impact 块
3. `commit-msg` hook 集成

### Sprint 3（2 周）：Onboarding 路径

1. 拓扑排序算法实现
2. 终端交互 UI
3. 进度持久化

### Sprint 4（1 周）：知识覆盖度分析

1. 覆盖率统计算法
2. Gap 检测
3. `mumuspec knowledge coverage` 命令

---

## 影响

- Open 阶段的质量提升：变更提案会自动获得历史知识关联
- Archive 阶段的效率提升：增量更新取代全量验证
- 新人入职速度：引导式学习替代盲目阅读
- 知识维护成本：提交时自动刷新，减少手动 stale 检测

## 关联约束

- SHALL: `mumuspec impact` SHALL 关联已有 Knowledge Page 并生成 warnings
- SHALL: post-commit hook SHALL 增量更新受影响的 Knowledge Page verified_at
- SHALL: Coverage 报告 SHALL 标识 importance > THRESHOLD 的未覆盖节点
- SHALL NOT: 增量更新 SHALL NOT 需要重跑 LLM 分析流水线
- SHALL NOT: Onboarding SHALL NOT 阻塞正常开发工作流
