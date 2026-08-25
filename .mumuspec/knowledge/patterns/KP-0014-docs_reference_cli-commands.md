---
id: "KP-0038"
title: "CLI 命令参考"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - reference
  - pattern
source: "docs/reference/cli-commands.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# CLI 命令参考

> **Source**: `docs/reference/cli-commands.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

> 层级: Level 2 参考文档

## Original Content

# CLI 命令参考

> 层级: Level 2 参考文档

---

## 规范管理

```bash
mumuspec init [path]                    # 初始化 MumuSpec
mumuspec context <path>                 # 获取目录的规范上下文（渐进式披露）
mumuspec add-spec <scope> [--type shall|shall-not]  # 添加规范
mumuspec validate                       # 校验所有规范格式
```

## 变更管理

```bash
mumuspec new <name>                     # 创建新变更（自动检查单一活跃变更约束）
mumuspec status [name]                  # 查看变更状态
mumuspec list                           # 列出活跃变更
mumuspec archive <name>                 # 归档变更（git 提交 + MR + 合并规范 + 清理）
mumuspec discard <name>                 # 废弃变更（清理 worktree + 释放变更槽位）
```

## 特性配置管理

管理 MumuSpec 特性配置，控制高级特性的启用/禁用。

### mumuspec config enable

启用指定的高级特性。

```bash
mumuspec config enable <feature>
```

**支持的 feature**:
- `ponytail` - Ponytail 编码约束（Phase 2）
- `cognitive-framework` - 认知框架 Q1-Q4（Phase 2）
- `contract-layer` - Contract Layer（Phase 3）
- `knowledge-graph` - Knowledge Layer 代码图谱（Phase 3，需配合 `knowledge.graph_backend` 配置）
- `skill-bridge` - Skill Bridge 兼容层（Phase 3）
- `hyperplan` - Hyperplan 对抗式规划（Phase 5）

**示例**:

```bash
mumuspec config enable ponytail
```

输出:
```
✓ 已启用 Ponytail 编码约束
请运行 mumuspec spec validate 重新验证规范
```

### mumuspec config disable

禁用指定的特性。

```bash
mumuspec config disable <feature>
```

**示例**:

```bash
mumuspec config disable tdd-enforced
```

### mumuspec config list

列出当前配置状态。

```bash
mumuspec config list
```

输出示例:
```
MumuSpec 配置状态:

默认开启:
  ✓ Spec Layer
  ✓ Change Layer（基础）
  ✓ Guard Layer（P0）
  ✓ Rules 文件生成
  ✓ AI 工具适配层（自动检测）

高级特性（默认关闭）:
  ✗ Ponytail 编码约束
  ✗ 认知框架 Q1-Q4
  ✗ Contract Layer
  ✗ Knowledge Layer 代码图谱
  ✗ Skill Bridge
  ✗ Hyperplan

工作流规则:
  ✓ Worktree 隔离（默认开启）
  ✓ 单一活跃变更（默认开启）
  ✓ 自顶向下设计（默认开启）
  ✓ TDD 强制（默认开启）

