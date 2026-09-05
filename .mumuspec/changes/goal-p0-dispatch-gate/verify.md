# Verify Report: goal-p0-dispatch-gate

**Phase**: build（4 层实现完成，等待 guard verify）
**Date**: 2026-09-01
**Branch**: mumuspec/goal-p0-dispatch-gate
**裁决基线**: D1/C2（标记分路三态）、D2/C3（停止生成 legacy）、D5（渲染单一权威）

---

## 1. 实现分层（自底向上）

| Layer | Scope | 核心产物 | 状态 |
|-------|-------|----------|------|
| 0 | artifact-validator | `src/change/artifact-validator.ts`（纯核心 + IO 壳双层）、E-CHANGE-020/021 | done |
| 1 | guard-completeness-gate | `src/guard/phase-guard.ts` 挂钩 `checkCompletenessGate`、E-GUARD-008、`always_enforce` 三条注册 | done |
| 2 | rules-render-dispatch | `src/install/rules-generator.ts`（渲染 + 三态唯一权威）、`AGENT_RULE_TARGETS` 声明表、`rules/generator.ts` 降为胶水层 | done |
| 3 | installer-e2e | `installRuleFiles` / `installRuleFilesAsResult`、10 agent 支持、CLI 子命令注册、doctor legacy 检测 | done |

### Layer 0 — 工件校验器（校验归代码：KP-0060 第三公理）

- `validateArtifactSchema` 全部产出 **E-CHANGE-020**（结构层：version/items 类型/status 枚举/resolution 形状）
- `validateArtifactSemantics` 全部产出 **E-CHANGE-021**（语义层：decision_ref 未命中、deferred 缺 note）
- YAML 语法错误 → 020 **fail-closed**（非法工件不降级、不猜）
- 校验器只判结构/链完整性；**全 open 是合法工件**，block 由 Layer 1 门禁依据 `openItemIds` 决定
- LLM advisory 未知字段被忽略，不进判定路径

### Layer 1 — 完备性门禁

- `checkDesignToBuild` 挂钩 open-questions（硬 error）；`checkBuildToVerify` 挂钩 assumptions（**仅 `workflow === 'full'`**，hotfix/tweak 豁免，守住"只增不改"）
- 缺失工件 → 声明逃生门 `<!-- no-open-questions -->` / `<!-- no-assumptions -->` 且 decisions.md 签收条目 > 0 才放行；**逃生门仍需人签收**
- 空 items 工件 → block（空工件不等于完备）
- 红线 **ENF-3/4 载体**：`E-CHANGE-020/021`、`E-GUARD-008` 在 `GUARD_CHECK_METADATA` 注册 `always_enforce: true`，`evaluateConstraint` 短路恒 block —— strength 降级无法绕过

### Layer 2 — 渲染 + 三态唯一权威（D5）

- `src/install/rules-generator.ts`：`renderCanonicalRules` / `renderBridgeFile` / `decideAction` / `renderRuleFiles`（表驱动）
- `src/rules/generator.ts` 降为胶水层：config/specContext → RuleGenContext → 计划 → 落盘 + `agents-hash.json` 漂移检测保留
- 依赖方向 **rules → install 单向无环**（消除双渲染器内容抖动风险）
- 三态：absent→create / managed（含 `MANAGED_MARKER`）→update / user→skip+诊断；`--force-rules` 接管；**skip 计划绝不携带 content**

### Layer 3 — 分发接线

- `installRuleFiles(agent, workspacePath, { forceRules })`：读现有文件内存快照 → 三态判定 → 落盘，返回 `{ written, skipped }`
- `installRuleFilesAsResult`：copilot 分发路径（分发即 AGENTS.md）
- 10 agent 全量支持（`isAgentSupported` / `getSupportedAgents`）；CLI 注册 codex/windsurf/gemini/copilot 子命令
- `listInstalledAgentSkills` 对无 skills 目录的 agent（`skillsSubDir: ''`）直接返回空 —— 修复 copilot 误列 workspace 根目录
- doctor 增加 legacy 存量检测：**只提示迁移，不删除**

---

## 2. 测试证据

