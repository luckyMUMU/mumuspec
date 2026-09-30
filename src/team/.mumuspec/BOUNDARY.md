# Team Orchestration — Boundary Document

> Directory: `src/team/`
>
> 接线状态：本模块当前**无消费者**——CLI 命令面已移除（默认适配器返回占位简报，
> 占位实现不得返回成功）。引擎保留待真实运行时适配器接入；在接入之前不得
> 重新暴露命令面，也不得在文档中宣称协作模式可用。

## 对外接口

| 导出 | 文件 | 说明 |
|------|------|------|
| `TeamEngine` | `engine.ts` | 编排引擎：clarify → propose → evaluate → iterate 循环 |
| `MockRuntimeAdapter` | `engine.ts` | 测试用 mock adapter |
| `loadTeamConfig` | `config.ts` | 加载 team YAML 配置 |
| `saveTeamConfig` | `config.ts` | 保存 team YAML 配置 |
| `validateTeamConfig` | `config.ts` | 配置校验 |
| `buildDefaultTeamConfig` | `config.ts` | 生成配置脚手架 |
| `getTeamConfigDir` | `config.ts` | team 配置目录路径 |
| `getTeamConfigPath` | `config.ts` | team 配置文件路径 |
| `teamConfigExists` | `config.ts` | 配置是否存在 |
| `TEAM_CONFIG_DIR` | `config.ts` | 常量 `'team'` |

## TypeScript types (from `src/core/types-team.ts`)

| 类型 | 说明 |
|------|------|
| `TeamConfig` | 完整 team 配置（lead + members + evaluator + iteration） |
| `TeamState` | 运行时状态（嵌入 ChangeState.team_state） |
| `TeamPhase` | 生命周期阶段枚举 |
| `TeamRound` | 单轮执行记录 |
| `TeamMemberResult` | 单个 member 实例结果 |
| `TeamEvaluationResult` | 评估结果 |
| `RuntimeAdapter` | 执行后端接口（pluggable） |
| `TeamInitInput` | 初始化输入 |

## 依赖声明

| 依赖 | 来源 |
|------|------|
| `TeamConfig`, `TeamState`, etc. | `../core/types-team.js` |
| `readYaml`, `writeYaml`, `ensureDir`, `getMumuSpecDir` | `../core/utils.js` |

## 数据契约

- **TeamConfig YAML**: `.mumuspec/team/<name>.yaml`
  - version: 必须为 1
  - lead: 编排 agent 标识符
  - members: 并行提案角色数组（role + instances + optional orientations）
  - evaluator: 评分 agent 配置（role + min_score + dimensions）
  - iteration: 迭代控制（max_rounds + stop_on_convergence）

- **TeamState**: 嵌入 `.mumuspec.yaml` 的 `team_state` 字段
  - 与 `loop_state` 平级
  - 支持的生命周期：pending → clarify → propose → evaluate → iterate → converged/exhausted

## CLI 入口

| 命令 | 文件 | 说明 |
|------|------|------|
| `mumuspec team init` | `commands/team.ts` | 初始化 team mode |
| `mumuspec team clarify` | `commands/team.ts` | Lead 需求澄清 |
| `mumuspec team run` | `commands/team.ts` | 执行单轮 propose→evaluate |
| `mumuspec team status` | `commands/team.ts` | 查看状态 |
| `mumuspec team confirm` | `commands/team.ts` | 确认最终选择 |
| `mumuspec team scaffold` | `commands/team.ts` | 生成配置脚手架 |
| `mumuspec team info` | `commands/team.ts` | 帮助信息 |

## RuntimeAdapter 接口

```typescript
interface RuntimeAdapter {
  readonly name: string;
  spawnMember(ctx: MemberExecutionContext): Promise<MemberExecutionResult>;
  runEvaluator(ctx: EvaluatorExecutionContext): Promise<EvaluatorExecutionResult>;
  runLead(ctx: LeadExecutionContext): Promise<LeadExecutionResult>;
}
```

实现类：
- `MockRuntimeAdapter` — 确定性 mock，用于测试
- CatPaw subagent adapter — 通过 skill 层注入（未来扩展）

## 变更日志

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026-08-22 | 初始引入 | 将 bidding-team 模式抽象为可复用 Team 框架 |
