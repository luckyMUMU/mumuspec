# Layer 1 — CLI 命令测试用例

> 类型: TDD 测试用例 | 层级: Level 1 (CLI 接口)

---

## TC-1-01: mumuspec impact 基础输出

**Given**: 有未提交变更
**When**: 运行 `mumuspec impact`
**Then**:
- 输出包含 Changed Files 面板
- 输出包含 Direct Impact 面板
- 输出包含 Recommendations 面板

---

## TC-1-02: mumuspec impact --json

**Given**: 有未提交变更
**When**: 运行 `mumuspec impact --json`
**Then**:
- 输出合法 JSON
- JSON 符合 ImpactAnalysis schema

---

## TC-1-03: mumuspec impact --with-knowledge

**Given**: 变更关联到已有 Knowledge Page
**When**: 运行 `mumuspec impact --with-knowledge`
**Then**:
- 输出包含 Knowledge Warnings 面板
- 预警信息包含 knowledge_id 和 suggestion

---

## TC-1-04: mumuspec impact --diff

**Given**: 指定 git diff 范围
**When**: 运行 `mumuspec impact --diff HEAD~3..HEAD`
**Then**:
- 分析最近 3 个 commit 的影响
- 不分析 working tree 未提交变更

---

## TC-1-05: mumuspec onboard init

**Given**: 项目开发者在 src/payment 目录
**When**: 运行 `mumuspec onboard init --scope src/payment --role junior`
**Then**:
- 生成学习路径 YAML 文件
- 文件存储在 `.mumuspec/onboarding/`

---

## TC-1-06: mumuspec onboard start 交互

**Given**: 学习路径已存在
**When**: 运行 `mumuspec onboard start --scope src/payment`
**Then**:
- 显示 Step 1/N 面板
- 显示代码节点、reason、knowledge pages
- 等待用户键盘输入（n/p/q）

---

## TC-1-07: mumuspec onboard complete-step

**Given**: 当前在 Step 2
**When**: 运行 `mumuspec onboard complete-step 2 --scope src/payment`
**Then**:
- Step 2 状态更新为 done
- 持久化到 progress 文件

---

## TC-1-08: mumuspec knowledge coverage

**Given**: 项目有 Knowledge Page 和 Code Graph
**When**: 运行 `mumuspec knowledge coverage`
**Then**:
- 输出 Overall 覆盖率面板
- 输出 By Type 覆盖率面板
- 输出建议审查的 gaps 数量

---

## TC-1-09: mumuspec knowledge gaps

**Given**: 项目有未覆盖代码
**When**: 运行 `mumuspec knowledge gaps --scope src/payment --min-importance 5`
**Then**:
- 输出 Top N gaps，按 importance 降序
- 仅显示 importance >= 5 的 gaps

---

## TC-1-10: mumuspec knowledge graph-export

**Given**: 存在 Knowledge Pages
**When**: 运行 `mumuspec knowledge graph-export`
**Then**:
- 生成 `knowledge-graph.json` 文件
- JSON 格式符合 UA 风格

---

## TC-1-11: hook 安装后自动启用知识更新

**Given**: 项目开发者在项目中运行 `mumuspec hooks install`
**When**: 安装完成
**Then**:
- post-commit hook 已安装
- 配置中 `commit_update.enabled` 默认为 true

---

## TC-1-12: Knowledge-Impact 偏离检测触发

**Given**: 提交消息 SUPERSEDES 块
**When**: commit-msg hook 解析
**Then**:
- hook block 提交（exit code 1）
- 提示用户创建正式变更来替代知识
