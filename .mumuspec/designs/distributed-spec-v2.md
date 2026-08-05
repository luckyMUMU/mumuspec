# Design: 分布式 Spec 生成优化（Distributed Spec V2）

> **Status**: Draft
> **Created**: 2026-08-02
> **Scope**: `src/spec/*`, `src/core/spec-scaffolder.ts`, `src/core/types-spec.ts`, `src/core/types-workflow.ts`, `src/cli/commands/spec.ts`, `src/cli/commands/change.ts`

---

## 1. 背景与问题陈述

当前分布式 spec 生成机制（由 `spec-scaffolder.ts` 驱动）存在 **7 类阻断性不符合项**，导致生成的 prd.md / tech.md 无法被框架的 parser / loader / validator 正确消费：

| # | 根因 | 影响模块 | 严重度 |
|---|------|---------|--------|
| F1 | 生成文件 frontmatter 缺少必填 `scope` 字段 | `parser.ts` | ERROR |
| F2 | 生成文件使用自定义标题而非 `## Requirement:` 格式 | `parser.ts` | ERROR |
| F3 | `parent_prd`/`parent_tech` 字段不被 loader 处理 | `loader.ts`, `inheritance.ts` | ERROR |
| F4 | 根 spec.md 的 delta-merged 块非标准格式 | `parser.ts` | WARN |
| F5 | `index.yaml` 的 `dist_spec` 字段不被读取 | `loader.ts` | WARN |
| F6 | 变更状态未指向分布式 spec | `guard/checker.ts` | WARN |
| F7 | 根目录缺少 `goal.md` / `env-spec.md` | 完整性 | WARN |

验证"通过"的根因：`validator.ts` 仅检查 `.mumuspec/spec.md`，不覆盖 prd.md / tech.md。

---

## 2. 设计目标

| ID | 目标 | 衡量标准 |
|----|------|---------|
| G1 | 所有分布式 spec 文件可被 parser 正确解析 | `parsePrdFile` / `parseTechFile` 不抛异常且 requirements 非空 |
| G2 | prd.md / tech.md 继承链条可被 loader 加载 | `loadSpecContext()` 返回的 layers 包含父子合并后的完整 Requirement 列表 |
| G3 | 变更级分布式 spec 纳入 validator 校验范围 | `validateAllSpecs` 对每个 `.mumuspec/` 下的 prd.md + tech.md 执行格式/冲突校验 |
| G4 | 变更状态 `.mumuspec.yaml` 绑定分布式 spec 元数据 | `guard verify` 能检测分布式文件的增量变更 |
| G5 | 向后兼容——老项目（仅有 spec.md）无需修改即可继续工作 | 所有新字段均为 optional |

---

## 3. 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                         mumuspec init / new                       │
│                             │                                     │
│                             ▼                                     │
│                   spec-scaffolder.ts (重写)                       │
│                   ┌─────────────────────┐                         │
│                   │ generateTechSpec()  │──► .mumuspec/tech.md    │
│                   │ generatePrdSpec()   │──► .mumuspec/prd.md     │
│                   │ generateGoalSpec()  │──► .mumuspec/goal.md    │
│                   │ generateEnvSpec()   │──► .mumuspec/env-spec.md│
│                   └─────────────────────┘                         │
│                             │                                     │
│                             ▼                                     │
│          产出格式：标准 Requirement 块 + 完整 frontmatter         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      mumuspec context / validate                  │
│                             │                                     │
│                             ▼                                     │
│            loader.ts ──► parser.ts ──► inheritance.ts             │
│              │                │                │                   │
│              ▼                ▼                ▼                   │
│      读取 parent_prd/   解析 Requirement  父子 SHALL/SHALL NOT    │
│      parent_tech 并加载  块，返回结构化    冲突检测 + 合并         │
│──────────────────────────────────────────────────────────────────│
│                         mumuspec validate                         │
│                             │                                     │
│                             ▼                                     │
│                  validator.ts (扩展)                               │
│                  ┌────────────────────────┐                       │
│                  │ 对每个 .mumuspec/ 下    │                       │
│                  │ prd.md / tech.md 调用   │                       │
│                  │ parsePrdFile / parseTech│                       │
│                  │ File，执行格式+冲突校验 │                       │
│                  └────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. 数据模型扩展

