# 用户反馈与 Session 摘要流程

> 层级: Level 2 参考文档 | 关联: [STATUS.md](../STATUS.md) (改进进度同步), [packaging-deployment.md](packaging-deployment.md) (发布通道)

---

## 1. 目标

MumuSpec 的设计假设 (见 [overview.md](../overview.md) §设计假设) 中明确指出:**"AI 工具生态快速演进时,Rules 生成 + Skill Bridge 能否跟上"** 属于 Q4 未知未知,需要**建立监控与反馈机制,允许迭代修正**。

本文档定义两条结构化的反馈通道:

| 通道 | 触发者 | 形式 | 用途 |
|------|--------|------|------|
| **用户反馈 (User Feedback)** | 终端用户 / 团队 Lead | 单条 issue 报告 | 捕获具体使用问题、改进建议、bug |
| **Session 摘要 (Session Summary)** | AI Agent (MumuSpec 自身) | 每次会话末尾自动生成 | 沉淀模式、共性问题、设计盲区 |

两条通道汇聚到统一仓库 (`feedback/`) 与统一看板 (`docs/STATUS.md` §反馈汇总),驱动下一轮迭代。

---

## 2. 目录结构

仓库根目录新增 `feedback/` 目录 (在 `.gitignore` 中**不忽略**,版本化管理):

```
feedback/
├── README.md                           # 反馈流程入口 (本文件副本)
├── user/                               # 用户提交的反馈
│   ├── 2026-07-28-alex-init-failure.md
│   ├── 2026-07-28-jordan-multi-change.md
│   └── ...
├── sessions/                           # AI Agent 自动生成的 session 摘要
│   ├── 2026-07-28-spec-validation-loop.md
│   ├── 2026-07-28-constraint-strength-design.md
│   └── ...
├── monthly/                            # 月度聚合 (从 user/ + sessions/ 抽取模式)
│   ├── 2026-07.md
│   └── 2026-08.md
└── _template/
    ├── user-feedback-template.md      # 用户反馈模板
    └── session-summary-template.md    # Session 摘要模板
```

> **隐私**: `feedback/user/` 中的反馈默认包含提交者署名 (可选匿名);`feedback/sessions/` 中的摘要仅记录 Agent 行为模式,不包含用户敏感数据。提交前请确保未泄露密钥、内部代码路径等。

---

## 3. 用户反馈流程

### 3.0 CLI 快速提交（推荐）

MumuSpec 0.12.1+ 提供 `mumuspec feedback submit` 命令，可在终端直接提交反馈：

```bash
# 提交一条简单反馈
mumuspec feedback submit \
  --title "init 命令在 Windows 下路径分隔符失败" \
  --type bug \
  --severity major \
  --expected "init 应在 Windows 上正常工作" \
  --actual "路径分隔符 \\ 导致文件写入失败" \
  --impact "阻塞在 Windows 上使用 MumuSpec"

# 关联变更与 session
mumuspec feedback submit \
  --title "设计文档缺少错误处理章节" \
  --type design-review \
  --change add-auth-module \
  --session 20260728-auth-design \
  --design ".mumuspec/changes/add-auth-module/design.md" \
  --detail "建议在 Design 阶段增加错误处理流程..."

# 从文件读取反馈内容（适合长反馈）
mumuspec feedback submit \
  --title "Phase Guard 触发时机不明确" \
  --type improvement \
  --file ./my-feedback.md
```

**可用参数**:

| 参数 | 必需 | 说明 |
|------|------|------|
| `--title` | ✓ | 反馈标题 |
| `--type` | | 类型: `bug`, `feature-request`, `improvement`, `question`, `design-review` |
| `--severity` | | 严重程度: `critical`, `major`, `minor`, `info` |
| `--submitter` | | 提交者名称 |
| `--change` | | 关联的变更名称 |
| `--session` | | 关联的 session ID |
| `--design` | | 关联的设计文档路径 |
| `--expected` | | 期望行为 |
| `--actual` | | 实际行为 |
| `--detail` | | 详细说明 |
| `--impact` | | 影响范围 |
| `--suggestion` | | 改进建议 |
| `--file` | | 从文件读取反馈正文 |

