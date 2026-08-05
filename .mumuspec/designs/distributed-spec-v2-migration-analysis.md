# 分析：旧项目正确应用分布式 Spec V2 格式

> 日期：2026-08-02  
> 目的：为已有大量历史内容的旧项目提供正确的应用策略，确保零破坏前提下渐进采用 V2

---

## 1. 现状盘点

### 1.1 两个项目现存格式对比

| 维度 | mumuspec CLI（TypeScript） | py/new（Python） |
|------|---------------------------|------------------|
| 根 `prd.md` frontmatter | `scope: .` `layer: 0` `last_updated` （无 `doc_type`，旧格式） | `document: PRD` `version: 1.0.0` `project: folder-classifier` `layer: 0` `cross_refs` （无 `doc_type`，无 `scope`，旧格式） |
| 根 `tech.md` frontmatter | 同 prd.md（无 `doc_type`） | `document: Tech Spec` `version` `project` `layer: 1` `cross_refs` （无 `doc_type`，旧格式） |
| 根 `spec.md` | `## Requirement:` 块（已兼容） | 未知 |
| 根 `goal.md` | ✅ 存在（旧 format） | ❌ 缺失 |
| 根 `env-spec.md` | ✅ 存在（旧 format） | ❌ 缺失 |
| change `.mumuspec.yaml` | `dashboard-onboard-chat`. ❌ 无 `dist_spec` 字段 | 5 个活跃 change，❌ 无 `dist_spec` 字段 |
| change 级 `prd.md` | ❌ 无 `.mumuspec/` 目录 | ✅ 存在，旧 format（`document: PRD` + `parent_prd`）|
| change 级 `tech.md` | ❌ 无 `.mumuspec/` 目录 | ✅ 存在，旧 format（`document: Tech Spec` + `parent_tech`）|

### 1.2 旧格式的两种典型形态

**形态 A — `scope/layer` 格式（mumuspec CLI 根文件）**：
```yaml
---
scope: .
layer: 0
last_updated: "2026-08-02"
---
# 产品需求概览: MumuSpec

## 产品定位
```

**形态 B — `document/version/project/cross_refs` 格式（py/new 根文件）**：
```yaml
---
document: Tech Spec
version: 1.0.0
project: folder-classifier
layer: 0
cross_refs:
  - spec.md
  - design.md
---
# Tech Spec: 智能文件夹分类管理系统
```

两种形态均缺少关键的 `doc_type: prd` 或 `doc_type: tech` 标识。

### 1.3 Change 级旧格式

```yaml
---
document: PRD
version: 1.0.0
change: tool-plugin-protocol
parent_prd: ../../../prd.md
layer: 1
phase: design
last_updated: "2026-08-02"
---
```

形态类似，靠 `document: PRD/Tech` 区分，用 `parent_prd/parent_tech` 表示继承关系。

---

## 2. 关键设计保障：零破坏的向后兼容

### 2.1 V2 验证器的判定逻辑

```
加载 .mumuspec/<file>
         ↓
文件是 prd.md 或 tech.md？
         ↓ 是
读取内容 → 检查是否包含 /^doc_type:\s*prd/m 或 doc_type:\s*tech/m
         ↓                    ↓
       是 V2 格式          不是 V2 格式
         ↓                    ↓
  V2 严格校验            跳过（静默忽略）
  frontmatter 完整性     
  Requirement 块检测     
```

**结果**：所有旧格式文件对验证器完全透明，不会触发任何错误或警告。

### 2.2 Loader 行为

- 加载 `prd.md` 时使用 `parsePrdFile()`：如果 frontmatter 缺少 `doc_type` 字段但仍包含有效的 `layer` + `scope`，解析**可以成功**（只需要这两个字段）。但如果缺少 scope 会抛错，由调用方 catch 跳过。
- 实际影响：旧文件的内容仍会作为 `layer.prd` 上下文的**纯文本**参与 progressive disclosure，但不参与 SHALL/SHALL NOT 约束检查。

### 2.3 `mumuspec init`/`mumuspec new` 行为

- `mumuspec init` 时不传 `--distributed`：生成根 `prd.md`/`tech.md` 为旧 format（无 doc_type），无 goal.md/env-spec.md。
- `mumuspec init --distributed`：生成 V2 format 全部 4 个文件。
- `mumuspec new`（无变化）：使用 `scaffoldChangeSpecs` 生成 V2-format 的 change 级 `.mumuspec/prd.md` + `tech.md`。

**兼容保障**：新 V2 文件与旧文件共存时，loader 和 validator 会自动区分对待。

---

## 3. 应用策略

### 3.1 核心原则："按需增量，不强制执行"

| 策略 | 建议 |
|------|------|
| 🟢 **不破坏** | 旧文件保持旧格式，不做转换，不触发任何新错误 |
| 🟢 **低风险** | 新增 change 自动使用 V2 格式，与旧 change 无冲突 |
| 🟢 **可回滚** | V2 文件可被 `mumuspec sync-specs` 移除，恢复旧格式 |
| 🟡 **渐进推进** | 仅当某模块的约束需要 guard 检查（SHALL/SHALL NOT）时才迁移 |

### 3.2 三种角色场景

#### 场景 A：零内容的新项目 → 直接使用 V2

```bash
mumuspec init --distributed --name my-project
```

V2 生成：`prd.md` / `tech.md` / `goal.md` / `env-spec.md`，所有带 `doc_type`。

#### 场景 B：有历史内容的项目（如 py/new、mumuspec CLI） → 渐进推进

**Step 1 — 先补全根项目 goal.md 和 env-spec.md**

