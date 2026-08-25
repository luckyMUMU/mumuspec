# Design: onboard-cli

## Architecture Overview

本设计实现 R-0004（Onboarding CLI），新增两个命令并修改 README，旨在将新用户完成首个变更时间从 60-120 分钟降至 15 分钟内。

```
┌─────────────────────────────────────────────────────────┐
│  CLI Entry (src/cli/index.ts)                           │
├─────────────────────────────────────────────────────────┤
│  onboard quickstart  │  tutorial                        │
│  (新增子命令)         │  (新增顶层命令)                    │
├─────────────────────────────────────────────────────────┤
│  QuickStart Engine    │  Tutorial Engine                 │
│  - 5-question flow    │  - 6-stage walkthrough           │
│  - template selection │  - interactive prompts           │
│  - config generation  │  - progress tracking             │
├─────────────────────────────────────────────────────────┤
│  Templates (src/core/init-templates.ts)                  │
│  - frontend.yaml      │  - backend.yaml                  │
│  - fullstack.yaml                                       │
├─────────────────────────────────────────────────────────┤
│  Existing Systems (unchanged)                           │
│  - init command       │  - knowledge-onboard command     │
│  - config.yaml        │  - project-analyzer              │
└─────────────────────────────────────────────────────────┘
```

## API Contracts

### Command 1: `mumuspec onboard quickstart`

**Input**: 交互式问答（5 问）
1. 项目类型 → `[frontend | backend | fullstack]`
2. 团队规模 → `[solo | small (2-5) | medium (6-20) | large (20+)]`
3. 严格程度偏好 → `[strict | balanced | relaxed]`
4. 是否需要测试 → `[yes | no]`
5. 是否需要 hooks → `[yes | no]`

**Output**: 
- 在项目根目录生成/更新 `.mumuspec.yaml`（保留已有配置）
- 输出下一步建议：`mumuspec new <change-name>`

**副作用**:
- 写入 `.mumuspec.yaml` 配置文件
- 生成对应的 `prd.md` / `tech.md` 模板文件
- 不修改已有 spec/ 目录内容

### Command 2: `mumuspec tutorial`

**Input**: 无（交互式引导）

**Output**: 15 分钟内完成首个变更的完整 walkthrough
1. 展示欢迎信息 + 学习路径概览
2. Step 1: 运行 `onboard quickstart` 生成配置
3. Step 2: 运行 `mumuspec new tutorial-change` 创建变更
4. Step 3: 展示 design.md 模板结构
5. Step 4: 展示 guard check 输出示例
6. Step 5: 展示 verify 运行示例
7. Step 6: 展示 archive 命令
8. 完成提示 + 学习资源链接

**副作用**:
- 创建临时 `tutorial-change` 变更目录（完成后提示用户归档/丢弃）
- 不修改项目核心代码

### Template System

文件格式：`.mumuspec/templates/<type>.yaml`

```yaml
# frontend.yaml (示例)
type: frontend
guard_layer:
  shall:
    - "所有组件必须有类型定义的 Props"
    - "使用 Composition API / Hooks"
    - "Tailwind 优先于自定义 CSS"
  shall_not:
    - "禁止直接修改 DOM"
    - "禁止组件嵌套超过 3 层"
constraint_strength:
  default: medium
  overrides:
    - id: "FW-1"
      level: high
 ai:
  generate_rules: true
```

## Data Flow

### QuickStart 流程

```
用户输入 → 问答收集器 → 配置生成器 → config.yaml 写入
                              ↓
                         templates/<type>.yaml 加载
                              ↓
                         prd.md / tech.md 生成到 .mumuspec/
```

### Tutorial 流程

```
开始 → 欢迎信息 → 6 阶段引导 → 每个阶段后等待用户确认
                                      ↓
                              阶段完成后展示下一命令
                                      ↓
                              最终提示归档/丢弃 tutorial-change
```

## Error Specification

