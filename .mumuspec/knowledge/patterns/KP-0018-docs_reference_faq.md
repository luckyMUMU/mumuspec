---
id: "KP-0042"
title: "FAQ — 常见问题与故障排查"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - reference
  - pattern
source: "docs/reference/faq.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# FAQ — 常见问题与故障排查

> **Source**: `docs/reference/faq.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

> 本页面汇总用户上手 MumuSpec 时最常遇到的问题。按"症状 → 原因 → 修复"三段式组织。

## Original Content

# FAQ — 常见问题与故障排查

> 本页面汇总用户上手 MumuSpec 时最常遇到的问题。按"症状 → 原因 → 修复"三段式组织。

---

## 安装与启动

### Q: 安装后执行 `mumuspec --version` 报 `command not found`

**原因**：npm 全局 bin 目录不在 `PATH` 中，或安装未完成。

**修复**：

```bash
# 检查全局 bin 目录
npm bin -g

# 确认其在 PATH 中（Windows PowerShell）
$env:Path -split ';' | Select-String 'npm'

# 不在则临时加入
$env:Path += ";$(npm bin -g)"

# 永久加入 → 用户环境变量 Path 添加该目录
```

Windows PowerShell 永久配置：

```powershell
# 查看 npm 全局 prefix
npm prefix -g

# 在 $PROFILE 里加一句：
$env:Path += ";$(npm prefix -g)"
```

---

### Q: npm install 报 `EACCES` 或 `EPERM`

**原因**：npm 全局目录需要管理员权限。

**修复**（无需管理员）：

```bash
# 把 npm 全局目录移到用户目录
npm config set prefix "$env:APPDATA\npm"

# 把新目录加入 PATH
$env:Path += ";$env:APPDATA\npm"
```

---

### Q: 如何从预发布通道切回稳定版

```bash
npm install -g mumuspec@latest
```

`next` 与 `latest` 是两个 dist-tag，安装时可以显式指定。

---

## 规范与配置

### Q: `mumuspec validate` 报 "unknown field in SHALL NOT block"

**原因**：`spec.md` 中 SHALL NOT 条目未按 YAML block 格式书写。

**修复**：确保每个 SHALL NOT 条目带了 `-` 前缀：

```markdown
## SHALL NOT

- 禁止访问其他模块的内部实现                # ✓ 正确
- 禁止在生产代码中保留 console.log          # ✓ 正确

禁止访问其他模块的内部实现                  # ✗ 错误：缺 - 前缀
```

---

### Q: `mumuspec check --shall-not` 报违规，但我认为是误报

**原因**：规范条目与 Enforcement 规则未对齐（条目写了但未定义如何校验）。

**修复**：

- 确认每个 SHALL / SHALL NOT 都有明确的 Enforcement
- Enforcement 缺失时 `mumuspec validate` 会报 `[E-SPEC-004] ... has constraints but no Enforcement`
- 如果是设计阶段的先临时忽略，加 `severity: info` 或 `enforcement: ~`

---

### Q: 如何在子目录拆出新的规范层级

```bash
# 在子目录创建 .mumuspec/ 目录与 spec.md
mumuspec add-spec src/models --type shall
# 编辑 src/models/.mumuspec/spec.md
```

MumuSpec 自动识别树状结构：目录里的 `.mumuspec/` 对应一个规范节点，自动参与渐进式披露加载。

---

### Q: 约束强度三档（high / medium / low）到底影响什么

| 档位 | 工作流规则 | 漂移检测 | Phase Guard |
|------|-----------|---------|------------|
| `high` | BLOCK（违规阻断下一步） | ERROR 阻断 | 100 % 强制执行 |
| `medium` | WARN（提示但可跳过） | WARN 不阻断 | 强制执行但可降级 |
| `low` | INFO（仅记录） | INFO 不阻断 | 关闭 |

一般初期用 `high`；团队磨合后降到 `medium`；清理期或原型阶段用 `low`。

---

## 变更与状态机

### Q: 同一时间能创建多少个变更

默认**1 个活跃变更**（Single Active Change）。`mumuspec new` 在存在活跃变更时会拒绝。

放松限制：

```yaml
# .mumuspec.yaml
workflow:
  single_active_change: false
  max_active_changes: 3       # 最多 3 个并行