### 4.1 SpecFrontmatter（`types-spec.ts`）

```typescript
export interface SpecFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
  /** 新增：指向父 PRD 的相对路径 */
  parent_prd?: string;
  /** 新增：指向父 Tech 的相对路径 */
  parent_tech?: string;
  /** 新增：文档类型标识 */
  doc_type?: 'spec' | 'prd' | 'tech' | 'design' | 'prohibitions';
}
```

### 4.2 PrdFrontmatter（`types-spec.ts` 新增）

```typescript
export interface PrdFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
  parent_prd?: string;
  doc_type?: 'prd';
  change?: string;
}
```

### 4.3 TechFrontmatter（`types-spec.ts` 新增）

```typescript
export interface TechFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
  parent_tech?: string;
  doc_type?: 'tech';
  change?: string;
  phase?: 'design' | 'build' | 'verify';
}
```

### 4.4 ChangeState.dist_spec（`types-workflow.ts`）

```typescript
export interface ChangeState {
  // ... existing fields ...

  /** 新增：分布式 spec 指针 */
  dist_spec?: {
    prd: string;          // e.g., ".mumuspec/prd.md"
    tech: string;         // e.g., ".mumuspec/tech.md"
    spec?: string;        // e.g., ".mumuspec/spec.md"
  };
}
```

### 4.5 SpecLayerContext 扩展（`types-spec.ts`）

```typescript
export interface SpecLayerContext {
  level: number;
  scope: string;
  path: string;
  /** @deprecated Use tech instead */
  spec?: SpecFile;
  /** @deprecated Use prd instead */
  design?: DesignFile;
  prd?: PrdFile;
  tech?: TechFile;
  /** 新增：是否为继承合并后的结果 */
  merged?: boolean;
  /** 新增：继承来源路径（用于调试） */
  inherited_from?: string[];
}
```

---

## 5. 模块扩展设计

### 5.1 parser.ts（`src/spec/parser.ts`）

#### 新增导出函数

```typescript
export function parsePrdFile(content: string, filePath: string): PrdFile;
export function parseTechFile(content: string, filePath: string): TechFile;
export function serializePrdFile(prd: PrdFile): string;
export function serializeTechFile(tech: TechFile): string;
export function createDefaultPrdContent(layer: number, scope: string, change?: string): string;
export function createDefaultTechContent(layer: number, scope: string, change?: string, phase?: string): string;
```

#### Requirement 块复用策略

prd.md 和 tech.md 内部的正向约束 / 反向约束统一使用标准 Requirement 块格式：

```markdown
## Requirement: <name>

### SHALL
- <constraint>

### SHALL NOT
- <constraint>

### SHOULD
- <constraint>

### Enforcement
- <id>: <description>
```

**原因**：
- 复用现有 `parseRequirements()` 逻辑，无需新增正则
- validator 可直接对 prd.md / tech.md 执行 E-SPEC-004（SHALL without Enforcement）检查
- guard 可直接提取 SHALL / SHALL NOT 做代码合规性检查

#### 向后兼容

`parseSpecFile()` 签名不变。`doc_type` 字段为 optional，老 spec.md 无需修改。

---

### 5.2 loader.ts（`src/spec/loader.ts`）

#### 新增：继承解析

```typescript
function resolveParentRefs(
  frontmatter: SpecFrontmatter | PrdFrontmatter | TechFrontmatter,
  currentDir: string,
  root: string,
): { parentSpec?: SpecFile; parentPrd?: PrdFile; parentTech?: TechFile };
```

#### 修改：`loadSpecContext()` 流程

