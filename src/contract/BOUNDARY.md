---
scope: src/contract
layer: 2
---

# Boundary Document: contract

## 对外接口

### Loader（loader.ts）— 契约注册表加载 & 边界文档解析

| 函数 | 签名 | 用途 |
|------|------|------|
| `loadAllContracts` | `(projectRoot: string) => ContractRegistry` | 加载完整契约注册表（含 contracts/outbound/inbound/graph） |
| `loadContractRegistry` | `(dirPath: string) => ContractRegistry \| null` | 从指定目录的 contracts.yaml 加载registry |
| `findContract` | `(projectRoot: string, contractId: string) => Contract \| null` | 按 ID 查找契约 |
| `getOutboundContracts` | `(projectRoot: string) => Contract[]` | 获取所有 outbound 契约 |
| `getInboundContracts` | `(projectRoot: string) => Contract[]` | 获取所有 inbound 契约 |
| `discoverContractDirs` | `(projectRoot: string) => string[]` | 递归发现所有含 contracts.yaml 的目录（深度限制 8） |
| `resolveContractSource` | `(contractRef: string, fromDir: string) => string` | 相对路径转绝对路径 |
| `loadBoundaryDocument` | `(dirPath: string) => BoundaryDocument \| null` | 加载目录下的 BOUNDARY.md |
| `parseBoundaryDocument` | `(content: string, dirPath: string) => BoundaryDocument` | 解析 BOUNDARY.md 文本为结构化对象 |
| `findAllBoundaryDocuments` | `(projectRoot: string) => BoundaryDocument[]` | 发现项目内所有 BOUNDARY.md |

### Validator（validator.ts）— 漂移检测 & 边界校验

| 函数 | 签名 | 用途 |
|------|------|------|
| `detectContractDrift` | `(projectRoot: string) => DriftReport` | 全量 drift 检测（源文件缺失/弃用/模式不匹配/依赖图/分类强制规则） |
| `validateBoundaries` | `(projectRoot: string) => BoundaryValidationResult[]` | 校验所有代码目录的 BOUNDARY.md 完整性和一致性 |

### Impact Analyzer（impact-analyzer.ts）— 变更影响分析

| 函数 | 签名 | 用途 |
|------|------|------|
| `analyzeContractImpact` | `(projectRoot: string, contractId: string, changeType: 'modify' \| 'remove' \| 'deprecate') => ContractImpactAnalysis` | 分析契约变更的上游/下游影响、breaking 标志、风险等级、缓解措施 |
| `formatImpactReport` | `(analysis: ContractImpactAnalysis) => string` | 将分析结果格式化为人类可读报告 |

### Manager（manager.ts）— 写路径操作

| 函数 | 签名 | 用途 |
|------|------|------|
| `persistContract` | `(projectRoot: string, contract: Contract, options?: { create?: boolean; actor?: string }) => { success: boolean; message: string }` | 创建或更新契约（自动合并 outbound/inbound，写入 audit） |
| `deprecateContract` | `(projectRoot: string, contractId: string, options?: { migrationPath?: string; actor?: string }) => { success: boolean; message: string; impact?: ContractImpactAnalysis }` | 弃用契约（先分析影响再持久化） |
| `removeContract` | `(projectRoot: string, contractId: string, options?: { actor?: string }) => { success: boolean; message: string; impact?: ContractImpactAnalysis }` | 移除契约（有上游消费者时安全阻断，清理 dependency_graph） |
| `appendContractAuditLog` | `(projectRoot: string, entry: ContractAuditEntry) => { success: boolean }` | 追加审计日志条目（自动创建目录，失败时 console.warn） |
| `readAuditLog` | `(projectRoot: string) => ContractAuditEntry[]` | 读取审计日志（跳过损坏 JSON 行） |
| `scaffoldBoundary` | `(dirPath: string): string` | 从代码文件自动分析 export/import 生成 BOUNDARY.md 模板内容 |
| `writeBoundary` | `(dirPath: string, content: string): string` | 写入 BOUNDARY.md 到指定目录（自动创建目录） |

### 导出类型（type-contract.ts，通过 barrel re-export）