### 3.1 提交反馈

用户可通过三种等价渠道提交反馈:

**渠道 A — 仓库 Issue (推荐,公开可追踪)**:
```bash
# 在 GitHub 仓库创建 Issue,选择 "User Feedback" 模板
# https://github.com/mumuspec/mumuspec/issues/new?template=user-feedback.md
```

**渠道 B — 直接提交 Markdown 文件 (适合长反馈)**:
```bash
# 1. 复制模板
cp feedback/_template/user-feedback-template.md feedback/user/$(date +%Y-%m-%d)-<short-title>.md

# 2. 编辑内容 (见模板字段说明)

# 3. 提交 PR
git checkout -b feedback/<short-title>
git add feedback/user/
git commit -m "feedback(user): <short title>"
git push origin feedback/<short-title>
# 然后在 GitHub 创建 PR
```

**渠道 C — CLI 反馈命令 (规划中,Phase 2 实现)**:
```bash
mumuspec feedback --type bug --summary "init 命令在 Windows 下路径分隔符失败"
# 自动收集环境信息 + 提交到本地 feedback/user/ 并提示是否打开 GitHub PR
```

### 3.2 用户反馈模板

`feedback/_template/user-feedback-template.md`:

```markdown
---
date: 2026-07-28
submitter: <github-username or "anonymous">
type: bug | feature-request | improvement | question
severity: critical | major | minor | info
version: 0.19.2-alpha.10
environment:
  os: <windows|macos|linux>
  node: <20.x>
  ai_tool: <claude-code|cursor|codex|opencode|other>
---

# <一句话标题>

## 期望行为
<你期望发生什么>

## 实际行为
<实际发生了什么,附错误日志/截图/输出>

## 复现步骤
1. ...
2. ...
3. ...

## 最小可复现项目
<可选,附 GitHub repo 链接或最小代码片段>

## 已尝试的规避方法
<你绕过这个问题的临时方案>

## 影响范围
<这个反馈对你工作的影响:阻塞?效率降低?可绕过?>

## 改进建议
<你认为应该怎么改 (可选)>
```

### 3.3 反馈处理流程

```
用户提交反馈
    │
    ▼
┌──────────────────────────┐
│ 自动分类 (GitHub Action) │
│ - 按 type 打标签          │
│ - 按 severity 排优先级    │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│  Triage (每周一次)       │
│ - 维护者确认复现         │
│ - 关联到 roadmap Phase   │
│ - 标记 accepted / deferred / declined │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│  集成到下一轮迭代        │
│ - 已接受的进入 backlog   │
│ - 月度聚合到 monthly/    │
│ - STATUS.md 同步状态     │
└──────────────────────────┘
```

### 3.4 反馈处理 SLA

| 严重级别 | 首次响应 | 修复目标 |
|---------|---------|---------|
| critical (阻塞核心流程) | 24 小时 | 当前 alpha/beta 周期内 |
| major (功能不可用但有 workaround) | 3 天 | 下一个 prerelease |
| minor (体验问题) | 1 周 | 下一个 minor 版本 |
| info (建议/问题) | 2 周 | 评估后纳入 roadmap |

### 3.5 反馈查询与管理

```bash
# 列出所有反馈（默认按时间倒序）
mumuspec feedback list

# 按状态/类型/变更过滤
mumuspec feedback list --status open
mumuspec feedback list --type bug --change add-auth-module

# 查看完整反馈内容
mumuspec feedback show FB-20260728-a1b2c3d4

# 更新反馈状态
mumuspec feedback update-status FB-20260728-a1b2c3d4 --status acknowledged --reason "已确认，将在下个版本修复"

# 查看与特定变更关联的反馈
mumuspec change-feedbacks add-auth-module
```

---

## 4. Session 摘要流程

### 4.1 CLI 创建 Session 摘要（推荐）

MumuSpec 0.12.1+ 提供 `mumuspec feedback session-summary` 命令：

