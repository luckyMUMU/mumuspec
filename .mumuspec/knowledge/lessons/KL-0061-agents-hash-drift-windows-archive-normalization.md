---
# === 标识 ===
id: "KL-0061"
title: "活跃变更期 agents-hash 漂移、Windows 归档 EPERM 与 spec 树规范化教训"
type: lesson
status: confirmed
scope: "global"
created_at: "2026-09-06T00:35:00+08:00"
updated_at: "2026-09-06T00:35:00+08:00"
verified_at: "2026-09-06T00:35:00+08:00"

# === 来源 ===
source_change: "structure-validator-workflow-yaml"
source_phase: "verify"
source_artifact: "spec 树规范化重构（2026-09-05）+ tweak 变更全流程"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["lessons", "agents-hash", "windows", "archive", "spec-normalization", "parallel-edit"]
related_pages:
  - "KP-0016"
  - "KP-0031"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q3"
  reasoning_chain: []
  confidence: high
---

## 背景

2026-09-05 根层 spec 树规范化重构与 structure-validator-workflow-yaml（E-SPEC-014 修复）变更中沉淀的操作教训，均为实际踩坑后验证的结论。

## 教训清单

### L1：同一文件的多个并行 Edit 会互相覆盖（且报成功）

- **现象**：对同一 spec.md/tech.md 的多个 Edit 放入同一并行批次，后完成写入的会以旧内容快照覆盖先完成的编辑，工具仍逐个报 "Successfully edited"。
- **后果**：部分编辑静默丢失，只能靠 grep 复查发现（如 `# Delta Spec:` H1 残留回归、D-006 决策块消失）。
- **对策**：**同一文件的编辑必须串行执行**；跨文件编辑才可并行。批量编辑后必须用关键标记 grep 验证落盘。

### L2：活跃变更期间的 E-AGENTS-001 是预期漂移，不是回归

- **现象**：`mumuspec new` / `finalize-archive` 会触碰被 agents-hash 覆盖的 4 个根级 spec 文件（`AGENTS_HASH_SPEC_FILES = spec.md/prd.md/tech.md/prohibitions.md`），导致 `mumuspec check` 报 E-AGENTS-001。
- **判定**：变更生命周期内属**环境性漂移**；全量测试中的 `cli-smoke > mumuspec check dogfooding` 用例同样受此影响（CI 无活跃变更所以恒绿）。
- **对策**：按 fixHint 刷新 rules + agents-hash（`generateRulesFiles` 受 MANAGED_MARKER 三态保护，仅接管 managed 文件）；归档完成后最终刷新一次即为稳定态。

### L3：Windows 归档 fs.rename 偶发 EPERM，且 E-CHANGE-011 可能误报

- **现象**：`mumuspec archive` 报 EPERM（目录 rename 失败）并先创建**空目标目录壳**；重试后报错依旧，但实际变更目录**已完整迁移**到 `changes/archive/`。
- **对策**：报 E-CHANGE-011 后先 `ls` 双向确认实际落位再处置，勿盲目按 fixHint 重复手动移动；残留的空目标壳可直接 `rmdir`。根因疑似外部进程（IDE 文件监视/AV）持有目录句柄。

### L4：空 `.mumuspec/temp/` 会触发 E-SPEC-013

- **现象**：temp/ 目录存在但为空时，structure-validator 的 `DEFINED_DIRECTORIES` 白名单不含 `temp` → E-SPEC-013 UNDEFINED_MUMUSPEC_DIRECTORY。
- **对策**：temp/ 是按需位置而非常驻目录——一次性脚本用完即删、目录即空即 `rmdir`；若未来 temp/ 需常驻，应作为独立变更将 `temp` 加入 DEFINED_DIRECTORIES（与 spec TEMP-1 对齐）。

### L5：spec 树规范化重构的可复用流程

1. `mumuspec validate` 取基线错误清单（E-SPEC-010/013/014 类均直接指向残留/漂移位置）。
2. 清理归档合并残留：空 `constraint-merged` 段、模板占位符 change-spec 段、失效 `parent_prd/parent_tech` frontmatter、悬空 `# Delta Spec:` H1。
3. 语义级规范化：一个 Requirement 一个关注点（如术语表 vs 能力分层拆分）；delta-merged 块统一为 `## Requirement:` 结构，来源信息折叠进 HTML 注释。
4. 事实核对后才同步 spec（读代码确认模块/命令/机制名，不凭记忆写入）。
5. 收尾：`validate` 0 error → `check` + drift → 刷新 AGENTS.md/agents-hash → 全量测试。

## 验证

- 全部教训在 2026-09-05 会话中实际踩坑并验证（全量 4826 测试绿 + validate 0 error + drift OK 收口）。
