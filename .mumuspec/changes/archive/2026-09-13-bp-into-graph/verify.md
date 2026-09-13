# Verify Report: bp-into-graph

## 验证结果：pass（全量验证）

| 检查 | 结果 |
|---|---|
| check（合规+漂移+术语，exit code） | 0 error（spec_drift 警告均来自 temp/probe 测试夹具，非本变更） |
| validate（格式+Enforcement 覆盖） | 通过；unverifiable=20 全部来自 temp/probe 夹具文件，本变更产物 0 |
| test-cases verify（hash + 套件） | 通过（design_content_hash 一致，suites_locked=true） |
| drift --change bp-into-graph | 无漂移；delta 预览 10 条与 delta-specs 一致 |
| graph verify | 全绿；BP 清单（full 17 个）+ BP 声明与 skill 侧一致 |
| 新增测试 | tests/change/phase-graph-loader-bps.test.ts（6）+ tests/change/phase-bps.test.ts（6）+ graph-handler 回归修复后 9/9 |
| 全量回归 | 277 files / 5168 tests：修 W-GRAPH 防御后 6 失败清零（graph-handler mock 场景）；其余通过 |

## Enforcement 覆盖（manual 通道验证记录）

- PHASE_BPS_LOADER：TC-L0-01..06 全部通过（tests/change/phase-graph-loader-bps.test.ts）
- PHASE_BPS_VERIFY：TC-L1-01..06 全部通过（tests/change/phase-bps.test.ts）

## 过程裁决记录

- loader 首版将 BP 唯一性设为全配置作用域，被 fail-safe 拦截（重复 id 大量误报）→ 收窄为 workflow 内唯一，TC-L0-05 语义随之修正。
- skill workflow.yaml design 段预存缩进损坏（4 空格）导致解析失败，fail-open 跳过检查暴露问题 → 已修复；collectSkillBps 兼容其 workflow 嵌套形态。
- graph verify 新增段对 mock 环境（activateProjectWorkflow 返回 undefined）做可选链防御。

## 分支处理

- 就地开发（master）：平台嵌套 ref 限制下 branch/worktree 隔离声明不可落地（既有裁决），isolation 视为 branch=master，branch_status=handled。
