# Agent QuickStart — 让 AI 跑通你的第一个 MumuSpec 变更

> 本文面向使用 AI 编程工具（Claude Code / Cursor / Codex / OpenCode 等）的开发者。目标：从安装 CLI 到完成第一个真实 hotfix，全程可复制。

预计耗时：**15–30 分钟**。完成后，你的 AI 将自动按规范树加载约束、在五阶段工作流内推进变更、并实时校验代码是否符合 SHALL / SHALL NOT。

---

## 你想要达成什么

1. 在项目中启用 MumuSpec
2. 让 AI 工具感知项目规范（SHALL / SHALL NOT / Ponytail）
3. 让 AI 在五阶段工作流内自主完成一次 hotfix
4. 实时校验 AI 产出的代码没有违反约束

本教程采用 **hotfix 预设路径**（最短路径），适合第一次跑通完整旅程。

---

## 前提条件

- Node.js >= 20
- Git 仓库（MumuSpec 强制依赖 Git）
- 任意 AI 编程工具（本教程以 Claude Code 为主，Cursor / OpenCode 的差异在对应小节给出）

---

## 安装 MumuSpec CLI

```bash
# 全局安装
npm install -g mumuspec

# 验证安装（应输出 0.19.2-alpha.10 或更新）
mumuspec --version
```

> 只想在单个项目中用？去掉 `-g` 改用 `npm install --save-dev mumuspec`，后续命令改用 `npx mumuspec`。

---

## 在你的项目中启用 MumuSpec

```bash
cd /path/to/your-project

# 初始化（自动创建 .mumuspec/ 规范树 + 根层 spec/prd/tech 等文件）
mumuspec init . --name my-app --language typescript

# 验证环境依赖
mumuspec doctor
```

---

## 写第一条规范

在 `.mumuspec/spec.md` 写入 SHALL / SHALL NOT 约束，并声明验证方式：

```markdown
## Requirement: API 约定

### SHALL
- API 端点返回统一 JSON 格式 `{ code, data, message }`
- 写入操作必须做参数验证

### SHALL NOT
- 禁止在处理函数内部直接访问数据库（必须走 storage 层）

### Enforcement
- ENF-1: manual(code review 核对返回格式与分层)
```

保存后校验：

```bash
mumuspec validate    # 校验规范格式 + 可验证性覆盖率
```

> Spec 由大模型起草、人做设计决策与审批签收（人机合著）；也可以由你直接书写。设计决策权始终在人。

---

## 把规范暴露给 AI 工具（二选一）

### 方式 A：MCP Server（推荐，渐进式披露 + 实时校验）

