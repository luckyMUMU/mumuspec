# CLI 命令参考

> 层级: Level 2 参考文档
> 基准版本: 0.24.0-alpha.0（以 `mumuspec --help` 实际输出为准）

---

## 规范管理

```bash
mumuspec init [path]                    # 初始化 MumuSpec（项目分析 + 自动生成规范 + 知识库）
mumuspec context <path>                 # 获取目录的规范上下文（渐进式披露）
mumuspec add-spec <scope>               # 添加规范到指定 scope
mumuspec validate                       # 校验所有规范格式
mumuspec prohibitions <path>            # 列出适用于某路径的 SHALL NOT 红线（含继承 scope）
mumuspec sync-specs [--fix] [--strict]  # 同步分布式规范文件（校验格式、生成缺失文件）
mumuspec annotate                       # 为 SHALL NOT 红线自动注解机器可读约束
mumuspec sync [--check] [--report <f>]  # 代码状态 → 持久规范（BOUNDARY.md / index.yaml / contracts）
                                        # --check 为 dry-run，只报漂移不写入
```

## 变更管理

```bash
mumuspec new <name>                     # 创建新变更
mumuspec status [name]                  # 查看变更状态
mumuspec list                           # 列出活跃变更
mumuspec archive <name>                 # 归档变更（合并规范 + 提取知识；自动升版并写 CHANGELOG）
mumuspec discard <name>                 # 废弃变更
mumuspec recommend [change]             # 按变更范围推荐工作流路径（full / tweak / hotfix）
mumuspec decisions [change]             # 查看变更的决策审计轨迹
mumuspec decisions append [options] [text...]  # 追加决策记录到 decisions.md
mumuspec advise <bp_id> [change]        # 获取阻塞点的顾问建议
mumuspec change-feedbacks <change>      # 列出关联到变更的反馈
mumuspec finalize-archive <name> [--delete-old|--keep-old] [--force]
                                        # 归档收尾：合并规范、更新索引、清理缓存
mumuspec merge <change>                 # 把已归档变更分支合并回主分支（--no-ff）
```

## 诊断与引导

```bash
mumuspec doctor                         # 环境诊断
mumuspec env {detect|validate|diff}     # 环境探测 / 校验 / 与 env-spec.md 比对
mumuspec capability [command] [--json]  # 命令能力元数据查询（tier / composables / 不可逆标记）
mumuspec tasks next <name>              # 定位 tasks.md 中第一个未勾选任务（只读）
mumuspec dashboard                      # 项目仪表盘
mumuspec onboard {init|start|next|complete-step|progress|quickstart}  # 引导式学习路径
mumuspec tutorial                       # 交互式教程：15 分钟完成第一个变更
mumuspec chat [query]                   # 基于知识库提问
mumuspec graph verify [--change <name>] # 校验变更状态机图一致性
mumuspec audit-log [--limit <n>]        # 审计日志（可按 --actor/--action/--result 过滤）
mumuspec hooks {install|uninstall|status|run}  # git 钩子：自动触发 guard 检查
mumuspec i18n status                    # 查看当前语言与可用翻译
mumuspec skill-path <name>              # 解析技能文件路径（带语言回退）
```

## 校验

```bash
mumuspec check                          # 全量规范校验（SHALL / SHALL NOT + drift + agents-hash）
mumuspec check --shall                  # 只检查正向要求
mumuspec check --shall-not              # 只检查反向禁止
mumuspec check --test-immutability      # 测试不可变性校验
mumuspec drift                          # 漂移检测
mumuspec guard <change> <phase>         # 阶段守卫检查（<phase> 是**目标**阶段：
                                        # 离开 open 用 design，离开 design 用 build，
                                        # 离开 build 用 verify，离开 verify 用 archive-in-progress）
mumuspec review                         # 模块级评审维度（D8）— 逐模块打分
mumuspec metrics [change]               # 自由度指标报告（只读：评估器数值 + 建议）
mumuspec meta-evolve                    # 元规范演进：评估规范有效性、提出改进建议
mumuspec eval {init|list|run}           # 运行 eval 场景校验 guard / skill 行为
```

## 状态机