```bash
# 创建 session 摘要并关联反馈
mumuspec feedback session-summary \
  --session-id 20260728-auth-design \
  --title "Auth 模块设计阶段" \
  --change-type feature \
  --outcome success \
  --agent catpaw \
  --agent-version 2026.0726 \
  --change add-auth-module \
  --duration 45 \
  --feedback FB-20260728-a1b2c3d4,FB-20260728-e5f6g7h8 \
  --summary "完成了 Auth 模块的 Design 阶段，输出了 design.md 和 test-cases/" \
  --patterns "Phase Guard 触发及时,TDD 红绿循环有效,认知框架需要更多轮次"
```

**可用参数**:

| 参数 | 必需 | 说明 |
|------|------|------|
| `--session-id` | ✓ | 唯一 session ID |
| `--title` | ✓ | Session 标题 |
| `--change-type` | ✓ | 变更类型 |
| `--outcome` | ✓ | 结果: `success`, `partial`, `failure`, `abandoned` |
| `--agent` | | AI Agent 名称 |
| `--agent-version` | | Agent 版本 |
| `--change` | | 关联的变更名称 |
| `--duration | | 持续时间（分钟） |
| `--feedback` | | 逗号分隔的反馈 ID |
| `--summary` | | 摘要内容 |
| `--patterns` | | 逗号分隔的模式列表 |

### 4.2 触发时机

AI Agent (使用 MumuSpec 的 AI 编程助手) 在以下场景**主动生成** session 摘要:

1. **完成一次完整变更流程** (Open → Design → Build → Verify → Archive) 后
2. **遇到 Phase Guard 阻断或 Constraint 阻断**后 (记录盲区)
3. **执行了回退 (rollback)** 后 (记录失败模式)
4. **Session 显式调用 `mumuspec session summary`** 时 (规划中,Phase 2)

> CLI 命令 `mumuspec feedback session-summary` 提供了自动化的 session 摘要创建，自动写入 `.mumuspec/feedback/sessions/` 并建立反馈关联。

### 4.3 Session 摘要模板

`feedback/_template/session-summary-template.md`:

```markdown
---
date: 2026-07-28
session_id: <uuid 或简短 hash>
agent: <claude-code|cursor|codex|opencode|custom>
agent_version: <1.x.x>
mumuspec_version: 0.19.2-alpha.10
project_type: <greenfield|brownfield|legacy|demo>
change_type: <feature|hotfix|tweak|build|archive>
duration_minutes: <估算>
outcome: success | partial | failure | abandoned
---

# <会话简短标题,如 "为 API 层添加分页查询规范">

## 1. 会话目标
<本次 session 试图完成什么>

## 2. 实际走完的流程
- [ ] Open (提案 + delta-specs)
- [ ] Design (设计文档 + 认知框架)
- [ ] Build (实现 + 测试)
- [ ] Verify (验证报告)
- [ ] Archive (归档 + 知识提取)

<未完成的阶段说明原因>

## 3. 触发的约束
<本次会话中被 MumuSpec 守卫触发过的约束 (SHALL / SHALL NOT),按时间顺序>

- [ ] worktree_isolation: <触发时机与结果>
- [ ] single_active_change: <...>
- [ ] top_down_design: <...>
- [ ] tdd_enforced: <...>
- [ ] <其他约束 id>

## 4. 阻断点与回退
<遇到的具体阻断 (Phase Guard / Constraint Evaluator),如何处理>

- 阻断点 1: <描述> → 处理方式: <修复 / 回退 / 关闭约束>
- 阻断点 2: ...

## 5. 走捷径点 (重要)
<哪些约束本应触发但没有,或 Agent 主动绕开了的>

- 期望触发但未触发: <约束 id + 场景>
- 主动绕开: <约束 id + 理由 + 是否在 decisions.md 记录>

## 6. 沉淀模式 (Patterns Observed)
<本次会话中观察到的可复用模式或反模式>

- 模式 1: <描述> — 可推广 / 需要制止
- 模式 2: ...