在项目根 `.mcp.json`（项目级）或 `~/.claude/settings.json`（用户级）添加：

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["-y", "mumuspec"],
      "env": { "MUMUSPEC_ROOT": "${workspaceRoot}" }
    }
  }
}
```

重新加载 AI 工具后，AI 即可调用 `get_spec_context`、`check_compliance`、`detect_drift` 等工具，实时感知规范树。

> Cursor：在项目根 `.cursor/mcp.json` 添加；OpenCode / Codex / Gemini：直接读取 AGENTS.md。

### 方式 B：Rules 文件（无 MCP 的兼容方案）

```bash
mumuspec install claude    # 或 cursor / opencode / codex / gemini 等 10 个 agent
```

生成结果：**AGENTS.md 是唯一 canonical 规则文件**（规范链摘要 + Ponytail + CLI 速查 + MCP 入口），`CLAUDE.md` / `GEMINI.md` 为首行 `@AGENTS.md` 的薄壳桥接。`.cursorrules` 等遗留格式已停止生成（C3 禁令），Cursor 通过 AGENTS.md 或 MCP 加载规则。

---

## 让 AI 完成第一个 hotfix

打开 AI 工具，发送：

> "用 MumuSpec 帮我处理一个 bug：创建任务接口没有验证 title 为空的情况，按 /mumuspec workflow 的 hotfix 路径处理。"

AI 会自动感知当前阶段并推进：需求澄清（Open）→ 影响分析 → 代码修复（Build，红绿 TDD）→ 验证（Verify）→ 归档（Archive）。

期间可用以下命令观察进度：

```bash
mumuspec status                     # 查看当前变更状态
mumuspec context src/api            # 查看 AI 当前路径加载的规范链
mumuspec check                      # 全量合规校验（SHALL / SHALL NOT / Ponytail）
```

AI 完成热修复后归档：

```bash
mumuspec archive add-title-validation --confirm
```

归档触发最终校验、规范增量合并、知识提取到 `knowledge/`、释放变更槽。第一个完整 hotfix 结束。

---

## 关键命令速查

| 场景 | 命令 |
|------|------|
| 初始化 | `mumuspec init .` |
| 诊断环境 | `mumuspec doctor` |
| 新建变更 | `mumuspec new <name> --workflow hotfix` |
| 查看状态 | `mumuspec status` |
| 校验规范 | `mumuspec validate` |
| 合规检查 | `mumuspec check` |
| 漂移检测 | `mumuspec drift` |
| 阶段守卫 | `mumuspec guard <change> <phase>` |
| 归档变更 | `mumuspec archive <name> --confirm` |
| 废弃变更 | `mumuspec discard <name>` |
| 渐进式披露查看 | `mumuspec context <path>` |

完整命令文档：[reference/cli-commands.md](reference/cli-commands.md)

---

## 让 AI 遵守 Ponytail 编码规范

MumuSpec 默认把 Ponytail 7 级阶梯写入规范，AI 编码时按优先级判断：

1. 这段代码需要存在吗？——不需要则不写（YAGNI）
2. 代码库已有可复用实现吗？——有则复用
3. 标准库已经提供吗？——有则用标准库
4. 平台原生特性支持吗？——有则用平台特性
5. 已安装的依赖能完成吗？——有则用已有依赖
6. 能一行写完吗？——有则不过度抽象
7. 以上都不满足？——写最小可工作代码

AI 代码完成后的 `ponytail:` 注释是它"有意简化"的标记，便于人工复核。

---

## 进阶配置（可选）

### 调整约束强度

```yaml
# .mumuspec/config.yaml
constraint_strength:
  technical_design: medium
  requirement_goals: low
```

三档含义：`high` = 强制执行（block），`medium` = 推荐遵循（warn，可降级），`low` = 关闭（info）。
详见 [design/constraint-strength.md](design/constraint-strength.md)。

### 项目级工作流 override

在 `.mumuspec/workflow.yaml` 对内置工作流做项目级覆盖（约束强度、工作流规则、TDD 模式），未声明字段回落内置默认（CHG-7）。

### 分层规范

对于大型项目，按目录拆解规范，子目录自动继承父层、可收紧不可放宽：

```bash
mumuspec add-spec src/api --type shall     # 或 --type shall-not
```

MumuSpec 按"渐进式披露"原则，只在 AI 处理 `src/api/` 路径时加载对应规范链，减少 token 消耗。

---

## 常见问题

### AI 没有按 Skill 流程工作？

- 检查 MCP Server 是否已重新加载（JSON 配置变更后需重启 IDE）
- 运行 `mumuspec doctor` 验证 Node 与 Git 环境
- 确认 `AGENTS.md`（或 `CLAUDE.md` 薄壳）在项目根目录且内容非空
- 直接告诉 AI "按 /mumuspec 工作流执行"

### 校验报错后如何处理？

- `mumuspec check` 列出 SHALL / SHALL NOT 违规项，AI 会自动修复 SHALL 类违规
- SHALL NOT 红线违规会阻断流程，必须人工确认
- 报错信息含具体错误码（`E-*`），按错误码定位；总表见 [reference/error-codes.md](reference/error-codes.md)

---

## 下一步

- 完整 CLI 命令：[reference/cli-commands.md](reference/cli-commands.md)
- MCP 工具参考：[reference/mcp-tools.md](reference/mcp-tools.md)
- 配置 schema：[reference/configuration.md](reference/configuration.md)
- 约束强度设计：[design/constraint-strength.md](design/constraint-strength.md)
- 项目总览：[overview.md](overview.md)

> **导航**: [← 概览](overview.md) | [CLI 命令参考 →](reference/cli-commands.md)