```
1. 从 targetPath 向上遍历到 root
2. 在每个 .mumuspec/ 目录中:
   a. 发现 spec.md → parseSpecFile → 推入 layers
   b. 发现 prd.md → parsePrdFile → 推入 layers
   c. 发现 tech.md → parseTechFile → 推入 layers
   d. 读取 frontmatter.parent_prd / parent_tech
      → resolveParentRefs()
      → 与当前层执行 mergeSpecs() / mergePrdFiles() / mergeTechFiles()
      → 标记 layer.merged = true, layer.inherited_from = [...]
3. 对相邻层执行 checkInheritanceConflicts()
```

#### 新增：`mergePrdFiles()` / `mergeTechFiles()`

```typescript
export function mergePrdFiles(parent: PrdFile, child: PrdFile): PrdFile;
export function mergeTechFiles(parent: TechFile, child: TechFile): TechFile;
```

#### 新增：`findAllDistributedSpecDirs()`

```typescript
export interface SpecDirEntry {
  dir: string;
  files: string[];  // 存在的文件名数组
}

export function findAllDistributedSpecDirs(root: string): SpecDirEntry[];
```

---

### 5.3 validator.ts（`src/spec/validator.ts`）

#### 修改：`validateAllSpecs()` 校验范围

扩展校验范围从 "仅 spec.md" 到 "spec.md + prd.md + tech.md"：

```
1. 调用 findAllDistributedSpecDirs(root)
2. 对每个目录的每个文件:
   a. spec.md → parseSpecFile → 执行现有校验
   b. prd.md → parsePrdFile → 执行 E-SPEC-008 (frontmatter), E-SPEC-004 (enforcement missing)
   c. tech.md → parseTechFile → 执行 E-SPEC-009 (frontmatter), E-SPEC-004 (enforcement missing)
3. 父子冲突检测:
   a. 读取 child.parent_prd / parent_tech
   b. 加载对应父文件
   c. 调用 checkInheritanceConflicts()
4. 新增 E-SPEC-010: parent_prd/parent_tech 指向不存在的文件
```

#### 新增错误码（`errors.ts`）

```typescript
'E-SPEC-008': {
  code: 'E-SPEC-008',
  name: 'PRD_FRONTMATTER_INVALID',
  severity: 'ERROR',
  description: 'prd.md frontmatter 缺少必填字段 (layer, scope)',
  fixSteps: ['添加 layer 和 scope 字段', '运行 mumuspec validate'],
  forceable: false,
},
'E-SPEC-009': {
  code: 'E-SPEC-009',
  name: 'TECH_FRONTMATTER_INVALID',
  severity: 'ERROR',
  description: 'tech.md frontmatter 缺少必填字段 (layer, scope)',
  fixSteps: ['添加 layer 和 scope 字段', '运行 mumuspec validate'],
  forceable: false,
},
'E-SPEC-010': {
  code: 'E-SPEC-010',
  name: 'PARENT_SPEC_NOT_FOUND',
  severity: 'ERROR',
  description: 'parent_prd 或 parent_tech 指向的文件不存在',
  fixSteps: ['检查路径是否正确', '创建缺失的父文档或移除引用'],
  forceable: false,
},
'E-SPEC-011': {
  code: 'E-SPEC-011',
  name: 'DISTRIBUTED_SPEC_FORMAT_INVALID',
  severity: 'WARN',
  description: '分布式 prd.md/tech.md 使用非 Requirement 块格式',
  fixSteps: ['使用 ## Requirement: <name> 格式定义约束', '运行 mumuspec validate --verbose'],
  forceable: true,
},
'E-SPEC-012': {
  code: 'E-SPEC-012',
  name: 'DIST_SPEC_SHALL_UNIMPLEMENTED',
  severity: 'ERROR',
  description: 'tech.md 中声明的 SHALL 约束在代码中找不到实现',
  fixSteps: ['检查代码是否满足约束', '或更新 tech.md 移除/调整约束'],
  forceable: false,
},
```

---

### 5.4 spec-scaffolder.ts（`src/core/spec-scaffolder.ts`）

#### 重写核心生成函数

关键变更：所有生成输出必须使用标准 `## Requirement:` 块格式。