## 7. 设计盲区 (Q4 - 未知未知)
<本次会话暴露的设计未覆盖的场景>

- 盲区 1: <描述> → 建议补充到 <overview.md / constraint-strength.md / ...>
- 盲区 2: ...

## 8. 给改进的输入
<基于本次会话,Agent 对 MumuSpec 改进的具体建议>

- 建议 1: <改进点> → 优先级: <high|medium|low>
- 建议 2: ...

## 9. 知识页面
<本次会话生成或引用的 Knowledge Pages (KP-xxx)>

- KP-001: <标题>
- KP-002: <标题>

## 10. 关键工件引用
<本次会话产出的关键文件路径 (相对仓库根)>

- .mumuspec/changes/<change-id>/proposal.md
- .mumuspec/changes/<change-id>/design.md
- .mumuspec/changes/<change-id>/verify.md
```

### 4.3 Session 摘要处理流程

```
AI Agent 完成 session
    │
    ├─ 自动填写 session-summary-template.md
    │  (使用 mumuspec feedback session-summary 命令自动收集)
    │
    ▼
┌──────────────────────────┐
│ 提交到 feedback/sessions/ │
│ - 文件名: YYYY-MM-DD-<short>.md │
│ - git commit: "feedback(session): <short>" │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│ 月度聚合 (每月 1 号)      │
│ - 维护者扫描 sessions/    │
│ - 提取共性盲区到 monthly/  │
│ - 高频建议进入 backlog    │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│ STATUS.md 同步           │
│ - 月度更新 §反馈汇总表    │
│ - 同步 §改进计划          │
└──────────────────────────┘
```

### 4.4 反馈关联机制

MumuSpec 0.12.1+ 建立了**反馈 ↔ Session** 的双向关联：

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  User Feedback (FB-YYYYMMDD-xxxx)                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ frontmatter:                                              │  │
│  │   change_name: "add-auth-module"                          │  │
│  │   session_id: "20260728-auth-design"                      │  │
│  │   design_ref: ".mumuspec/changes/add-auth/.../design.md"  │  │
│  └───────────────────────────────────────────────────────────┘  │
│       │                                           ▲             │
│       │ 写入关联引用                                  │ 反向追加    │
│       ▼                                           │ 反馈链接    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Change State (.mumuspec/changes/add-auth-module/          │ │
│  │                .mumuspec.yaml)                             │ │
│  │  feedback_log:                                            │ │
│  │    entries:                                               │ │
│  │      - feedback_id: FB-20260728-xxxx                      │ │
│  │        linked_at: "2026-07-28T..."                        │ │
│  │        acknowledged: false                                │ │
│  │    session_links:                                         │ │
│  │      - feedback_id: FB-20260728-xxxx                      │ │
│  │        session_id: "20260728-auth-design"                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│       │                                           ▲             │
│       │ 关联引用                                     │ 反向引用    │
│       ▼                                           │             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Session Summary (.mumuspec/feedback/sessions/             │ │
│  │                   2026-07-28-auth-design.md)              │ │
│  │  frontmatter:                                             │ │
│  │    feedback_ids:                                          │ │
│  │      - FB-20260728-xxxx                                   │ │
│  │  正文末尾:                                                │ │
│  │    <!-- feedback-link: FB-20260728-xxxx -->                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**关联操作**:

```bash
# 1. 提交反馈时自动关联变更和 session
mumuspec feedback submit \
  --title "设计文档缺少错误处理" \
  --change add-auth-module \
  --session 20260728-auth-design

# 2. 创建 session 摘要时反向关联反馈
mumuspec feedback session-summary \
  --session-id 20260728-auth-design \
  --title "Auth 设计" \
  --change-type feature \
  --outcome success \
  --feedback FB-20260728-a1b2c3d4

