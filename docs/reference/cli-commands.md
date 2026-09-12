# CLI 命令参考

> 层级: Level 2 参考文档
> 基准版本: 0.19.2-alpha.10（以 `mumuspec --help` 实际输出为准）

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
mumuspec archive <name>                 # 归档变更（git 提交 + MR + 合并规范 + 清理；自动升版并写 CHANGELOG 条目，见 packaging-deployment.md §3.4）
mumuspec discard <name>                 # 废弃变更（清理 worktree + 释放变更槽位）
mumuspec decisions [change]             # 查看变更的决策审计轨迹
mumuspec decisions append --phase <phase> --change <name> --text "..."  # 追加决策记录到 decisions.md
```

## 特性与环境配置

> ⚠️ 0.19.x 不提供顶层 `config` 命令（旧文档中的 `config enable/disable/list` 已移除）。
> 特性开关通过 `.mumuspec/config.json` 的 workflow/feature 段配置；环境诊断用 `mumuspec env`。

```bash
mumuspec env                            # 环境与特性状态查看
```

## 诊断与引导

```bash
mumuspec status                         # 变更状态概览（当前 Phase、build_layers 进度、test-cases 锁定状态、rollback/rebuild 计数、下一步操作建议）
mumuspec doctor                         # 环境诊断（Node.js 版本、Git 仓库状态、.mumuspec/ 目录完整性、config.yaml 校验、图谱索引新鲜度、Skill 生态可用性、依赖工具检查）
mumuspec capability [command] [--json]  # 命令能力元数据查询（0.19.2-alpha.10 新增：tier/composables/不可逆标记；不带参数列出全部已登记命令）
mumuspec tasks                          # 任务清单查看
mumuspec dashboard                      # 项目仪表盘
```

> 注：旧文档中的 `wizard` 交互式引导与 `config` 命令在 0.19.x 顶层命令中已不存在。

## 状态机回退

> ⚠️ 顶层 `rollback` / `snapshot` 命令在 0.19.x 已移除（回退经 `state transition` 事件驱动，回退计数由状态机记录）。

## Worktree 管理

> ⚠️ 顶层 `worktree` 命令在 0.19.x 已移除（worktree 隔离由 workflow 配置驱动，`mumuspec doctor` 可诊断）。

## 安装与生态

```bash
mumuspec install catpaw --list                        # 列出可安装的 CatPaw 技能
mumuspec install catpaw browser pdf --target user      # 安装技能（全局）
mumuspec install catpaw pdf --target workspace --workspace-path <path>  # 安装到项目
mumuspec install catpaw --search doc                   # 搜索可用技能
mumuspec install catpaw --installed                    # 查看已安装技能
mumuspec install claude <packages...>                  # Claude Code 斜杠命令安装
mumuspec install cursor <packages...>                  # Cursor 技能安装
mumuspec install workbuddy <packages...> [--force]     # WorkBuddy 技能安装（SKILL.md 版本随包版本注入）
```

## 知识层（代码图谱 + 知识管理）

### 代码图谱

```bash
mumuspec code-graph structure <dir>     # 结构清单（目录/符号盘点）
mumuspec impact [name]                  # 影响分析
mumuspec trace <symbol> [--depth <n>] [--limit <n>] [--scope <path>]  # 深度优先符号追踪
mumuspec search <pattern>               # 搜索代码节点
```

## 校验

```bash
mumuspec check                          # 全量规范校验
mumuspec check --shall                  # 只检查正向要求
mumuspec check --shall-not              # 只检查反向禁止
mumuspec check --test-immutability      # 测试不可变性校验
mumuspec drift                          # 漂移检测
mumuspec drift detect [--change <name>] # 漂移检测（可限定变更范围）
mumuspec graph verify [--change <name>] # 校验变更状态机图一致性
mumuspec audit-log [--limit <n>]        # 审计日志（JSONL 追加式，可按 --actor/--action/--result 过滤）
mumuspec guard <change> <target-phase>  # 阶段守卫检查（<target-phase> 是**目标**阶段：
                                        # 离开 open 用 design，离开 design 用 build，
                                        # 离开 build 用 verify，离开 verify 用 archive-in-progress）
```

## 状态机

```bash
mumuspec state init <name> <workflow>   # 初始化状态（full | hotfix | tweak）
mumuspec state transition <name> <event>  # 状态转换（正向或回退）
mumuspec state next <name>              # 获取下一步操作
mumuspec state graph <name>             # 可视化状态机当前状态和可转换路径
mumuspec state layer <name> <layer> <status> [--scope <scope>] [--force]
                                        # 设置某层状态；同层多 scope 必须带 --scope；
                                        # 低层未完成时拒绝置 done（--force 越过）
