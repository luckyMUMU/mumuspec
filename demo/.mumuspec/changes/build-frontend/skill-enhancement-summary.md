# MumuSpec Skill 增强总结

> 基于 `build-frontend` 变更调研实践的系统性改进

## 增强概览

| # | 增强项 | 文件 | 解决的问题 |
|---|--------|------|-----------|
| 1 | 创建 cognitive-map.yaml 模板 | `.mumuspec/templates/cognitive-map-template.yaml` | guard 格式错配导致反复失败 |
| 2 | 创建 cognitive-map.yaml 格式规范 | `.mumuspec/templates/cognitive-map-schema.md` | 文档格式与实际格式脱节 |
| 3 | phase-open 添加 inline fallback | `skills/phase-open.md` | 4 个 required skill 全部缺失 |
| 4 | phase-design 添加 inline fallback | `skills/phase-design.md` | 6 个 required skill 缺失 + 认知地图格式错配 |
| 5 | phase-build 添加 inline fallback | `skills/phase-build.md` | writing-plans skill 缺失 |
| 6 | 编排器统一 guard/state 文档 | `skills/mumuspec.md` | guard 与 state 双重标准导致困惑 |
| 7 | 添加 Required Skill 注册表 | `skills/mumuspec.md` | Agent 无法系统判断哪些 skill 可用 |

## 各增强项详情

### 1. cognitive-map.yaml 模板

**问题**：phase-design skill 文档描述的格式（`q1_anchors`/`q2_questions`）与实际 guard 接受的格式（`entries` + `quadrant`）不一致。

**方案**：在 `.mumuspec/templates/` 目录下创建格式正确的模板文件，包含完整的注释说明每个字段用途和可选值。

**效果**：Agent 在编写 cognitive-map.yaml 时可以直接参考模板，避免格式错误。

### 2. cognitive-map.yaml 格式规范

**问题**：无集中文档说明 cognitive-map.yaml 的 schema。

**方案**：编写独立的 schema 文档，包含：
- 完整的字段规范表（必需 vs 可选）
- 各 quadrant 的额外字段对照表
- Guard 校验逻辑说明（实际校验的是 `.mumuspec.yaml` 的 `cognitive_framework` 字段）
- 常见错误与修复对照表

**效果**：当 guard 报错时，Agent 可以快速定位到真正原因。

### 3. phase-open inline fallback（4 项）

| Required Skill | Fallback 方案 |
|---------------|--------------|
| `brainstorming` | AskQuestion 多轮 Q&A（Round 1-3 结构） |
| `gitnexus-impact-analysis` | 手动 grep + 代码阅读 + base-ref.txt |
| `using-git-worktrees` | 自动降级为当前工作区 |
| `spec-driven-development` | delta-specs/ 标准 markdown 模板 |

每个 fallback 位置都有明确的 **降级说明** 注释，且要求记录到 decisions.md。

### 4. phase-design inline fallback（8 项）

最关键的增强。除了为每个 required skill 提供 fallback 外，还：

- **修正了 cognitive-map.yaml schema 示例**：将 `grill_me:` 独立键改为追加到 `entries` 的 Q3 条目，与 guard 实际接受的格式一致
- **添加了 guard 错误速查表**：每个错误码对应根因和修复命令
- **Fallback E（grill-me）**：单问题追问协议，附带上限保护
- **Fallback F（hyperplan）**：5 角度自审协议替代对抗团队

### 5. phase-build inline fallback

- writing-plans skill 缺失时，提供手动 tasks.md 模板
- 包含 Red-Green TDD 操作步骤要求

### 6. 编排器 Guard/State 统一文档

- 明示 `guard --apply` 和 `state transition --confirm` 使用不同标准
- 提供推荐工作流（先 guard，失败时用 state transition）
- 包含常见 guard 错误速查表 + 快速修复命令模板

### 7. Required Skill 注册表

在编排器中集中列出所有阶段声明的 required skill，标注每个 skill 是否有可用 fallback。三类信息：
- phase-open: 4 skills → 全部有 fallback
- phase-design: 6 skills → 全部有 fallback
- phase-build: 1 skill → 有 fallback

## 使用路径

```
# Agent 执行 mumuspec workflow 时的决策树：

1. 进入某阶段（如 phase-open）
   ↓
2. Available skills 列表检查 → required skill 是否在列表中？
   ↓
3a. 在列表中 → 正常加载 skill
3b. 不在列表中 → 执行 inline fallback（对应段落）
   ↓
4. 记录降级到 decisions.md（如适用）
   ↓
5. 继续执行阶段的后续步骤
```

## 遗留问题（未在本次增强中解决）

| 问题 | 优先级 | 说明 |
|------|-------|------|
| guard 与 state 校验逻辑不统一 | P1 | 需要 mumuspec CLI 层面的修复 |
| worktree 在 Windows 上的稳定性 | P2 | git worktree 相关命令可能需要额外适配 |
| Template 自动生成 | P2 | `mumuspec new` 时可自动生成 cognitive-map-template.yaml 的副本 |
| Skill 健康检查脚本 | P3 | `mumuspec doctor --skills` 可检查所有 required skill 是否可用 |

## 验证方法

```bash
# 1. 验证 cognitive-map.yaml 模板格式正确性
cp .mumuspec/templates/cognitive-map-template.yaml .mumuspec/changes/<name>/cognitive-map.yaml
# 编辑填入实际内容，然后运行 guard 验证

# 2. 验证 phase-open fallback 可用性
# brainstorming 不可用时，Agent 应自动使用 AskQuestion

# 3. 验证 phase-design fallback 可用性
# grill-me 不可用时，Agent 应自动进入手动追问流程

# 4. 验证 guard 错误速查表
# 故意设置 cognitive_framework.q1_count=0 → 应报 E-DESIGN-002
# 查表修复后重新运行 guard → 应通过
```
