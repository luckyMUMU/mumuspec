# Capability Tier Design Contract Change Record

**日期**: 2026-08-09
**变更名称**: capability-tier-design
**版本**: 新增规范（不影响现有版本号）

---

## 变更摘要

引入"通用基础能力"与"专用工具"分层设计规范，将 MumuSpec 命令按风险等级划分为两个层级：
- **通用基础能力 (General Capability)**：灵活、可组合、支持探索的低风险操作，无需显式确认
- **专用工具 (Dedicated Tool)**：严格约束、高风险或强业务规则操作，必须经过标准守门流程

---

## 契约变更清单

| 变更 | 类型 | 说明 | 影响 |
|------|------|------|------|
| `CommandMetadata` 接口 | 新增核心类型 | 命令能力层级的元数据声明接口 | 新增类型定义，向后兼容 |
| `mumuspec capability <cmd>` | 新增命令 | 查询任意命令能力属性的 CLI 命令 | 新增命令，向后兼容 |
| 专用工具守门流程 | 行为约束 | archive/discard/new/init 必须实现标准守门流程 | 现有命令的增强约束 |
| 二次确认机制 | 行为约束 | 不可逆操作必须要求用户输入变更名称确认 | 现有命令的增强约束 |
| `--dry-run` 要求 | 行为约束 | 所有通用能力和专用工具必须支持 dry-run 模式 | 现有命令的增强约束 |
| `config.yaml` 能力分层配置 | 新增配置 | 允许覆盖命令的能力层级（general ↔ dedicated） | 新增配置项，向后兼容 |

---

## 上游/下游依赖方

| 依赖方 | 方向 | 兼容性 |
|--------|------|--------|
| src/cli/index.ts | 修改 | 注册 `capability` 命令 |
| src/cli/commands/*.ts | 修改 | 每个命令声明 CommandMetadata |
| src/core/types.ts | 新增 | CommandMetadata 接口 |
| src/core/capability-router.ts | 新增 | 能力路由与守门流程框架 |
| config.schema.ts | 修改 | 新增能力分层配置 |
| docs/reference/cli-commands.md | 文档 | 更新文档说明 |

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 现有命令未声明 CommandMetadata | 高 | 无法查询能力层级 | 分阶段实施：先默认 general，逐步标记 |
| 守门流程增加交互摩擦 | 中 | hotfix 场景效率下降 | `hotfix` 预设降级守门强度 |
| 能力分类争议 | 中 | 用户/开发者对层级判定不一致 | 提供配置覆盖 + 明确判定标准 |
| dry-run 格式与实际输出不一致 | 低 | 误导用户 | CI schema 校验 |

---

## 实施约束

- 能力分层属于**外部契约变更**，必须记录本变更记录
- 能力层级变更（提升/降低）必须走用户征询流程
- 向后兼容：现有命令默认 `tier: "general"`，仅 archive/discard 默认 `tier: "dedicated"`

---

## 用户征询记录

- 2026-08-09 用户要求添加本设计规范：通用基础能力用于组合与探索，专用工具用于约束高风险和强业务规则操作