| 类型 | 用途 |
|------|------|
| `Contract` | 实体契约定义（id/name/category/criticality/status/version/owner/upstream/downstream/schema/examples） |
| `ContractRegistry` | 契约注册表（version/last_updated/contracts/outbound_ids/inbound_ids/dependency_graph） |
| `ContractCategory` | 契约分类：`api \| database \| messaging \| serialization \| sdk \| cli \| filesystem \| config` |
| `ContractCriticality` | 关键度：`critical \| standard \| low` |
| `ContractStatus` | 状态：`draft \| active \| deprecated \| retired` |
| `ContractDrift` | 漂移条目（type/severity/id/contract_id/message/expected/actual/suggestion/error_code） |
| `DriftReport` | 漂移报告（drift_count/error_count/warning_count/drifts/checked_at） |
| `BoundaryDocument` | 边界文档结构（dir_path/external_apis/dependencies_internal/data_contracts/change_log） |
| `BoundaryExport` | 导出符号描述（name/kind/signature/description） |
| `BoundaryDependency` | 依赖描述（name/type/version/description） |
| `BoundaryChangeEntry` | 变更日志条目（date/description/breaking） |
| `BoundaryValidationResult` | 单目录边界校验结果（dir_path/has_boundary_doc/errors/warnings） |
| `ContractImpactAnalysis` | 影响分析结果（contract_id/change_type/breaking/risk/upstream_impact/downstream_impact/mitigations） |
| `ImpactEntry` | 影响条目（id/description/breaking/effort） |
| `ContractAuditEntry` | 审计日志条目（timestamp/actor/action/contract_id/details/impact_risk） |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读写（readdirSync/readFileSync/writeFileSync/appendFileSync/mkdirSync/existsSync） |
| `node:path` | 路径解析（join/resolve/dirname） |
| `yaml` | YAML 解析与序列化 |
| `./core/types-contract.js` | 类型定义（Contract/ContractRegistry/BoundaryDocument/DriftReport 等） |

### 外部依赖

- `yaml`（npm 包，https://eemeli.org/yaml/）

### 反向依赖（谁调用 contract 层）

| 调用方 | 用途 |
|--------|------|
| `src/mcp-server.ts` | MCP 工具 handler 调用 loader/validator/impact-analyzer/manager |
| `src/cli/commands/contract.ts` | CLI 命令调用 loader/validator/manager |
| `src/guard/checker.ts` | Guard 层调用 `detectContractDrift` 做跨目录契约漂移校验 |

## 数据契约

### 输入

- 项目根路径（projectRoot: string）
- 目录路径（dirPath: string）
- 契约 ID（contractId: string）
- 完整契约对象（Contract，用于持久化）
- 变更类型（changeType: 'modify' | 'remove' | 'deprecate'）

### 输出

- 契约注册表文件：`.mumuspec/contracts/contracts.yaml`
- 边界文档：`<code-dir>/BOUNDARY.md`
- 审计日志：`.mumuspec/contracts/audit.log`
- 结构化数据（ContractRegistry / DriftReport / BoundaryValidationResult / ContractImpactAnalysis）

### 文件格式

**contracts.yaml 结构**：
```yaml
version: '1.0.0'
last_updated: '2026-08-04T...'
contracts:
  - id: 'svc.auth'
    name: 'Auth Service'
    category: api
    criticality: critical
    status: active
    version: '1.0.0'
    owner: 'team-name'
    description: '...'
    upstream: [consumer-a, consumer-b]
    downstream: [db.users]
    schema: {}
    examples: []
outbound_ids: [...]
inbound_ids: [...]
dependency_graph: {}
```

**audit.log 格式**：每行一个 JSON 对象，包含 timestamp/actor/action/contract_id/details/impact_risk。

## 错误码映射

本模块在 validator.ts 中产生以下 E-CONTRACT 错误码：

| 错误码 | 触发场景 | 严重度 |
|--------|---------|--------|
| E-CONTRACT-001 | 代码目录缺少 BOUNDARY.md | WARN |
| E-CONTRACT-002 | BOUNDARY.md 中声明的导出在代码中找不到 | ERROR |
| E-CONTRACT-003 | BOUNDARY.md 中声明的依赖在代码中未使用 | WARN |
| E-CONTRACT-004 | BOUNDARY.md 变更日志为空 | WARN |
| E-CONTRACT-005 | 契约 source 字段引用的源文件不存在 | ERROR |
| E-CONTRACT-006 | 已弃用契约仍有上游消费者 | WARN |
| E-CONTRACT-007 | 契约缺少 schema 定义 | WARN |
| E-CONTRACT-008 | 依赖图存在悬空引用（outbound/inbound/downstream 指向不存在的契约 ID） | WARN |
| E-CONTRACT-009 | 分类强制规则违反（API 无示例/CLI 无 flags/DB 无版本/SDK 无 owner） | WARN |

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | Contract Layer 全量实现（loader/validator/impact-analyzer/manager 4 模块） | 新增契约管理功能 |
| 2026-08-04 | validator.ts 引用 E-CONTRACT-005~009 错误码 | drift 报告增加 programmatic error_code |
| 2026-08-04 | MCP TOOLS 数组补全 persist/deprecate/remove 声明 | 契约写路径工具可通过 MCP 调用 |
| 2026-08-04 | manager.ts 审计 action 修正为 'deprecate' | 审计日志语义精确化 |
| 2026-08-04 | loader.ts discoverContractDirs 增加深度限制 8 | 防止极端目录结构栈溢出 |
