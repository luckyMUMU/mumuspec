# 分步教程：使用 MumuSpec + AI 完成第一个 hotfix

> 本教程基于 `demo/` 项目。你将：初始化项目 → 编写规范 → 让 AI 在五阶段工作流内自主完成一个 bug 修复 → 归档产出。

预计耗时：20 分钟。完成后你会获得一个完整的、可直接复用的个人工作流骨架。

你需要一台装有 Node.js >= 20、Git、任意 AI 编程工具（推荐 Claude Code）的机器。

---

## 第 1 步：克隆 Demo 项目

```bash
git clone https://github.com/mumuspec/mumuspec.git
cd mumuspec/demo
npm install
```

Demo 项目 `task-api` 是一个零依赖的 TypeScript REST API，用于管理任务。

---

## 第 2 步：启动 MumuSpec

```bash
# 初始化（使用 mumuspec CLI，可来自全局或 npx）
npx mumuspec init . --name task-api --language typescript

# 诊断环境
npx mumuspec doctor
```

`init` 会自动创建 `.mumuspec/` 骨架、写入初始的 `spec.md` / `design.md`、生成 `CLAUDE.md` / `AGENTS.md` / `.cursorrules`。

---

## 第 3 步：阅读示例规范

打开 `demo/.mumuspec/spec.md`。这个文件已包含项目根层规范：

- SHALL：统一 JSON 响应 `{ code, data, message }`；写操作必须参数验证；错误走 error handler
- SHALL NOT：业务错误禁止直接 throw Error；禁止在生产日志打印敏感信息；禁止绕过 storage 层直接访问数据库

打开 `demo/.mumuspec/prohibitions.md`，阅读全局反向约束。

再运行：

```bash
npx mumuspec validate
npx mumuspec check
```

看到"✓ 格式正确""✓ 规范合规"两条说明环境可工作。

---

## 第 4 步：让 AI 发现项目的规范

启动 AI 工具（以 Claude Code 为例），输入：

> "读一下项目的 SHALL 与 SHALL NOT 规范"

AI 通过读取 `CLAUDE.md` 或调用 `get_spec_context` 工具获取规范，把正向列与反向列回答出来。如果没有，请检查 Rules 文件是否存在且内容非空。

---

## 第 5 步：描述 Bug，触发 hotfix 工作流

AI 工具内输入：

> "有一个 bug：创建任务时 title 为空字符串也能成功。请用 MumuSpec 的 hotfix 流程处理这个问题。"

如果 MCP Server 已加载，AI 会自动：

1. 调用 `get_spec_context src/api` 查看 API 层规范
2. 解释涉及哪些 SHALL / SHALL NOT 变更
3. 创建变更：`mumuspec new add-title-validation --workflow hotfix`
4. 推进 Open → Design → Build → Verify → Archive
5. 在每一阶段都做漂移检测与合规校验

如果你用的是 Claude Code 已配置 Skill，AI 可以看到 `/mumuspec-hotfix` Skill 的完整指令；如果没用 Skill，AI 也可以直接推 CLI（CLAUDE.md 里列出了 hotfix 完整命令）。

---

## 第 6 步：观察 AI 的推进

在终端执行：

```bash
npx mumuspec status add-title-validation
```

典型五阶段推进：

- phase: design → AI 在写 design.md + test cases
- phase: build → AI 在 add-title-validation worktree 里改代码
- phase: verify → AI 在写 verify.md, 校验 test-cases hash
- phase: archive → AI 触发归档、合并提交、提取知识

每一步 AI 都能主动跑 `mumuspec check --shall-not` 检查是否触发反向禁止。如果触发了，它会停下询问你的确认（Blocking Point）。

---

## 第 7 步：归档与提取知识

归档成功后，检查产出：

```bash
# 查看归档目录结构
ls .mumuspec/changes/archive/2026-xx-xx-add-title-validation/

# 查看自动提取的知识
npx mumuspec knowledge list
```

归档过程会知识提取：把本次变更中"为什么 title 要验证""如何绕过"等写进 `.mumuspec/knowledge/` 的 `decision` 和 `rationale` 两类页面，供下次变更复用。

---

## 第 8 步：复用——下一个变更自动带出历史知识

再让 AI 做一件不同的事情：

> "给任务模型加上 priority 字段，high / medium / low 三档。"

AI 调用 `get_knowledge_context src/models` 时，MumuSpec 会加载最近一次 `knowledge/` 下关于模型层的决策。AI 因此知道"上一次如何避免过度抽象""如何保持零依赖原则"等历史推理，避免重复踩坑。

这就是知识层的价值：让 AI 不是每次都从零开始理解项目。

---

## 收获总结

完成本教程后，你将拥有：

- 一个跑通 hotfix 工作流的项目
- 一份已归档的"title 验证"变更，作为以后自己项目的模板
- 一份自动提取的决策知识，供下次变更发热
- 一套可复制命令序列，迁移到你自己的项目

---

## 下一步

- 查看 CLI 命令速查 → [reference/cli-commands.md](reference/cli-commands.md)
- 调整约束强度 → [design/constraint-strength.md](design/constraint-strength.md)
- CLI 安装与打包反馈 → [reference/packaging-deployment.md](reference/packaging-deployment.md)

> **导航**: [← Agent QuickStart](getting-started-agent.md) | [变更层设计 →](design/change-layer.md)