```typescript
export function generateTechSpec(
  inference: TechInference,
  options: {
    layer: number;
    scope: string;
    change?: string;
    parentTechRelPath?: string;
    phase?: 'design' | 'build' | 'verify';
    childSummaries?: string[];
  }
): string;

export function generatePrdSpec(
  inference: PrdInference,
  options: {
    layer: number;
    scope: string;
    change?: string;
    parentPrdRelPath?: string;
  }
): string;
```

#### 生成输出示例（tech.md）

```markdown
---
layer: 1
scope: ".changes/tool-plugin-protocol"
doc_type: tech
change: tool-plugin-protocol
parent_tech: ../../../tech.md
phase: design
last_updated: "2026-08-02"
---

## Requirement: 插件化工具架构约束

### SHALL
- 所有工具必须通过 plugin.yaml 声明元数据
- 工具必须支持标准的 ToolResult 返回格式
- 插件间通信必须通过 registry_bridge，禁止直接 import

### SHALL NOT
- 禁止插件绕过 registry 直接访问全局状态
- 禁止在 plugin.yaml 之外维护隐式依赖
- 禁止修改其他插件的内部状态

### SHOULD
- 推荐使用共用的 _cli_common.py 模块处理 CLI 参数

### Enforcement
- TECH-1: 检查 plugin.yaml 存在且 schema 合法
- TECH-2: 检查工具模块使用 ToolResult 标准返回类型
- TECH-3: 检查无跨插件隐式依赖

## Requirement: 当前代码状态快照

### SHALL
- app/tools/ 下 12 个工具模块必须保持现有接口不变
- _classifier_v5.py 的签名在 V5 协议锁定后必须稳定

### SHALL NOT
- 禁止在不更新 CHANGELOG 的情况下修改公共 API

---

## Appendix: 后续待办（非本变更范围）

- app/tools/ 下分类工具性能优化
- web_search 工具的 mock 测试覆盖
```

#### 生成输出示例（prd.md）

```markdown
---
layer: 1
scope: ".changes/tool-plugin-protocol"
doc_type: prd
change: tool-plugin-protocol
parent_prd: ../../../prd.md
last_updated: "2026-08-02"
---

## Requirement: 变更功能目标

### SHALL
- 将 12 个独立脚本工具重构为可插拔 plugin 体系
- 保持现有 CLI 100% 向后兼容

### SHALL NOT
- 不可破坏现有的 CLI 调用签名
- 不可移除正在使用的工具

### Enforcement
- PRD-1: 所有现有 CLI 命令的输出格式与重构前一致
- PRD-2: plugin 系统加载时间增量 < 100ms

## Requirement: 用户场景

### SHALL
- 开发者可通过 plugin.yaml 声明新工具
- 运行时自动发现并注册可用工具

### SHOULD
- 推荐为每个 plugin 提供独立的 SKILL.md 文档
```

#### 新增：`scaffoldChangeSpecs()`

```typescript
export function scaffoldChangeSpecs(
  changeDir: string,
  changeName: string,
  options: {
    parentRoot: string;
    phase: 'design' | 'build';
  }
): { prdPath: string; techPath: string } {
  const prdPath = join(changeDir, '.mumuspec', 'prd.md');
  const techPath = join(changeDir, '.mumuspec', 'tech.md');

  const relPath = relative(changeDir, options.parentRoot);
  const parentPrd = join(relPath, '.mumuspec', 'prd.md');
  const parentTech = join(relPath, '.mumuspec', 'tech.md');

  const prdInference = inferPrdContent(moduleAnalysis);
  writeText(prdPath, generatePrdSpec(prdInference, {
    layer: 1,
    scope: `.changes/${changeName}`,
    change: changeName,
    parentPrdRelPath: parentPrd,
  }));

  const techInference = inferTechConstraints(moduleAnalysis);
  writeText(techPath, generateTechSpec(techInference, {
    layer: 1,
    scope: `.changes/${changeName}`,
    change: changeName,
    parentTechRelPath: parentTech,
    phase: options.phase,
  }));

  return { prdPath, techPath };
}
```

---

### 5.5 guard/checker.ts / change 状态机

#### 扩展：guard verify 逻辑

