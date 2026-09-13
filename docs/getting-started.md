# 用户上手指南 — 安装、初始化、跑通首个变更

> 本文面向**直接使用 CLI** 的开发者，即便你不打算把 AI 编程工具集成进来，MumuSpec 也提供完整的规范与变更管理能力。

预计耗时：**15–20 分钟**。完成后你将拥有：初始化好的 `.mumuspec/` 目录、一条完整 SHALL/SHALL NOT 规范、一个跑通五阶段工作流的真实变更。

---

## 安装

### 全局安装（推荐）

```bash
npm install -g mumuspec
```

### 项目本地安装

```bash
cd /path/to/your-project
npm install --save-dev mumuspec
# 之后用 npx mumuspec 或 npm run mumuspec 调用
```

### 单次使用（不安装）

```bash
npx mumuspec init my-project
```

安装后验证：

```bash
mumuspec --version
mumuspec --help
```

---

## 初始化项目

```bash
cd /path/to/your-project
mumuspec init . --name your-project-name --language typescript
```

`init` 创建 `.mumuspec/` 目录骨架：

```
.mumuspec/
├── config.yaml              # 项目配置（规范路径、约束强度等）
├── spec.md                  # 根层规范（空模板）
├── design.md                # 根层设计文档（空模板）
├── prohibitions.md          # 反向禁止清单（空模板）
├── index.yaml               # 规范树索引（自动生成）
├── audit.log                # 审计日志
├── changes/                 # 变更目录
├── knowledge/               # 知识层
└── skills/                  # Skill 目录
```

---

## 诊断环境

运行 `doctor` 验证环境依赖是否齐全：

```bash
mumuspec doctor
```

典型输出：

```
✓ Node.js 22.14.0 (>= 20)
✓ Git 2.42.0
✓ .mumuspec/ exists
✓ config.yaml valid
✓ No active changes
```

如有报错，按提示处理即可（通常是 Git 仓库未初始化、Node.js 版本过低、或 `.mumuspec/` 目录缺失）。

---

## 编写第一条规范

打开 `.mumuspec/spec.md`，替换为项目自己的约束。示例：

```markdown
# 项目规范

## SHALL

- 所有 API 返回统一 JSON 格式 `{ code, data, message }`
- 每个有 spec.md 的目录必须维护 design.md
- 写操作函数必须做参数验证
- 业务错误必须用 MumuSpecError 抛出

## SHALL NOT

- 禁止在处理函数内部直接访问数据库（必须走 storage 层）
- 禁止在生产日志中打印敏感信息（token/密码/邮箱）
- 禁止在 CHANGELOG.md 以外的地方随意修改版本号

## SHOULD

- 优先使用 TypeScript 严格模式
- 优先使用项目既有依赖而非引入新库

## MAY

- 在 demo 项目中使用内存存储替代数据库
```

保存后运行校验：

```bash
mumuspec validate
```

校验失败时 CLI 会报告文件路径和行号。全部通过后继续下一步。

---

## 创建第一个变更

```bash
mumuspec new add-title-validation --workflow hotfix
```

CLI 会在 `.mumuspec/changes/add-title-validation/` 下创建变更目录与 `.mumuspec.yaml` 状态文件，并提示当前的活跃路径。

三种工作流可选：

| workflow | 适用场景 |
|---------|---------|
| `hotfix` | Bug 修复，最短路径 |
| `tweak` | 文案 / 配置 / 文档微调 |
| `full` | 新功能 / 重大变更，走完整五阶段 |

---

## 手动推进五阶段

如果不用 AI 工具，你也可以手动推进：

### Open 阶段

```bash
# 1. 描述变更提案
mumuspec state transition add-title-validation design --reason "proposal 已确认"
```

在 `.mumuspec/changes/add-title-validation/proposal.md` 写明"任务 title 为空时创建接口应返回 400 错误"。

### Design 阶段

