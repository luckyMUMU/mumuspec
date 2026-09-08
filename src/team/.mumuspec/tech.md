---
layer: 2
scope: "src/team"
last_updated: "2026-09-08"
doc_type: tech
---

# Technical Design: team

## Requirement: Engine & Adapter Separation

### SHALL
- TeamEngine 通过 RuntimeAdapter 接口与运行时解耦，外部依赖只经 adapter 注入
- MockRuntimeAdapter 提供零依赖实现，用于测试与本地模拟

### SHALL NOT
- 禁止 TeamEngine 直接 import 具体运行时实现

### Enforcement
- TECH-TEAM-1: engine.ts 仅依赖 RuntimeAdapter 接口
- TECH-TEAM-2: MockRuntimeAdapter 可独立实例化

## Requirement: Config Lifecycle

### SHALL
- 配置按变更名隔离存储（getTeamConfigPath 以 changeName 定位）
- validateTeamConfig 返回结构化校验结果（TeamConfigValidation）

### SHALL NOT
- 禁止配置写入变更工件目录之外的路径

### Enforcement
- TECH-TEAM-3: 配置路径统一经 getTeamConfigDir / getTeamConfigPath
- TECH-TEAM-4: validateTeamConfig 在 load 与 save 双端生效

## Requirement: Observable Execution

### SHALL
- 状态转移产生 TeamEventRecord 事件日志
- confirmSelection 是人工放行的唯一入口

### SHALL NOT
- 禁止静默跳过达标线检查（canContinue / isBarMet 不可被绕过）

### Enforcement
- TECH-TEAM-5: 放行动作只经 confirmSelection，且记录事件

## 架构决策

- **适配器模式**：运行时（进程/agent 执行）抽象为 RuntimeAdapter，引擎只管状态与规则
- **事件溯源**：getEventLog 完整记录状态转移，协作过程可回放审计
- **配置即数据**：TeamConfig 为纯数据结构，校验与默认构造独立成函数，便于 CLI/MCP 复用
