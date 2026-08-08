# MumuSpec 记忆/持久化层改进方案

> 创建日期: 2026-08-08
> 状态: Draft
> 参考来源: [TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory)

---

## 1. 背景与动机

当前 MumuSpec 的持久化由四层组成：

| 层级 | 路径 | 用途 | 管理方式 |
|------|------|------|----------|
| L1 本地记忆 | `~/.meituan-catpaw/<user>/memory/` | MEMORY.md 长期 + daily/ 短期 | 手动写入 |
| L2 知识库 | `.mumuspec/knowledge/` | 决策/模式/教训/风险 | 手动 + archive 半自动 |
| L3 契约 | `.mumuspec/contracts/` | API/Schema 版本化契约 | 手动变更控制 |
| L4 变更工件 | `.mumuspec/changes/<name>/` | 变更全生命周期文档 | CLI 自动化 |

与 TencentDB Agent Memory 对比后，识别出 5 个核心差距：

### 差距 1：无自动提取管线
知识库维护完全依赖人工识别和手动写入。Archive 阶段虽然会触发知识提取，但缺乏结构化的 L0→L1→L2 蒸馏管线。

### 差距 2：无语义金字塔
当前知识按"文档用途"分类（decision/pattern/lesson），不按"信息抽象度"分层。Agent 在日常上下文中无法快速判断需要加载哪一级别的细节。

### 差距 3：无语义检索
知识库 90+ 条目后，仅靠 YAML 索引 + 文件路径导航不足以支持模糊匹配和语义关联发现。

### 差距 4：无短期符号化记忆
长任务（如 multi-step build/verify）执行过程中产生的中间状态和工具输出，缺乏"Mermaid 画布式"的压缩摘要 + node_id 溯源机制。

### 差距 5：无量化度量
不知道哪些记忆被成功召回、哪些从未被使用，缺乏数据驱动的记忆治理。

---

## 2. 改进目标

| 目标 | 衡量标准 | 优先级 |
|------|----------|--------|
| 引入自动知识提取 | Archive 后自动产出 knowledge 条目，人工审核即可入库 | P0 |
| 建立语义金字塔 | 定义 L0-L3 四级知识抽象，Agent 按需加载 | P0 |
| 增加语义检索 | 支持模糊查询、关联发现，检索召回率 >85% | P1 |
| 短期符号化记忆 | 长任务上下文压缩率 >70%，100% 可溯源 | P1 |
| 度量体系 | 记忆命中率、token 节省率可量化 | P2 |

---

## 3. 架构设计

### 3.1 整体分层模型

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent 上下文 (Context Window)               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  L3 Persona / 高层画像 (MEMORY.md)                       │ │
│  │  + L2 Scenario Blocks (场景块, 按需加载)                  │ │
│  │  + Mermaid 符号化画布 (当前任务状态摘要)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    检索层 (Retrieval)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ YAML 索引     │  │ BM25 全文    │  │ 向量语义检索      │   │
│  │ (精确匹配)    │  │ (关键词)     │  │ (sqlite-vec)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                      RRF 融合排序                             │
├─────────────────────────────────────────────────────────────┤
│                    存储层 (Storage)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  .mumuspec/knowledge/   ← 结构化知识库 (L1-L3 .md)    │   │
│  │  .mumuspec/contracts/   ← 契约层                      │   │
│  │  .mumuspec/changes/     ← 变更工件 (L0 证据)          │   │
│  │  ~/.meituan-catpaw/.../memory/ ← 用户级记忆           │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    提取管线 (Extraction Pipeline)              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ L0 归档   │ →  │ L1 蒸馏   │ →  │ L2/L3 聚合│              │
│  │(原始工件) │    │(原子事实) │    │(场景/画像)│              │
│  └──────────┘    └──────────┘    └──────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 语义金字塔定义（L0→L3）

| 层级 | 名称 | 内容 | 存储位置 | 加载时机 |
|------|------|------|----------|----------|
| **L0 Evidence** | 证据层 | 原始变更工件、对话输出、工具调用结果 | `changes/<name>/` | 按需溯源 |
| **L1 Atom** | 原子事实 | 单一决策/教训/模式/风险，可独立理解 | `knowledge/{type}/` | 日常上下文 |
| **L2 Scenario** | 场景块 | 多个相关原子按场景聚合（如"安全加固场景"） | `knowledge/scenarios/` | 任务规划时 |
| **L3 Persona** | 高层画像 | 用户偏好摘要、项目约束概览、工作风格 | `MEMORY.md` | 每次会话启动 |

### 3.3 自动提取管线设计

```
Archive 完成
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 1: 工件扫描                              │
│  - 扫描 changes/<name>/ 下所有产出文件        │
│  - 标记候选提取目标 (decisions/tasks/feedback) │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 2: L1 蒸馏 (LLM 辅助)                    │
│  - 每条决策 → 1 个 decision atom              │
│  - 每条教训 → 1 个 lesson atom                │
│  - 每个可复用模式 → 1 个 pattern              │
│  - 输出格式: frontmatter + 段落 + 溯源链接     │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 3: 用户确认                              │
│  - 生成 diff 预览                             │
│  - 用户审核/编辑/确认入库                      │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 4: 索引更新 + 反向关联                   │
│  - 更新 _index.yaml                           │
│  - 更新 _reverse-index.yaml                   │
│  - 触发 L2/L3 重计算（条件满足时）             │
└─────────────────────────────────────────────┘
```