| 测试文件 | 用例数 | 覆盖 |
|----------|--------|------|
| `tests/change/artifact-validator.test.ts` | 26 | TC-B1 / B1x / B3 / B3x |
| `tests/guard/completeness-gate.test.ts` | 12 | TC-B2a–B2f（含 always_enforce 下降级无效） |
| `tests/install/rules-generator.test.ts` | 14 | TC-A2 / A3 / A5（表驱动 + 无 legacy 字符串） |
| `tests/rules/generator-deep.test.ts` | 21 | 胶水层新契约：legacy 过滤 / 薄壳 / 三态 / agents-hash |
| `tests/e2e/rules-dispatch-e2e.test.ts` | 9 | TC-A1 / A1x / A4 / C3 存量不删 |
| **合计** | **82** | **全绿** |

**全量回归**：`npx vitest run --no-file-parallelism` → 4824 测试 **0 失败**。
（并行模式下出现 3 条 `vitest-worker Timeout calling "onTaskUpdate"` 环境抖动与 4 条伴随失败，串行复跑全部通过，判定为资源竞争而非代码缺陷。）

`npx tsc --noEmit` → 0 error。

---

## 3. 设计说明（实现期澄清）

### 3.1 copilot 分发特例

copilot 无自定义 skill 机制，且 TC-A1x 禁止在 `.github/` 下产生额外文件。因此：

- `AGENT_RULE_TARGETS.copilot = { rulesFile: 'AGENTS.md', bridges: {}, skillsDir: '' }`
- `installPackage('copilot', ...)` **不装任何 skill**，只分发 canonical AGENTS.md（`installRuleFilesAsResult`）
- target 非 workspace → 返回明确错误（copilot 规则是 workspace-scoped）
- e2e 验证：预置 `.github/workflows/ci.yml` 存量文件在安装后存在且内容未被触碰，`.github/` 下零新增

### 3.2 空工件 block 的设计依据

`items: []` 或工件缺失（且无声明逃生门 + 人签收）→ E-GUARD-008 block。
理由：完备性门禁的语义是"LLM 评估结果 + 人签收"，空工件既无评估也无签收，放行等于门禁空转，违背 KP-0060"校验归代码（非法工件拒绝执行）"。逃生门保留 LLM 的显式声明权，但签收权仍在人。

### 3.3 只提示不删除（C3）

`.cursorrules` / `.windsurfrules` 永不生成（config 默认值已移除 + `LEGACY_RULE_FILES` 硬过滤双保险）。存量文件：
- 不被删除（`停止生成 ≠ 删除存量`）
- 不被覆盖（e2e 断言内容保持不变）
- doctor 打印一次性迁移提示，迁移与否由用户决定

### 3.4 渲染统一裁决（D5，已登记 decisions.md）

Layer 2 盘点发现 `src/rules/generator.ts`（CHG-3 存量）与新建 `src/install/rules-generator.ts` 并存会产生 AGENTS.md 内容抖动（前者仍生成 .cursorrules、直接覆盖无三态）。裁决以 install/rules-generator 为唯一权威，rules/generator 降为胶水层，已登记为 `[build] 2026-09-01T23:41:01.000Z` 决策条目。

---

## 4. 红线核验

| 红线 | 核验方式 | 结果 |
|------|----------|------|
| C3：legacy 规则文件永不生成 | config 默认值移除 + `LEGACY_RULE_FILES` 硬过滤 + e2e 全树 grep | ✅ |
| 门禁不可通过 strength 降级绕过 | `always_enforce: true` + completeness-gate 降级用例 | ✅ |
| hotfix/tweak 轻量语义不被破坏 | assumptions 门禁仅 `workflow === 'full'` | ✅ |
| 用户手写文件不被静默覆盖 | 三态 skip + e2e 内容未变断言 | ✅ |
| copilot 不污染 `.github/` | e2e 零额外文件断言 | ✅ |

---

## 5. 遗留与后续

- **P1**：`mumuspec spec draft` 一等命令（W1-1）
- **P1**：`mcp-server.ts` 补直接单测
- **热修**：`mumuspec status` 对旧 schema（缺 build_layers）崩溃容错（D3 已列热修级小单）
- **W1 收尾**：loop-auto-evaluate / meta-spec-evolution 两个存量变更归档
- 本文档为 build 完成证据；`verification_report` 字段与 `branch_status` 在 Phase Verify 执行 `mumuspec state set` 后落库