```
verify-phase guard 检查新增步骤:
1. 如果 change.dist_spec 存在:
   a. 检查 dist_spec.prd / dist_spec.tech 文件是否存在
   b. 调用 parsePrdFile / parseTechFile 解析
   c. 检查是否有未解决的 SHALL 约束
   d. 生成 E-SPEC-012: 分布式 spec SHALL 约束未实现
```

---

### 5.6 CLI 命令扩展（`src/cli/commands/spec.ts`, `src/cli/commands/change.ts`）

#### 新增：`mumuspec sync-specs`

```
mumuspec sync-specs [--change <name>]

功能:
1. 扫描所有 .mumuspec/ 目录
2. 检查 frontmatter 字段完整性
3. 重新生成缺失的 goal.md / env-spec.md
4. 更新 index.yaml 的 dist_spec 指针
5. 报告所有父子继承冲突
```

#### 修改：`mumuspec validate`

默认行为扩展：自动校验 prd.md + tech.md（不仅限于 spec.md）。加入 `--strict-distributed` 参数在老项目中启用严格模式。

#### 新增：`mumuspec init --distributed`

初始化完整分布式结构（含 goal.md / env-spec.md / prohibitions.md 模板）。

---

## 6. 文件输出格式完整规范

### 6.1 Frontmatter 必填字段矩阵

| 字段 | spec.md | prd.md | tech.md | design.md |
|------|---------|--------|---------|-----------|
| layer | ✅ | ✅ | ✅ | ❌ |
| scope | ✅ | ✅ | ✅ | ❌ |
| last_updated | ✅ | ✅ | ✅ | ❌ |
| doc_type | optional | `prd` | `tech` | optional |
| parent_prd | — | optional | — | — |
| parent_tech | — | — | optional | — |
| change | — | optional | optional | — |
| phase | — | — | optional | — |

### 6.2 Body 格式约束

所有结构化的 SHALL/SHALL NOT 约束 **必须** 使用 `## Requirement:` 格式。

自由格式内容（代码快照、待办清单）放在文档末尾 `## Appendix:` 标注，不参与框架 SHALL 校验。

### 6.3 推荐文件布局

```
.mumuspec/
├── spec.md            ← 保留，向后兼容（可被 tech.md 替代）
├── prd.md             ← 产品视角
├── tech.md            ← 技术视角（含 SHALL/SHALL NOT）
├── design.md          ← 架构设计
├── goal.md            ← 项目/变更目标
├── env-spec.md        ← 环境要求
├── prohibitions.md    ← 全局禁止项
├── index.yaml         ← 索引
├── config.yaml        ← 配置
└── changes/
    └── <change-name>/
        ├── .mumuspec.yaml     ← 含 dist_spec 指针
        └── .mumuspec/
            ├── prd.md         ← parent_prd: ../../../prd.md
            ├── tech.md        ← parent_tech: ../../../tech.md
            └── spec.md        ← 可选，变更独立约束
```

---

## 7. 迁移路径

### 阶段 1：格式扩展（不 breaking，minor version）
- 扩展 `SpecFrontmatter` 类型，新增 optional 字段
- 扩展 parser 支持 parsePrdFile / parseTechFile
- validator 默认跳过格式不符的文件（WARN 不报错）
- scaffolder 输出兼容新格式

### 阶段 2：生成器重写（minor version）
- 重写 `spec-scaffolder.ts` 的 generateTechMd / generatePrdMd → generateTechSpec / generatePrdSpec
- `mumuspec init --distributed` 生成完整布局
- `mumuspec new` 自动调用 `scaffoldChangeSpecs()`

### 阶段 3：严格校验（major version）
- validator 默认将老格式文件报 E-SPEC-011（WARN）
- `mumuspec sync-specs` 提供自动修复命令
- 错误码 E-SPEC-010 / E-SPEC-012 升级为 ERROR

### 阶段 4：清理（可选，next major）
- `spec.md` 标记为 `@deprecated`，推荐使用 prd.md + tech.md
- 保留 parseSpecFile 确保向后兼容

---

## 8. 验证策略

### 8.1 单元测试