这是 V2 spec.md 规范要求的文件。当前两个项目都缺少或不全。

```bash
cd .mumuspec
# 手动创建（或自定义模板）
```

`goal.md` 只需满足：
```yaml
---
project: <project-name>
last_updated: "2026-08-02"
---
# 项目目标
```

**Step 2 — 运行 `mumuspec sync-specs --fix` 修补可自动修复的问题**

检查：frontmatter 缺失 scope、缺失 last_updated 等。

**Step 3 — 选定迁移目标**

选择"当前活跃的 change"或"需要 guard 检查的高价值模块"进行 V2 迁移。

#### 场景 C：有活跃 change 的项目 → 按 change 逐步升级

py/new 有 5 个活跃 change（tool-plugin-protocol, arch-refactor 等），每个都有 `.mumuspec/prd.md` + `tech.md` 但为旧格式。

---

## 4. 针对 py/new 项目的具体应用方案

### 4.1 最低限度改动（验证通过）

| 改动 | 文件 | 说明 |
|------|------|------|
| 创建 goal.md | `.mumuspec/goal.md` | 根目录必需 |
| 创建 env-spec.md | `.mumuspec/env-spec.md` | 根目录必需 |
| 补全 `.mumuspec.yaml` 字段 | `.mumuspec/changes/*/ .mumuspec.yaml` | 添加 `dist_spec` 指针 |

**结果**：`mumuspec validate` 全通过（旧 prd.md/tech.md 被跳过）。

### 4.2 全面迁移（获得完整 guard 能力）

| 改动 | 文件 | 操作 |
|------|------|------|
| 根 `prd.md` | `.mumuspec/prd.md` | 添加 `doc_type: prd`，添加 `scope: "."`，将关键约束以 `## Requirement:` 块重写 |
| 根 `tech.md` | `.mumuspec/tech.md` | 添加 `doc_type: tech`，添加 `scope: "."`，同上 |
| 5 个 change `.mumuspec/prd.md` | 各 change `.mumuspec/prd.md` | 添加 `doc_type: prd`，添加 `## Requirement:` 块 |
| 5 个 change `.mumuspec/tech.md` | 各 change `.mumuspec/tech.md` | 添加 `doc_type: tech`，同上 |

### 4.3 推荐的迁移顺序

```
1. 根项目：补 goal.md + env-spec.md（必需，最低限度）
2. 根项目：运行 sync-specs --fix（补数字段缺失）
3. 活跃 change：选取 1-2 个最需要 guard 保护的作为试点
4. 试点 change：将关键 SHALL/SHALL NOT 写成 ## Requirement: 块
5. 试点 change：添加 doc_type: prd / doc_type: tech
6. 验证：mumuspec validate（试点 change 被严格校验，其他未变）
7. 推广：其余 change 跟随迁移
8. 根文件：最后迁移根 prd.md/tech.md（因影响范围最广）
```

---

## 5. 针对 mumuspec CLI 项目的具体应用方案

### 5.1 当前状态

- 根 prd.md/tech.md 已有丰富内容（介绍产品和技术架构）
- 根 spec.md 已有标准的 `## Requirement:` 块
- 根 goal.md、env-spec.md 已存在
- 活跃 change（dashboard-onboard-chat）已归档，无 `.mumuspec/` 文件
- archived changes 均无分布式 spec

### 5.2 推荐操作

```
1. 首次运行 sync-specs 检查根项目
2. 为每个 active change 运行 mumuspec new <name>，自动生成 V2 格式
3. 根 prd.md/tech.md：因内容主要为描述性"产品/技术文档"，
   不建议强制改写为 Requirement 块。保持旧格式作为 reference doc。
4. 如果某文件需要参与 guard/shall 检查，为其新建对应的 tech.md（V2）
   并添加 doc_type + Requirement 块作为补充
```

**原则**：mumuspec CLI 项目自身更多是"产品文档"而非"工程约束"。根 prd.md/tech.md 作为说明书完全可以保持旧格式，仅在新 change 创建时使用 V2 获得完整的 guard 能力。

---

## 6. 判断是否迁移的决策树

```
该文件是否需要参与 guard / drift 检测？
         ↓                    ↓
       是（工程约束）        否（纯文档）
         ↓                    ↓
  迁移为 V2 format       保持旧 format
  添加 doc_type           无需改动
  写 ## Requirement:     
  块并加 Enforcement     
         ↓
  运行 mumuspec validate
  严格要求通过
```

---

## 7. 正确性保证清单

| 检查点 | 保障手段 |
|--------|---------|
| 旧文件不被误报 | validator 的 `isV2Prd` / `isV2Tech` 判定 |
| layer=0 不为"invalid" | validator 改为 `prd.layer == null` 而非 `!prd.layer` |
| 旧 loader 调用链不中断 | try-catch 包裹，无效文件返回 undefined |
| 新 change 不污染旧项目 | 只在新建 change 的 `.mumuspec/` 下生成 V2 文件 |
| `mumuspec init` 不破坏老项目 | `--distributed` 为 opt-in 参数 |
| Goal/Env 文件可后补 | `goal.md` / `env-spec.md` 为独立文件，无交叉依赖 |

---

## 8. 总结

**正确应用的核心是"渐进式采用，以约束检查需求驱动格式升级"**：

- 旧项目无需任何强制改动，新代码自动与之共容
- 只有在需要 guard 自动检查 SHALL/SHALL NOT 时，才有必要迁移为 V2
- `mumuspec sync-specs` 提供格式健康检查
- `mumuspec new` 和 `mumuspec init --distributed` 确保新增内容自动使用 V2