使用 mumuspec config enable <feature> 开启高级特性
```

## 诊断与引导

```bash
mumuspec status                         # 变更状态概览（当前 Phase、build_layers 进度、test-cases 锁定状态、rollback/rebuild 计数、下一步操作建议）
mumuspec doctor                         # 环境诊断（Node.js 版本、Git 仓库状态、.mumuspec/ 目录完整性、config.yaml 校验、图谱索引新鲜度、Skill 生态可用性、依赖工具检查）
mumuspec wizard                         # 交互式引导（初始化项目规范、创建第一个变更、选择 Workflow、逐步引导完成五阶段流程）
```

## 状态机回退

```bash
mumuspec rollback <name> --to design    # 回退到 Design 阶段（从 build/verify）
mumuspec rollback <name> --to build     # 回退到 Build 阶段（仅从 verify，不增加回退计数）
mumuspec rollback-history <name>        # 查看回退历史
mumuspec snapshot list <name>           # 列出所有快照
mumuspec snapshot restore <name> <id>   # 从快照恢复工件状态
```

## Worktree 管理

```bash
mumuspec worktree create <name>         # 为变更创建 worktree（默认隔离方式）
mumuspec worktree remove <name>         # 移除变更的 worktree
mumuspec worktree list                  # 列出所有 MumuSpec 管理的 worktree
```

## 安装与生态

```bash
mumuspec install catpaw --list                        # 列出可安装的 CatPaw 技能
mumuspec install catpaw browser pdf --target user      # 安装技能（全局）
mumuspec install catpaw pdf --target workspace --workspace-path <path>  # 安装到项目
mumuspec install catpaw --search doc                   # 搜索可用技能
mumuspec install catpaw --installed                    # 查看已安装技能
mumuspec install claude                                # Claude Code 命令（coming soon）
mumuspec install cursor                                # Cursor 命令（coming soon）
```

## 知识层（代码图谱 + 知识管理）

### 代码图谱

```bash
mumuspec index                          # 构建/更新代码图谱
mumuspec impact [name]                  # 影响分析
mumuspec trace <symbol>                 # 追踪调用链
mumuspec search <pattern>               # 搜索代码节点
```

## 校验

```bash
mumuspec check                          # 全量规范校验
mumuspec check --shall                  # 只检查正向要求
mumuspec check --shall-not              # 只检查反向禁止
mumuspec check --test-immutability      # 测试不可变性校验
mumuspec drift                          # 漂移检测
mumuspec guard <change> <phase>         # 阶段守卫检查
```

## 状态机

```bash
mumuspec state init <name> <workflow>   # 初始化状态（full | hotfix | tweak）
mumuspec state transition <name> <event>  # 状态转换（正向或回退）
mumuspec state next <name>              # 获取下一步操作
mumuspec state graph <name>             # 可视化状态机当前状态和可转换路径
```

## Git 合并管理（Archive 阶段）

```bash
mumuspec merge create <name>            # 创建合并请求（MR/PR）
mumuspec merge status <name>            # 查看合并请求状态
mumuspec merge execute <name> [--strategy squash|merge|rebase]  # 执行合并
mumuspec merge abort <name>             # 中止合并流程
```

## 层级管理

```bash
mumuspec layer list <name>              # 查看变更的实现层级计划
mumuspec layer status <name> <layer>    # 查看特定层级的实现状态
mumuspec layer verify <name> <layer>    # 验证特定层级的规范合规性
```

## 设计文档管理

```bash
mumuspec design init <scope>            # 为指定目录初始化 design.md
mumuspec design update <scope>          # 更新指定层级的设计文档
mumuspec design list                    # 列出所有层级的设计文档
mumuspec design check                   # 校验 design.md 与 spec.md 一致性
```

## 文档生成

```bash
mumuspec doc generate [--scope <path>]  # 生成对外文档（默认全部，指定 scope 则仅生成该层级）
mumuspec doc generate --type technical  # 仅生成技术文档
mumuspec doc generate --type business   # 仅生成业务文档
mumuspec doc generate --type integration  # 仅生成集成指南（从 outbound 契约）
mumuspec doc generate --type dependencies  # 仅生成外部依赖文档（从 external 契约）
mumuspec doc generate --format html     # 指定输出格式（markdown|html|pdf|confluence）
mumuspec doc generate --depth 2         # 控制上下文聚合深度（默认全部父层）
mumuspec doc list                       # 列出所有已生成文档及其状态
mumuspec doc check                      # 文档一致性校验
mumuspec doc stale                      # 列出过期的文档
mumuspec doc template list              # 列出可用模板
mumuspec doc template add <file>        # 添加自定义模板
```

## 测试用例与测试套件管理

```bash
mumuspec test-cases init <name>         # 初始化 test-cases/ 目录结构
mumuspec test-cases lock <name>         # 锁定测试用例（计算 hash，设置 design_locked=true）
mumuspec test-cases verify <name>       # 校验 test-cases/ hash 是否与锁定值一致
mumuspec test-suites lock <name> <layer> # 锁定指定层级的测试套件
mumuspec test-suites verify <name>      # 校验所有测试套件 hash
mumuspec test-immutability <name>       # 综合校验测试不可变性
```

## 契约管理（0.8.0 新增）

```bash
mumuspec contract init                          # 初始化 contracts/ 目录结构
mumuspec contract add-external <name> [--category rpc|rest|mq|middleware|database]
mumuspec contract add-outbound <name> [--category rpc|rest|event|sdk]
mumuspec contract list [--type external|outbound]
mumuspec contract show <name>
mumuspec contract verify <name>                 # 校验契约与代码一致性
mumuspec contract verify --all
mumuspec contract derive <name>                 # 手动触发约束派生注入
mumuspec contract drift                         # 契约漂移检测
mumuspec contract impact <name>                 # 追踪契约变更影响范围
mumuspec contract registry update               # 更新 _registry.yaml
mumuspec contract compat-check <name>           # 向后兼容性检查
mumuspec contract doc generate [--name <name>]  # 从契约生成文档
```

## 认知框架管理（0.8.0 新增）

```bash
mumuspec cognitive-map init <name>              # 初始化认知地图
mumuspec cognitive-map status <name>            # 查看认知地图状态（Q1-Q4 计数、收敛状态）
mumuspec cognitive-map validate <name>          # 校验认知地图完整性
mumuspec cognitive-map converge <name>          # 强制收敛认知地图（达到轮次上限时）
```

### 知识管理

```bash
mumuspec knowledge list [--type decision|pattern|risk|rationale|lesson] [--scope <path>]
mumuspec knowledge show <id>                    # 查看知识页面全文
mumuspec knowledge search <keyword> [--tag <tag>]  # 搜索知识
mumuspec knowledge context <path>               # 获取指定路径的知识上下文（渐进式）
mumuspec knowledge verify [--id <id> | --all]   # 验证知识新鲜度
mumuspec knowledge graph [--scope <path>]        # 可视化知识关系图
mumuspec knowledge extract <change>             # 从已归档变更中提取知识
mumuspec knowledge stale                        # 列出过期的知识页面
mumuspec knowledge supersede <id> --by <new-id> # 标记知识被新决策替代
```

---

> **导航**: [返回概览](../overview.md) | [MCP 工具 →](mcp-tools.md)

