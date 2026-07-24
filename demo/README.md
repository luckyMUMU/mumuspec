# Task API — MumuSpec Demo Project

> 这是一个使用 **MumuSpec** 规范驱动开发系统管理的 demo 项目。
> 项目本身是一个轻量级任务管理 REST API，使用 Node.js 原生 `http` 模块构建。

---

## 项目概览

| 项目 | 说明 |
|------|------|
| 名称 | task-api |
| 语言 | TypeScript |
| 运行时 | Node.js >= 20 |
| 依赖 | 零运行时依赖（仅使用 Node.js 标准库） |
| 存储 | 内存存储（Map） |

## 目录结构

```
demo/
├── .mumuspec/                    # MumuSpec 根配置
│   ├── config.yaml               # MumuSpec 配置文件
│   ├── spec.md                   # 根层规范 (Level 0) — 含 Ponytail 约束
│   ├── design.md                 # 根层设计文档
│   ├── prohibitions.md           # 全局禁止规则
│   ├── index.yaml                # 规范树索引
│   ├── audit.log                 # 审计日志
│   ├── changes/                  # 变更管理
│   │   └── archive/              # 已归档变更
│   │       └── 2026-07-10-add-priority-field/  # 完整变更示例
│   ├── knowledge/                # 知识层 (LLM-Wiki)
│   │   ├── decisions/            # 决策记录
│   │   ├── patterns/             # 模式记录
│   │   └── rationale/            # 理据记录
│   ├── contracts/                # 契约层
│   └── skills/                   # Skill 目录
├── src/
│   ├── models/
│   │   ├── .mumuspec/
│   │   │   ├── spec.md           # Level 2 规范 — 数据模型
│   │   │   └── design.md         # Level 2 设计
│   │   └── task.ts               # Task 模型 + 验证
│   ├── storage/
│   │   ├── .mumuspec/
│   │   │   ├── spec.md           # Level 2 规范 — 存储层
│   │   │   └── design.md         # Level 2 设计
│   │   └── store.ts              # 内存存储 CRUD
│   └── api/
│       ├── .mumuspec/
│       │   ├── spec.md           # Level 2 规范 — API 层
│       │   └── design.md         # Level 2 设计
│       ├── server.ts             # HTTP 服务器
│       └── routes.ts             # 路由分发
├── tests/
│   └── task.test.ts              # 测试用例
├── CLAUDE.md                     # AI Rules (自动生成)
├── AGENTS.md                     # AI Rules (自动生成)
├── .cursorrules                  # AI Rules (自动生成)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## MumuSpec 核心特性演示

### 1. 树状分布双向约束 (Spec Layer)

规范以树状结构分布在项目目录中，每个目录的 `.mumuspec/spec.md` 定义该层级的约束：

```
Level 0: .mumuspec/spec.md           (根层 — 全局架构 + Ponytail)
  ├── Level 2: src/models/.mumuspec/  (数据模型层)
  ├── Level 2: src/storage/.mumuspec/ (存储层)
  └── Level 2: src/api/.mumuspec/     (API 层)