| 测试项 | 验证内容 |
|--------|---------|
| parsePrdFile 基础 | frontmatter 完整 → 正常解析，requirements 非空 |
| parsePrdFile 缺失 scope | 抛 E-SPEC-008 |
| parseTechFile 基础 | frontmatter + Requirements 块 → 正常解析 |
| parseTechFile 无 Requirement 块 | requirements 为空数组（不抛错，但 validator WARN） |
| serializeTechFile 往返 | parse → serialize → parse 结果一致 |
| mergeTechFiles | 父子同名 requirement SHALL 合并，不重复 |
| checkInheritanceConflicts (cross-type) | 子 tech SHALL NOT 与父 tech SHALL 冲突 → 返回冲突 |
| scaffoldChangeSpecs | 产出文件可被 parseTechFile 解析 |
| sync-specs 修复 | 缺失 scope → 自动补全 |

### 8.2 集成测试

| 测试项 | 验证内容 |
|--------|---------|
| 初始化分布式项目 | `mumuspec init --distributed` 后 `validate` 全部通过 |
| 创建变更带 spec | `mumuspec new` 创建的变更 tech.md 可被 context 加载 |
| 继承链验证 | 子 tech.md 的 SHALL 可被 loader 合并到根层 |
| 冲突检测 | 父 SHALL + 子 SHALL NOT 报 E-SPEC-003 |
| 老项目兼容 | 仅有 spec.md 的项目 validate 行为不变 |

---

## 9. 风险与权衡

| 风险 | 缓解 |
|------|------|
| 老项目升级成本高 | 阶段 1 采用 optional 字段 + WARN，不强制 |
| Requirement 块格式限制表达能力 | Appendix 部分允许自由格式；仅在主体约束部分要求结构化 |
| 父子继承解析可能循环 | 限制最大继承深度 = max_layer_depth（已有配置），超出报错 |
| scaffolder 产出代码快照部分无法用 Requirement 格式 | 使用 `## Appendix:` 区块标注，与约束部分隔离 |
| 多个 doc_type 的序列化/反序列化一致性 | 每个 doc_type 独立 serialize 函数，共享 Requirement 解析核心 |

---

## 10. 关键决策记录

| ID | 决策 | 理由 |
|----|------|------|
| D-001 | prd.md / tech.md 复用 spec.md 的 Requirement 块格式 | 复用 parser 逻辑、复用 validator 检查、复用 guard 提取器 |
| D-002 | 新增 `doc_type` frontmatter 字段 | 让 loader 区分文件类型，分发不同的 parse 函数 |
| D-003 | 新增独立 `ChangeState.dist_spec` 字段 | 避免在现有 affected_scopes 中塞入路径语义不匹配的数据 |
| D-004 | 继承通过 frontmatter 声明而非目录推断 | 允许变更级 spec 指向任意父文档；支持跨目录引用 |
| D-005 | Appendix 区块不参与 SHALL 校验 | 代码快照、待办清单等描述性内容不适合用结构化约束表达 |
| D-006 | 分 4 阶段迁移 | 保证老项目不中断，渐进采用新格式 |

---

## 11. 验收标准

完成此设计后，以下命令在新的分布式项目上应当通过：

```bash
$ mumuspec init --distributed
$ cd .mumuspec/changes/my-change
$ head -10 .mumuspec/tech.md
---
layer: 1
scope: ".changes/my-change"
doc_type: tech
change: my-change
parent_tech: ../../../tech.md
phase: design
last_updated: "2026-08-02"
---
$ mumuspec validate
✓ All specs (1 spec.md + 6 prd.md + 6 tech.md) are valid
✓ 0 inheritance conflicts detected
$ mumuspec context .
Spec Context for: /project
=== Level 0: . ===
  Tech (12 requirements):
    ## Plugin Architecture
    SHALL:
      - 所有工具必须通过 plugin.yaml 声明元数据
      ...
=== Level 1: .changes/my-change ===
  Tech (18 requirements, merged from parent):
    ## Plugin Architecture (inherited)
    ...
    ## Change-specific constraints
    SHALL:
      - ...
```