# 3. 查看变更的所有关联反馈
mumuspec change-feedbacks add-auth-module
```

**存储位置**:

| 关联类型 | 存储位置 |
|---------|---------|
| 反馈文件 | `.mumuspec/feedback/user/<date>-<slug>.md` |
| 反馈索引 | `.mumuspec/feedback/index.yaml` |
| Session 索引 | `.mumuspec/feedback/sessions/.index.yaml` |
| 变更反馈日志 | `.mumuspec/changes/<name>/feedback/` |
| 变更状态 | `.mumuspec/changes/<name>/.mumuspec.yaml` → `feedback_log` |

---

## 5. 月度聚合

每月 1 号生成 `feedback/monthly/YYYY-MM.md`,结构:

```markdown
# 反馈月报 — 2026-07

## 摘要
- 用户反馈数: N (critical: X, major: Y, minor: Z)
- Session 摘要数: M
- 关闭的反馈: K
- 进入 backlog 的改进项: L

## 共性模式 (Top 3)
1. <模式> — 出现 N 次 (来源: <反馈 IDs>)
2. ...

## 设计盲区 (Q4 新增)
- <盲区> — 来源: <session IDs>
- ...

## 改进计划
- <改进项 1> → 归属 Phase X,负责人: <name>
- ...

## 已关闭反馈
- #<issue-id> <标题> — 关闭方式: <fixed/duplicate/wontfix>
```

---

## 6. STATUS.md 反馈汇总表

`docs/STATUS.md` 在末尾维护:

```markdown
## 反馈汇总

> 数据来源: feedback/user/ + feedback/sessions/,月度更新

| 指标 | 本月 | 累计 |
|------|------|------|
| 用户反馈 - critical | 0 | 0 |
| 用户反馈 - major | 1 | 1 |
| 用户反馈 - minor | 3 | 3 |
| Session 摘要 | 5 | 5 |
| 已关闭 | 2 | 2 |
| 平均关闭时长 | 4 天 | 4 天 |

### Top 改进项 (本季度)

| 改进项 | 来源 | 优先级 | 目标版本 | 状态 |
|--------|------|--------|---------|------|
| Windows 路径分隔符兼容 | user/2026-07-28-alex-init-failure | high | 0.12.1-beta.0 | accepted |
| Constraint Evaluator 实现 | sessions/2026-07-28-constraint-strength-design | high | 0.12.1-beta.0 | in-progress |
```

---

## 7. 反馈驱动改进的闭环

```
┌─────────────────────────────────────────────────┐
│  实际使用 (用户 + AI Agent)                      │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   用户反馈           Session 摘要
   feedback/user/    feedback/sessions/
        │                   │
        └─────────┬─────────┘
                  ▼
         月度聚合 monthly/
                  │
                  ▼
         STATUS.md 同步
                  │
                  ▼
         下一轮迭代 backlog
                  │
                  ▼
   ┌──────────────────────────────┐
   │ 设计/实现改进 → 新预发布版本 │
   └──────────────────────────────┘
                  │
                  ▼
        发布到 next 通道,用户验证
                  │
                  └─────────► 回到顶端
```

---

## 8. 隐私与公开性

- `feedback/` 目录默认公开 (开源仓库)
- 提交反馈前请删除:密钥、内部 URL、客户数据、未公开的商业信息
- 用户反馈可匿名 (在 frontmatter `submitter` 字段填 `anonymous`)
- Session 摘要不收集用户代码内容,只记录 Agent 行为模式与约束触发情况
- 如需私密反馈,发送到 `mumuspec-maintainers@<domain>` (待定)

---

## 9. 与其他文档的关系

- [overview.md](../overview.md) §设计假设 — 本流程对应 Q4 "建立监控与反馈机制" 的承诺
- [release-strategy.md](release-strategy.md) §灰度策略 — 反馈数据驱动灰度阶段是否推进
- [packaging-deployment.md](packaging-deployment.md) §预发布通道 — 反馈关闭后通过 next 通道分发修复
- [STATUS.md](../STATUS.md) §反馈汇总 — 反馈数据进入单一权威进度源

---

> **导航**: [← 打包与部署](packaging-deployment.md) | [发布与回滚策略 →](release-strategy.md) | [返回概览](../overview.md)