```

**渐进式披露**：在子目录工作时，MumuSpec 自动加载从根到当前的完整规范链：

```bash
# 查看 src/api 的完整规范上下文（包含根层继承）
node ../dist/cli.js context src/api
```

### 2. Ponytail 基础编码约束

根层 `spec.md` 自动注入了 Ponytail 7 级优先级阶梯：

| 级别 | 问题 | 行动 |
|------|------|------|
| 1 | 这段代码需要存在吗？ | YAGNI — 不需要则不写 |
| 2 | 代码库中已有实现吗？ | 复用已有代码 |
| 3 | 标准库已经提供了吗？ | 使用标准库 |
| 4 | 平台原生特性支持吗？ | 使用平台特性 |
| 5 | 已安装的依赖能做吗？ | 使用已有依赖 |
| 6 | 能一行写完吗？ | 不过度抽象 |
| 7 | 以上都不满足 | 最小可工作代码 |

本项目遵循 Ponytail：
- 使用 `node:http` 而非 Express（Level 3: 标准库）
- 使用 `crypto.randomUUID()` 而非 uuid 库（Level 3）
- 使用 `Map` 而非数据库（Level 3）
- 使用 `path.split('/')` 而非正则路由（boring over clever）

### 3. 变更生命周期 (Change Layer)

完整的五阶段变更流程，已归档的变更 `add-priority-field` 演示了全流程：

```
Open → Design → Build → Verify → Archive
```

查看归档变更的完整工件：

```
.mumuspec/changes/archive/2026-07-10-add-priority-field/
├── .mumuspec.yaml           # 状态机配置（phase: archive-completed）
├── proposal.md              # 变更提案（Open 阶段）
├── delta-specs/             # 规范变更增量（Open 阶段）
│   ├── src-models.md
│   ├── src-storage.md
│   └── src-api.md
├── design.md                # 技术设计（Design 阶段）
├── cognitive-map.yaml       # 认知框架 Q1-Q4（Design 阶段）
├── test-cases/              # 测试用例（Design 阶段，已锁定）
│   └── layer-0-cases.md
├── decisions.md             # 决策记录
├── verify.md                # 验证报告（Verify 阶段）
├── constraints/             # 新增约束
├── code-graph/              # 代码图谱变更
└── snapshots/               # 回退快照
```

### 4. 知识层 (Knowledge Layer)

5 个知识页面记录了项目的决策、模式和理据：

| ID | 类型 | 标题 |
|----|------|------|
| KP-001 | decision | 使用 Node.js 原生 http 模块替代 Express |
| KP-002 | pattern | validateTask 验证模式 |
| KP-003 | pattern | 内存存储单例模式 |
| KP-004 | pattern | 统一 JSON 响应格式 |
| KP-005 | rationale | 路由解析使用 split 而非正则 |

```bash
# 列出所有知识页面
node ../dist/cli.js knowledge list

# 搜索知识
node ../dist/cli.js knowledge search "验证"

# 获取指定路径的知识上下文
node ../dist/cli.js knowledge context src/api
```

### 5. AI Rules 自动生成

MumuSpec 自动生成 3 个 AI Rules 文件，包含项目规范、Ponytail 约束、工作流规则：

- `CLAUDE.md` — Claude Code 规则
- `.cursorrules` — Cursor 规则
- `AGENTS.md` — 通用 Agent 规则

## 快速开始

### 安装依赖

```bash
cd demo
npm install
```

### 运行测试

```bash
npm test
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式（需先构建）
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`。

### API 端点

| Method | Path | Description |
|--------|------|-------------|
| GET | /tasks | 获取所有任务 |
| GET | /tasks/:id | 获取单个任务 |
| POST | /tasks | 创建任务 |
| PATCH | /tasks/:id | 更新任务 |
| DELETE | /tasks/:id | 删除任务 |

### 使用示例

```bash
# 创建任务
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn MumuSpec", "status": "todo"}'

# 获取所有任务
curl http://localhost:3000/tasks

# 更新任务
curl -X PATCH http://localhost:3000/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# 删除任务
curl -X DELETE http://localhost:3000/tasks/<id>
```

## MumuSpec CLI 命令

从 demo 目录运行（需先构建 mumuspec 父项目）：

```bash
# 环境诊断
node ../dist/cli.js doctor

# 规范验证
node ../dist/cli.js validate

# 查看规范上下文
node ../dist/cli.js context src/models

# 创建新变更
node ../dist/cli.js new my-change --workflow full --scope src/api

# 查看变更状态
node ../dist/cli.js list --all

# 知识管理
node ../dist/cli.js knowledge list
node ../dist/cli.js knowledge search "存储"
```

## 设计决策

| 决策 | 选择 | 理由 (Ponytail) |
|------|------|-----------------|
| HTTP 框架 | node:http | Level 3: 标准库已满足 |
| ID 生成 | crypto.randomUUID() | Level 3: Node.js 内置 |
| 存储 | Map (内存) | Level 3: JS 原生数据结构 |
| 路由解析 | path.split('/') | boring over clever |
| 数据模型 | interface + 纯函数 | YAGNI: 不需要 class |
| 验证 | 手动验证函数 | Level 3: 不引入 zod/joi |
