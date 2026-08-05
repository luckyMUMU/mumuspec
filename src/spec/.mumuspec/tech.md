---
scope: src/spec
layer: 2
last_updated: '2026-08-04'
---

# Technical Design: spec

## SHALL constraints (migrated from spec.md)

- spec.md 解析必须支持 YAML frontmatter（layer, scope, last_updated）
- 渐进式加载最多支持 3 层（Layer 0 → 1 → 2）
- 规范校验必须检测 SHALL without Enforcement 违规
- 继承冲突检测必须识别子层放松父层约束的非法行为
- Ponytail 约束注入必须保留原有需求不丢失

## SHALL NOT constraints (migrated from spec.md)

- 禁止解析器跳过 YAML 元数据格式校验（格式错误必须报错）
- 禁止加载器缓存过期 spec（freshness check_on_load 必须执行）
- 禁止继承合并时丢失父层 SHALL NOT 约束
- 不可覆盖手写的需求约束（Ponytail 注入保留用户定义）

## Enforcement (migrated from spec.md)

- SPEC-1: 检查 frontmatter 包含 layer/scope/last_updated
- SPEC-2: 检查 SHALL 约束有对应 Enforcement
- SPEC-3: 检查子层不放松父层约束

## 架构决策 (Architecture decisions)

- **解析分离**：parser.ts 负责文本解析（纯函数），loader.ts 负责 I/O 和层级管理
- **渐进式披露**：loadSpecContext 构建路径链，选择最多 3 层加载（root + parent + target）
- **正则块解析**：`## Requirement: <name>` 为块分隔符，提取 SHALL/SHALL NOT/Enforcement
- **继承规则**：子层 SHALL NOT 不能与父层 SHALL 冲突（子层可收紧但不能放宽）
- **Ponytail 7 级阶梯**：YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行代码 → 最小实现
- **Ponytail 注入**：injectPonytail 将 PONYTAIL_CONSTRAINTS 注入到根 spec.md，保留原有内容

## 接口契约 (Interface contracts)

```typescript
// parser.ts
function parseSpecFile(content: string, filePath: string): SpecFile;
function parseRequirements(body: string): Requirement[];

// loader.ts
function loadSpecContext(targetPath: string, projectRoot: string, config: MumuSpecConfig): SpecContext;
function searchSpecs(projectRoot: string, config: MumuSpecConfig, query: string): SpecFile[];

// validator.ts
function validateAllSpecs(projectRoot: string, config: MumuSpecConfig): GuardResult;

// inheritance.ts
function checkInheritanceConflicts(parentSpec: SpecFile, childSpec: SpecFile): InheritanceConflict[];
```

## 依赖关系 (Dependencies)

- **上游**：`src/core/types.js`、`src/core/config.js`、`src/core/utils.js`、`src/core/errors.js`
- **下游**：被 `src/guard/checker.ts`、`src/rules/generator.ts`、`src/cli/commands/spec.ts`、`src/mcp-server.ts` 调用