| 场景 | 处理方式 | 错误消息 |
|------|---------|---------|
| 项目目录下已有 config.yaml | 增量合并，保留已有覆盖 | Info: "检测到已有配置，仅更新指定字段" |
| 用户不在 MumuSpec 项目根目录 | 直接报错退出 | Error: "不在 MumuSpec 项目目录，请先运行 `mumuspec init`" |
| quickstart 中断（Ctrl+C） | 优雅退出，保存已答信息 | Info: "配置未完成，已保存进度" |
| tutorial-change 已存在 | 跳过创建，引导继续 | Info: "变更已存在，继续教程" |
| 模板文件缺失 | 回退到默认 minimal 配置 | Warn: "未找到 <type> 模板，使用默认配置" |

## Constraints Analysis

### SHALL (硬约束)
- SHALL: `onboard quickstart` 必须在 5 个问答内完成（不多不少）
- SHALL: 生成的 config.yaml 必须与现有格式兼容（不破坏已有字段）
- SHALL: 现有 `knowledge-onboard` 子命令功能完整保留
- SHALL: Tutorial 15 分钟内可完成（不包括用户阅读时间）
- SHALL: README quick start ≤ 20 行

### SHALL NOT (硬约束)
- SHALL NOT 修改 `init` 命令的实现逻辑
- SHALL NOT 修改 `knowledge-onboard` 知识层学习路径的功能
- SHALL NOT 删除已有用户的配置文件
- SHALL NOT 强制用户接受模板（允许跳过/自定义）

### Progressive Disclosure
- 默认只暴露 `onboard quickstart` 和 `tutorial`
- 高级功能（如 `onboard quickstart --advanced` 自定义问答）需 `advanced.enabled: true`
- 新用户不看到 `constraints`、`drift`、`contract` 等高级命令帮助

## Risk Mitigation

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 5 问题过多/过少 | 中 | 中 | 允许 `--preset <type>` 跳过问答 |
| 模板覆盖不全 | 低 | 低 | 提供 minimal fallback |
| README 行数超标 | 低 | 低 | CI 检查（≤ 20 行）|
| 与 knowledge-onboard 冲突 | 低 | 中 | 子命令命名空间隔离 |

## Test Strategy

### 单元测试 (tests/cli/onboard.test.ts)
- `onboard quickstart --preset frontend` → 验证 config.yaml 生成正确
- `onboard quickstart --preset backend` → 验证 guard_layer 差异
- 已存在 config.yaml 时增量合并逻辑
- 非项目目录时的退出码

### 单元测试 (tests/cli/tutorial.test.ts)
- `tutorial` 命令执行流程验证
- 每个阶段的输出文本检查
- 已有 `tutorial-change` 时的跳过逻辑

### 集成测试
- 全新项目端到端：`onboard quickstart` → `new` → 基础 guard
- README 行数验证（脚本化）

### 测试覆盖目标: ≥ 10 个测试用例

## Implementation Layers

| Layer | 模块 | 依赖 | 顺序 |
|-------|------|------|------|
| 1 (叶) | `src/core/templates/*.json` (模板文件) | 无 | 1 |
| 2 | `src/cli/commands/knowledge-onboard.ts` (扩展 quickstart 子命令) | Layer 1 | 2 |
| 3 | `src/cli/commands/tutorial.ts` (新 tutorial 命令) | 无 | 2 |
| 4 (根) | `src/cli/index.ts` (命令注册) | Layer 2 + 3 | 3 |
| 5 | `README.md` (Quick Start) | 无 | 3 |

自底向上实现：Layer 1 → Layer 2+3 (并行) → Layer 4+5

## 进度计划 (tasks.md)

T-001: 创建 onboard quickstart 命令骨架 + 问答框架
T-002: 实现 3 套模板文件（frontend/backend/fullstack）
T-003: 实现 config.yaml 增量合并生成器
T-004: 实现 tutorial 命令（6 阶段交互式引导）
T-005: 优化 README Quick Start（≤ 20 行）
T-006: 编写测试用例（≥ 10 个）
T-007: 运行 guard + 修复问题 + 归档

---

> 关联: supersedes R-0009 | capacity_cost: 3
> 变更边界: src/cli/commands/onboard.ts（扩展）, src/core/init-templates.ts（扩展）, README.md（修改）