```bash
# 2. 转到 Design
mumuspec state transition add-title-validation design

# 3. 写设计文档
#    编辑 .mumuspec/changes/add-title-validation/design.md

# 4. 写测试用例
mumuspec test-cases init add-title-validation
#    编辑 .mumuspec/changes/add-title-validation/test-cases/layer-0-cases.md

# 5. 锁定测试用例（设计完成后冻结）
mumuspec test-cases lock add-title-validation
```

### Build 阶段

```bash
# 6. 转到 Build
mumuspec state transition add-title-validation build

# 7. 隔离方式由 workflow 配置决定
#    .mumuspec/config.yaml → workflow.worktree_isolation: true
#    mumuspec doctor 可诊断当前隔离状态

# 8. 在隔离环境中修改代码

# 9. 执行合规检查
mumuspec check --shall
mumuspec check --shall-not
mumuspec drift
```

### Verify 阶段

```bash
# 10. 转到 Verify
mumuspec state transition add-title-validation verify

# 11. 验证测试不可变性
mumuspec test-cases verify add-title-validation

# 12. 写验证报告
#     编辑 .mumuspec/changes/add-title-validation/verify.md

# 13. 验证通过，进入归档
mumuspec state transition add-title-validation archive-in-progress
```

### Archive 阶段

```bash
# 14. 归档（自动触发漂移检测、合并提交、知识提取）
mumuspec archive add-title-validation
```

归档完成后，变更目录自动移到 `.mumuspec/changes/archive/`，变更工位释放，可以接受下一个变更。

---

## 关键命令速查

| 场景 | 命令 |
|------|------|
| 初始化 | `mumuspec init .` |
| 诊断 | `mumuspec doctor` |
| 新建变更 | `mumuspec new <name> --workflow hotfix` |
| 列出活跃变更 | `mumuspec list` |
| 查看状态 | `mumuspec status [name]` |
| 状态转换 | `mumuspec state transition <name> <target-phase>` |
| 回退 | `mumuspec state transition <name> <target-phase> --reason <原因>` |
| 校验规范 | `mumuspec validate` |
| 合规检查 | `mumuspec check` |
| 漂移检测 | `mumuspec drift` |
| 归档 | `mumuspec archive <name>` |
| 废弃 | `mumuspec discard <name> --confirm` |
| 交互式引导 | `mumuspec tutorial` / `mumuspec onboard start` |

---

## 变更状态机字段

`.mumuspec.yaml` 关键字段：

```yaml
change_name: add-title-validation
phase: design
workflow: full

# 构建状态
build_layers: []
build_mode: ~
isolation: worktree
tdd_mode: tdd

# 测试状态
test_cases:
  design_locked: false
  design_content_hash: ~
  suites_locked: false

# 回退状态（超限时自动阻断）
rollback_count: 0
rollback_limit: 3
```

字段详解见 [reference/configuration.md](reference/configuration.md) §"变更配置"。

---

## 常见场景

### 误操作废弃变更

```bash
mumuspec discard add-title-validation --confirm
```

会把 worktree、变更目录一并清理，释放活跃变更槽位。

### 回退到上一阶段

```bash
mumuspec state transition add-title-validation design --reason "设计需补充"
# 查看可转换的目标阶段：
mumuspec state graph add-title-validation
```

回退次数受 `rollback_limit` 限制，超限由状态机阻断（`E-CHANGE-002`）。

### 查看状态机路径

```bash
mumuspec state graph add-title-validation
```

输出当前可转换路径与下一步建议。

---

## 下一步

- 想让 AI 自动推进变更 → [getting-started-agent.md](getting-started-agent.md)
- 完整 CLI 命令参考 → [reference/cli-commands.md](reference/cli-commands.md)
- 配置完整 schema → [reference/configuration.md](reference/configuration.md)
- 项目设计总览 → [overview.md](overview.md)

> **导航**: [← 全局概览](overview.md) | [Agent QuickStart →](getting-started-agent.md) | [CLI 命令参考 →](reference/cli-commands.md)