```bash
mumuspec state init <name> <workflow>   # 初始化状态（full | hotfix | tweak）
mumuspec state transition <name> <event>  # 状态转换（正向或回退）
mumuspec state next <name>              # 获取下一步操作
mumuspec state graph <name>             # 可视化状态机当前状态和可转换路径
mumuspec state get <name> <field>       # 读取状态字段
mumuspec state set <name> <field> <value>  # 设置状态字段
mumuspec state check <name> [--recover] # 校验变更状态完整性
mumuspec state scale <name>             # 评估变更规模并推荐 verify 模式
mumuspec state layer <name> <layer> <status> [--scope <scope>] [--force]
                                        # 设置某层状态；同层多 scope 必须带 --scope；
                                        # 低层未完成时拒绝置 done（--force 越过）
mumuspec state layers <name> [--json]   # 层级表 + 并行组 + 候选组（只读）
mumuspec state plan-parallel <name> [--apply] [--json]
                                        # 读 code-graph 派生并行组；--apply 写回
                                        # parallel_group / depends_on（不变量 I3）
```

### 设计与实现的视野正交性（0.22+）

| 命令 | 判定的不变量 |
|------|--------------|
| `state layers` | I3 的**事实视图**：同层多 scope = 候选并行组；同组 = 已声明的并行集合 |
| `state plan-parallel` | I3 的**验证**：同层 scope 之间有直接调用边 → 不并行（输出证据文件:行） |
| `state layer ... done` | I2 的**写时约束**：层间自下而上；同层多 scope 的歧义目标必须 `--scope` 消歧 |
| `guard <name> build` | I1：`design_to_build` 检查设计覆盖断链（`E-GUARD-009` / `W-GUARD-009`），结论写入 `state.design_coverage` |
| `guard <name> verify` | I3：`build_to_verify` 检查同层 scope 耦合（`W-BUILD-001`） |

## 测试用例与测试套件管理

```bash
mumuspec test-cases init [options] <name>  # 初始化 test-cases/ 目录结构
mumuspec test-cases lock <name>            # 锁定测试用例（计算 hash，设置 design_locked=true）
mumuspec test-cases hash <name>            # 计算当前 test-cases hash（只读）
mumuspec test-cases verify <name>          # 校验 test-cases/ hash 是否与锁定值一致
mumuspec test-cases lock-suite <name>      # 锁定单个层级测试套件 hash
```

## 认知框架

```bash
mumuspec cognitive-map init <name>      # 从模板初始化 cognitive-map.yaml
mumuspec cognitive-map show <name>      # 查看变更的认知框架状态（Q1-Q4）
mumuspec cognitive-map sync <name>      # 由工件重算 state.cognitive_framework
mumuspec grill-me run [options]         # 阶段闸门式追问（任意阶段发现歧义时触发）
mumuspec grill-me info                  # 查看 grill-me 配置与阶段判据
```

## 知识层

```bash
mumuspec knowledge list [--type decision|pattern|risk|rationale|lesson] [--scope <path>]
mumuspec knowledge show <id>                    # 查看知识页面全文
mumuspec knowledge search <keyword>             # 搜索知识（相关性打分）
mumuspec knowledge context <path>               # 获取指定路径的知识上下文（按 scope 过滤）
mumuspec knowledge verify [--id <id> | --all]   # 验证知识新鲜度
mumuspec knowledge stale                        # 列出过期的知识页面
mumuspec knowledge supersede <id> --by <new-id> # 标记知识被新决策替代
mumuspec knowledge organize                     # 扫描知识库问题并可修复
mumuspec knowledge rebuild-index                # 从页面重建 _index.yaml
mumuspec knowledge coverage / gaps              # 知识覆盖率报告 / 覆盖缺口
mumuspec knowledge scan                         # 从代码库自主发现知识（deps / code / git / docs）
mumuspec knowledge doctor                       # 知识库健康诊断（只读）
mumuspec knowledge stats                        # 知识使用统计
mumuspec knowledge graph-export                 # 导出知识图谱为 UA 风格 JSON
mumuspec knowledge {export|import|tell|absorb} <target>  # 与外部 agent 交换知识
mumuspec impact                                 # 变更影响分析（关联知识）
```

## 代码图谱

```bash
mumuspec code-graph structure <dir>     # 结构清单（目录/符号盘点）
mumuspec code-graph search <query>      # 模糊搜索符号（文件 / 函数 / 类）
mumuspec code-graph trace <symbol>      # 追踪从某符号出发的依赖链
mumuspec search <pattern>               # 搜索代码节点
mumuspec trace <symbol>                 # 深度优先符号追踪（跨代码库）
```

## 契约管理