### 3.4 符号化短期记忆（任务内）

针对长任务（archive、multi-step build），引入"任务画布"机制：

```yaml
# .mumuspec/changes/<name>/canvas.yaml
task_id: archive-2026-08-08
status: in_progress
steps:
  - id: S1
    name: "Git 合并"
    status: done
    evidence: "refs/git-merge-output.md"
    summary: "合并 feature/xxx 到 main，3 文件冲突已解决"
  - id: S2
    name: "知识提取"
    status: in_progress
    evidence: ""
    summary: ""
  - id: S3
    name: "归档清理"
    status: pending
    evidence: ""
    summary: ""
```

- Agent 日常上下文只保留 canvas.yaml（~50 token）
- 需要某步骤细节时，按 S-id 回溯到 evidence 文件
- 实际测试中类似策略可减少 60%+ 上下文占用

### 3.5 语义检索增强

**方案选项对比：**

| 方案 | 优点 | 缺点 | 兼容性 |
|------|------|------|--------|
| A: FTS5 全文检索 (SQLite 内置) | 零外部依赖、安装简单 | 无语义理解、中文分词需处理 | 高 |
| B: sqlite-vec + 本地 embedding | 语义检索强、本地隐私 | 额外依赖、首次构建慢 | 中 |
| C: 混合 (FT5 + sqlite-vec + RRF) | 精确+语义兼顾 | 实现复杂度最高 | 中 |

**推荐方案**：A → C 渐进式
- Phase 1: 集成 FTS5 全文检索（零依赖，利用 SQLite 内置能力）
- Phase 2: 可选启用 sqlite-vec（用户主动 opt-in）
- Phase 3: RRF 融合排序

### 3.6 度量体系

引入轻量度量日志：

```yaml
# .mumuspec/knowledge/_metrics.yaml
version: "1.0"
recalls:
  - timestamp: 2026-08-08T14:30:00Z
    query: "ponytail 约束"
    strategy: "yaml_index"
    results_count: 3
    clicked: "KP-0004-ponytail-coding-constraints"
stats:
  total_recalls: 0
  cache_hits: 0
  avg_results: 0
```

度量维度：
- **召回率**：检索命中相关条目的比例
- **记忆利用率**：knowledge 中被实际引用的条目占比
- **Token 节省率**：使用记忆前后上下文 token 消耗对比
- **提取准确率**：提取的 L1 原子事实经人工确认的准确率

---

## 4. 实施路线

### Phase 1 — 自动提取管线 + FTS5 检索（2 周）

| 任务 | 描述 | 产出 |
|------|------|------|
| T1.1 | Archive 阶段增加 L1 蒸馏子步骤 | 新 archive skill 步骤 |
| T1.2 | 定义 L1 Atom 模板（frontmatter schema） | `templates/knowledge-atom.yaml` |
| T1.3 | 实现 FTS5 全文检索命令 `mumuspec knowledge search` | 新 CLI 命令 |
| T1.4 | 知识库 _index.yaml 增加 embedding/text 字段 | schema 升级 |

### Phase 2 — 符号画布 + 度量（2 周）

| 任务 | 描述 | 产出 |
|------|------|------|
| T2.1 | Canvas.yaml schema 定义 + 读写 API | `src/core/canvas.ts` |
| T2.2 | Build/Verify 阶段集成画布维护 | skill 步骤更新 |
| T2.3 | 度量日志 + `mumuspec knowledge stats` 命令 | 新 CLI 命令 |
| T2.4 | L2/L3 自动聚合（条件触发） | 新核心模块 |

### Phase 3 — 向量检索 + 治理（1 周）

| 任务 | 描述 | 产出 |
|------|------|------|
| T3.1 | sqlite-vec 可选依赖集成 | 条件加载 |
| T3.2 | RRF 融合排序 | 检索增强 |
| T3.3 | 记忆清理命令（未利用条目标记/归档） | `mumuspec knowledge prune` |

---

## 5. 约束与风险

### 必须遵守的约束
- **零依赖优先**：Ponytail 原则 Phase 1 必须零新依赖（FTS5 in SQLite 已内置）
- **契约变更**：knowledge schema 变更需走外部契约征询流程
- **向后兼容**：现有 knowledge/ 目录结构必须继续可用

### 风险
| 风险 | 影响 | 缓解 |
|------|------|------|
| L1 蒸馏质量不稳定 | 人工审核成本上升 | 默认 dry-run，用户确认后入库 |
| FTS5 中文分词不准 | 检索召回率低 | 集成字符二元切分或 jieba 分词 |
| Canvas 维护遗漏 | 状态不一致 | Archive 强制校验 canvas 完整性 |
| 隐私/安全 | embedding 数据泄露 | 全程本地，不上传任何云服务 |

---

## 6. 参考实现

- TencentDB Agent Memory: https://github.com/TencentCloud/TencentDB-Agent-Memory
- SQLite FTS5: https://www.sqlite.org/fts5.html
- sqlite-vec: https://github.com/asg017/sqlite-vec
- CatPaw Memory System: CatPaw built-in (`~/.meituan-catpaw/<user>/memory/`)