mumuspec state layers <name> [--json]   # 层级表 + 并行组 + 候选组（只读）
mumuspec state plan-parallel <name> [--apply] [--json]
                                        # 读 code-graph 派生并行组；--apply 写回
                                        # parallel_group / depends_on（设计与实现的正交性 I3）
```

### 设计与实现的视野正交性（0.22+）

| 命令 | 判定的不变量 |
|------|--------------|
| `state layers` | I3 的**事实视图**：同层多 scope = 候选并行组；同组 = 已声明的并行集合 |
| `state plan-parallel` | I3 的**验证**：同层 scope 之间有直接调用边 → 不并行（输出证据文件:行） |
| `state layer ... done` | I2 的**写时约束**：层间自下而上；同层多 scope 的歧义目标必须 `--scope` 消歧 |
| `guard <name> build` | I1：`design_to_build` 检查设计覆盖断链（`E-GUARD-009` / `W-GUARD-009`），结论写入 `state.design_coverage` |
| `guard <name> verify` | I3：`build_to_verify` 检查同层 scope 耦合（`W-BUILD-001`） |

## Git 合并管理（Archive 阶段）

```bash
mumuspec merge create <name>            # 创建合并请求（MR/PR）
mumuspec merge status <name>            # 查看合并请求状态
mumuspec merge execute <name> [--strategy squash|merge|rebase]  # 执行合并
mumuspec merge abort <name>             # 中止合并流程
```

## 归档收尾

```bash
mumuspec finalize-archive <name> [--delete-old|--keep-old] [--force] [--json]
                                        # 归档收尾：spec知识提取、code-graph 快照落盘（temp/codegraph.snapshot.json）、
                                        # 陈旧归档缓存清理（30 天实删）、.finalized 防重跑标记（幂等，--force 覆盖）
```

## 测试用例与测试套件管理

```bash
mumuspec test-cases init <name>         # 初始化 test-cases/ 目录结构
mumuspec test-cases lock <name>         # 锁定测试用例（计算 hash，设置 design_locked=true）
mumuspec test-cases hash <name>         # 计算当前 test-cases hash（只读）
mumuspec test-cases verify <name>       # 校验 test-cases/ hash 是否与锁定值一致
mumuspec test-cases lock-suite <name>   # 锁定单个层级测试套件 hash
```

## 契约管理（0.8.0 新增）

```bash
mumuspec contract init                          # 初始化 contracts/ 目录结构
mumuspec contract add-external <name> [--category rpc|rest|mq|middleware|database]
mumuspec contract add-outbound <name> [--category rpc|rest|event|sdk]
mumuspec contract list [--category <cat>] [--status <st>] [--outbound|--inbound] [--scopes]  # 列出契约或来源 scope
mumuspec contract show <name>
mumuspec contract verify [--change <name>]      # 校验契约漂移（可限定变更）
mumuspec contract derive <name>                 # 手动触发约束派生注入
mumuspec contract drift [--change <name>]       # 契约漂移检测（可限定变更）
mumuspec contract impact <name>                 # 追踪契约变更影响范围
mumuspec contract registry update               # 更新 _registry.yaml
mumuspec contract compat-check [--change <name>] # 向后兼容性检查（对照注册表）
mumuspec contract doc generate [--name <name>]  # 从契约生成文档
```

## 认知框架（0.19.x 口径）

> ⚠️ 顶层 `cognitive-map` 命令在 0.19.x 已移除；认知框架工件（cognitive-map.yaml、Q1-Q4）由 phase-design 流程与 `grill-me` 命令驱动，guard 在阶段转换时校验。

### 知识管理

```bash
mumuspec knowledge list [--type decision|pattern|risk|rationale|lesson] [--scope <path>]
mumuspec knowledge show <id>                    # 查看知识页面全文
mumuspec knowledge search <keyword> [--tag <tag>]  # 搜索知识
mumuspec knowledge context <path> [--scopes <s>]  # 获取指定路径的知识上下文（渐进式，按 scope 过滤）
mumuspec knowledge verify [--id <id> | --all]   # 验证知识新鲜度
mumuspec knowledge graph [--scope <path>]        # 可视化知识关系图
mumuspec knowledge extract <change>             # 从已归档变更中提取知识
mumuspec knowledge stale                        # 列出过期的知识页面
mumuspec knowledge supersede <id> --by <new-id> # 标记知识被新决策替代
```

---

> **导航**: [返回概览](../overview.md) | [MCP 工具 →](mcp-tools.md)