```bash
mumuspec contract list                          # 列出所有已登记契约
mumuspec contract show <id>                     # 查看契约详情
mumuspec contract register                      # 交互式登记新契约
mumuspec contract verify [--change <name>]      # 校验契约漂移（可限定变更）
mumuspec contract drift                         # 契约漂移检测（完整报告）
mumuspec contract compat-check [--change <name>] # 向后兼容性检查（对照注册表）
mumuspec contract impact <contractId>           # 分析修改 / 移除契约的影响范围
mumuspec contract deprecate <contractId>        # 废弃契约（带影响分析）
mumuspec contract remove <contractId>           # 移除契约（有安全检查，被引用时阻断）
mumuspec contract audit                         # 查看契约变更审计日志
mumuspec contract boundary                      # 管理目录边界文档
```

## 约束强度

```bash
mumuspec constraints strength            # 查看或设置约束强度（TD / RG 维度）
mumuspec constraints preset <name>       # 应用命名强度预设
mumuspec constraints list                # 列出 constraints.yaml 中的全部约束
mumuspec constraints resolve             # 解析树状分布式约束树（继承与收紧）
```

## 循环工作流（Plan → Act → Evaluate）

```bash
mumuspec loop init <name>                 # 为变更初始化 loop 模式（含 worktree + grill 校验）
mumuspec loop round <plan> [change]       # 以给定计划开启新一轮
mumuspec loop action <description>        # 记录本轮动作
mumuspec loop evaluate [change]           # 评估本轮并自动提交
mumuspec loop status / resume / exit      # 查看状态 / 恢复阻塞 / 标记收敛退出
mumuspec loop extend <n>                  # 扩展最大轮次上限
mumuspec loop merge / cleanup             # 合并 worktree 回原分支 / 清理已合并 worktree
mumuspec loop experiment                  # 并行演进循环：同时试验多个改进方向
mumuspec loop grill                       # loop 专属 grill 校验
mumuspec loop info                        # loop 模式工作流说明
```

## 团队协作

```bash
mumuspec team init <name>                 # 为变更初始化多角色协作模式
mumuspec team clarify [change]            # 运行 lead agent 澄清需求
mumuspec team run [change]                # 跑一轮 propose → evaluate
mumuspec team status [change]             # 查看协作状态与进度
mumuspec team confirm [change]            # 确认最终选型并退出协作模式
mumuspec team scaffold <name>             # 生成 team 配置 YAML 骨架
mumuspec team info                        # 协作模式说明
```

## 反馈

```bash
mumuspec feedback submit                  # 提交用户反馈
mumuspec feedback list / show <id>        # 列出 / 查看反馈
mumuspec feedback update-status <id>      # 更新反馈状态
mumuspec feedback session-summary         # 创建会话总结（可关联反馈）
```

## 技能与安装

```bash
mumuspec install catpaw [packages...] [--list|--search|--installed]  # CatPaw 技能
mumuspec install claude <packages...>     # Claude Code 斜杠命令
mumuspec install cursor <packages...>     # Cursor 技能
mumuspec install trae <packages...>       # Trae 技能
mumuspec install workbuddy <packages...> [--force]  # WorkBuddy 技能（版本随包注入）
mumuspec install opencode <packages...>   # OpenCode 技能
mumuspec install codex <packages...>      # Codex 技能 + 规范 AGENTS.md
mumuspec install windsurf <packages...>   # Windsurf 技能
mumuspec install gemini <packages...>     # Gemini 技能 + GEMINI.md 桥接
mumuspec install copilot <packages...>    # GitHub Copilot AGENTS.md 规则
mumuspec install mcp [server]             # 安装 MCP server 工作区配置
mumuspec install command [command]        # 安装 CatPaw 自定义斜杠命令
mumuspec install plugin                   # 安装宿主标准插件包到插件缓存并登记（幂等）

mumuspec skill init                       # 初始化技能编写协议
mumuspec skill validate [name]            # 校验自定义技能
mumuspec skill scaffold <name>            # 搭建新技能目录骨架
mumuspec skill companions                 # 枚举伴生能力及其状态

mumuspec bundle create [name]             # 从 .mumuspec/skills/ 打包
mumuspec bundle validate <path>           # 校验打包清单
mumuspec bundle install <path>            # 安装包到工作区
mumuspec bundle list                      # 列出项目可用包
mumuspec bundle plugin                    # 构建宿主标准插件包
```

> `bundle publish` 尚未实现，调用即 fail-closed；分发请用 `bundle plugin`。

## Git 操作

```bash
mumuspec git <subcommand> [args...]       # subcommand: status | commit | push | tag | flow
```

---

> **导航**: [返回概览](../overview.md) | [MCP 工具 →](mcp-tools.md)