```

---

### Q: 误操作了 `mumuspec discard`，还能恢复吗

`discard` 会把 worktree、变更目录、`.mumuspec.yaml` 一律清理。未提交改动会被删除。

- 已进入 Git 的内容可以用 `git reflog` 救回
- 建议在 `archive` 前跑一次 `mumuspec snapshot list <name>` 确认快照可用

---

### Q: 如何把回退限制从 3 次调整为更大值

```yaml
# .mumuspec.yaml
changes:
  default_rollback_limit: 5     # 默认 3
```

或在单个变更的 `.mumuspec.yaml` 中单独设置：

```yaml
# .mumuspec/changes/<name>/.mumuspec.yaml
rollback_limit: 5
```

---

## MCP 集成

### Q: Claude Code 不调用 MCP 工具

排查顺序：

1. 确认 `.mcp.json` 放在项目根目录（或 `~/.claude/settings.json`）
2. 重启 Claude Code（配置变更需要重启）
3. `/mcp` 命令检查 Server 状态：`mumuspec` 应在运行中
4. 确认 `MUMUSPEC_ROOT` 指向项目根目录
5. 用 `npx mumuspec-mcp --help` 测试命令本身可用

---

### Q: Cursor 不加载 `.cursorrules`

原因通常是 `.cursorrules` 不在项目根目录，或 Cursor 路径包含符号链接。

修复：

- 确认文件位置：`<project-root>/.cursorrules`
- 如果在子目录，Cursor 只会读根目录或本目录的 `.cursorrules`
- Cursor Settings → Rules 也可以配置全局规则

---

### Q: OpenCode / Windsurf 加载 `AGENTS.md` 后 AI 不遵守

不是所有工具都强制加载同名文件。检查：

- OpenCode 工程设置中，「Auto-loaded system files」是否包含 `AGENTS.md`
- Windsurf 中，`AGENTS.md` 默认读取，可以在设置里关闭
- 关闭时，把内容手动粘贴到对话开头作为 system prompt

---

## 打包与发布

### Q: `npm run release:dry` 报"You must specify a tag"

**原因**：当前版本号为 prerelease（如 `0.12.1-alpha.0`），npm 强制要求显式 `--tag`。

修复：

```bash
# 直接使用 --tag next
npm publish --dry-run --tag next

# 或修改 package.json scripts，把 release:dry 改为：
# "release:dry": "npm publish --dry-run --tag next"
```

---

### Q: `npm link` 导致依赖重复（`commander` 等库 instance 失败）

原因：link 绕过 node_modules 隔离，使同一依赖出现两份实例。

修复：

```bash
# 方案 1：源项目也 link 依赖
cd /path/to/mumuspec
npm link commander yaml
cd /path/to/consumer
npm link commander yaml

# 方案 2：改用 tarball 安装
cd /path/to/mumuspec
npm pack
cd /path/to/consumer
npm install /path/to/mumuspec/mumuspec-x.y.z.tgz
```

---

## 性能

### Q: 全量 `mumuspec check` 耗时过长

- 首次运行会构建索引，后续使用缓存（`.mumuspec/index.yaml`）
- 大型代码库（1 万文件）建议开启内置图谱后端替代全量扫描
- 日常开发建议只跑 `mumuspec drift` 而非全量 check

---

### Q: 知识层 `knowledge list` 加载慢

```bash
# 重建知识索引
mumuspec knowledge index rebuild
```

索引位于 `.mumuspec/knowledge/_pageindex.yaml`，可定期清理旧页面：

```bash
mumuspec knowledge stale              # 列出过期知识
mumuspec knowledge supersede KP-002 --by KP-010   # 用新知识淘汰旧知识
```

---

## 获取进一步帮助

- CLI 完整文档：[cli-commands.md](cli-commands.md)
- MCP 工具参考：[mcp-tools.md](mcp-tools.md)
- 详细配置参考：[configuration.md](configuration.md)
- 故障排除（打包与部署）：[packaging-deployment.md](packaging-deployment.md) §9
- 提交反馈：见根 README 的"参与贡献"章节

> **导航**: [← 错误码](error-codes.md) | [术语表 →](glossary.md)

