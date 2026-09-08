# Release 0.19.2-alpha.10 — 流程摘要（2026-09-07）

## ① p0-calibration-hardening：实现 → verify → 归档 ✅

| P0 | 实现 | 证据 |
|---|---|---|
| P0-B loader 层数 | `selectLayersToLoad` 改用 `config.specs.max_layer_depth`（默认 5），root+target 恒保 | `src/spec/loader.ts`；loader-layers 6 用例 |
| P0-C 32KiB 断言 | `MAX_RULES_BYTES=32768` + `assertRulesWithinBudget`，写盘前 fail-closed；新错误码 E-RULES-001 | `src/install/rules-generator.ts`；rules-budget 5 用例 |
| P0-A（最小版） | `CommandMetadata` 注册表 + `mumuspec capability [command] [--json]` | `src/cli/capability.ts`；capability 13 用例（含 BOUNDARY 门禁 34 命令） |
| P0-D finalize-archive | code-graph snapshot 真实落盘、陈旧缓存实删（30 天）、`.finalized` 幂等标记（--force 覆盖） | finalize-idempotency 5 用例；**真实环境二次运行被拦截** |

- 全量回归 **244 文件 / ~4900 用例绿**（env-cli 曾现并行抖动，单独复跑绿，与改动无关）
- verify 证据 verify.md + assumptions.yaml；归档至 `archive/2026-09-07-p0-calibration-hardening/`（phase: archive-completed）

## ② 打包 ✅

- 版本 **0.19.2-alpha.10**（bump 脚本误跳 0.21.0，已手工校正）
- CHANGELOG 补录发布段；`npm pack` → `mumuspec-0.19.2-alpha.10.tgz`（805 KB，773 files）
- ci-check 0 error；`mumuspec check` / `drift` 全过

## ③ workbuddy 安装环境更新 ✅

- 全局 CLI（managed node prefix，npm link → 本仓库 dist）：`mumuspec --version` = 0.19.2-alpha.10 ✅
- 用户级技能 7 包全部 `--force` 更新（~/.workbuddy/skills/）
- **附带修复**：SKILL.md 内嵌旧版本 0.19.2-alpha.0 → installer 新增 `stampSkillVersion()` 写入时注入运行时包版本（版本单一源），重装后全部技能 version = 0.19.2-alpha.10 ✅

## ④ 文档树对齐（docs-tree-alignment，open）✅ 12 处修订

- **cli-commands.md**：删除 9 个幻影命令章节（config/wizard/rollback/snapshot/worktree/layer/design/doc/cognitive-map/index）；补 capability、finalize-archive、state 子命令、test-cases hash/lock-suite；install claude/cursor "coming soon" 更正为已支持；标注基准版本
- **README**：命令速查补 capability / finalize-archive 幂等说明
- **mcp-tools.md**：工具数 20 → 35
- **CONTRIBUTING**：测试规模 13 文件/204 用例 → 244+ 文件/~4900 用例
- **.cursorrules 遗留口径** ×2（directory-structure / skill-ecosystem）：对齐 C3 红线（AGENTS.md canonical）
- **附录报告** ×2：0.17.0 基准标注"撰写时快照"；**getting-started-agent**：版本期望 0.19.2-alpha.10

P2 遗留（未处理）：README 文档导航补全、feedback-process/packaging-deployment 旧版本示例、孤儿文档 mcp-guard-drift-proposal 链接。

## 提交

- `6b8a1dd` feat(p0): 4 项 P0 + 归档 + 发布
- `418a773` docs: 文档树对齐 0.19.2-alpha.10

## 本轮 dogfooding 新暴露缺陷（待立项）

1. **E-AGENTS-001 无自愈路径**：`install --force` 重生成 AGENTS.md 不刷新 agents-hash.json；init 拒绝重复执行、drift --fix 不含 agents_drift、doctor 仅报告（本次以官方 computeSpecHash 手工解除）
2. **`mumuspec new` 切孤儿分支**：本环境再次把 HEAD 切到无提交分支 `mumuspec/docs-tree-alignment`（以 symbolic-ref + mixed reset 零工作树变动恢复）
3. **归档 renameSync EPERM（Windows）**：复现，需 shell mv + 手工展平 + 三步状态迁移绕过
