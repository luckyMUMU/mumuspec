# Verify: spec-lexical-channel-hygiene

## 测试结果

### 受影响测试

| 范围 | 测试数 | 状态 |
|------|--------|------|
| tests/spec（verifier-classify / verifier-strict / loader-layers / loader-deep 等） | 15 文件 | PASS |
| tests/cli/commands/check-json.test.ts | 8 | PASS |
| tests/core/consistency/metadata-alignment.test.ts | 2 | PASS |
| tests/core/metrics（freedom-suggestions / auto-evaluate / constraint-density 等） | 4 文件 | PASS |
| **合计** | **195** | **PASS** |

### 全量回归

| 指标 | 值 |
|------|-----|
| 测试文件 | 256（255 PASS / 1 FAIL） |
| 测试用例 | 4969（4968 PASS / 1 FAIL） |

与变更前基线**逐项一致**：唯一失败仍为
`tests/cli/cli-smoke.test.ts > mumuspec check runs (dogfooding) with exit 0`，
根因为 59 条既有 E-GUARD-003 违规（单一规则宽匹配扩散），非本变更引入。

### TypeScript 编译

- `npx tsc --noEmit` — 0 errors

### 规范校验与漂移

- `mumuspec validate` — All specs are valid；Enforcement Coverage 299 条
  （enforced-strong 2 / enforced-weak 20 / manual 277 / unverifiable 0，declared_ratio 100%）
- `mumuspec drift` — No drift detected
- `mumuspec check` — E-GUARD-003 **59 条**（回到变更前基线，新增的 9 条误报清零）；
  `[E-AGENTS-001]` 漂移已随 Rules 重新生成消失
- AGENTS.md 15,548 字节 < 32KiB 预算

## SHALL / SHALL NOT 校验记录

### Requirement: 约束通道与约束语义一致

| 约束 | 状态 | 证据 |
|------|------|------|
| SHALL 约束文本的行内代码标记仅用于约束实际检查的字面量 | DONE | 两条约束文本已按此改写；`mumuspec check` 的 E-GUARD-003 由 68 降回 59 |
| SHALL NOT 以行内代码标记承载对象标识符（配置键、命令名、字段名） | SATISFIED | 本次不再有此类约束；对其余含行内标记的 SHALL NOT 逐条复核，标记均指向通道字面量（`--force`、`.cursorrules`、`.windsurfrules`、`.mumuspec.yaml`、`decisions.md`、`.mumuspec`） |
| SHALL NOT 为同一语义保留两条约束 | SATISFIED | 重复条目已删除，唯一权威源保留于既有 Requirement「反哺建议（advisory）」 |

### Enforcement

| ID | 声明 | 落地 |
|----|------|------|
| ENF-1 | manual(设计评审核对) | 逐条核对两条约束文本的行内代码标记用途与重复性；manual 证据即本表两行 SATISFIED 记录 |

## 实施变更清单

### 修改文件

- `.mumuspec/spec.md` — 删除重复 SHALL NOT（自动应用建议条，与既有「禁止自动修改 constraint_strength 配置」同义）；
  改写「新增命令改变 loop evaluate 收敛语义」一条，去掉承载对象标识符的行内代码标记
- `AGENTS.md` / `CLAUDE.md` — 经 `generateRulesFiles` 重新生成（与 init Step 10 同一路径、同一参数）
- `.mumuspec/agents-hash.json` — 随 Rules 生成更新

### 新增

- `.mumuspec/changes/spec-lexical-channel-hygiene/delta-specs/spec-lexical-channel-hygiene.md`
  — 「约束通道与约束语义一致」Requirement，归档时合并入 `.mumuspec/spec.md`

## 已知限制（沿用，不属本变更范围）

- 59 条既有 E-GUARD-003 违规仍在（`SHALL NOT 仅以 .mumuspec 存在性判定模块` 的宽匹配扩散），
  `cli-smoke` 的 dogfooding 门槛因此持续失败；收敛该规则判定精度需独立变更。
- `src/.mumuspec/changes/` 残留（此前错误作用域创建/丢弃所留，mumuspec 管理的工件）未清理；属独立项。
