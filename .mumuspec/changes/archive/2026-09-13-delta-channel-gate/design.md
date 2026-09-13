# Design: delta-channel-gate

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

变更工件侧（constraints/ + delta-specs/）的通道核验以独立模块实现，phase-guard 的 build→verify 门禁消费——先校验器后消费者，同批交付。

## G1: src/guard/delta-channels.ts

```ts
export interface UnchanneledItem {
  file: string;          // 相对 changeDir 路径
  requirement: string;
  polarity: 'shall' | 'shall-not';
  text: string;
  reason: string;        // 人读的缺口说明
}
export function collectUnchanneledDeltaConstraints(changeDir: string): UnchanneledItem[];
```

- 扫描 `constraints/` 与 `delta-specs/` 下内容非空的 .md（与 findCarriedSpecArtifacts 同口径）。
- 每个 .md：`stripFencedBlocks` 后按 `/^## Requirement:/m` 切块；块内条目行匹配：
  - `/^- SHALL NOT[: ]?\s*(.+)$/` → shallNot
  - `/^- SHALL[: ]?\s*(?!NOT)(.+)$/` → shall
  （两种书写形态统一；无冒号形态与归档合并产物一致）
- 块级通道判定（与四分类语义对齐，变更工件无 prohibitions frontmatter → annotation 通道恒无）：
  1. `/^Enforcement:/m` 命中 → 整块 manual（可）
  2. shallNot 文本 `isRegexCheckable`（复用 verifier-classify 共享函数，防漂移）→ R2（可）
  3. shallNot 文本 `ast:` 前缀 → R1（可）
  4. shall → 无自动通道，除非 1
- 词法共享函数复用而非复制（checker/classifier 同源纪律）。

## G2: checkBuildToVerify 接线

- `collectUnchanneledDeltaConstraints(getChangeDir(...))` 非空 → 每条目一条 error：
  `E-GUARD-010 DELTA_CONSTRAINT_UNCHANNELABLE`，message 含 polarity/requirement/text 截断，detail 含文件。
- 无条目文件（tweak/hotfix 无规范工件）→ 跳过（空结果自然通过）。
- 不区分 workflow：hotfix 携带 delta-specs 同样受检（其归档会合并进主规范，风险同源）。

## G3: errors.ts + 权威清单

- `E-GUARD-010`：severity ERROR、forceable: false、fixSteps 三条（补 Enforcement 声明 / 改写含反引号词法锚点 / ast: 前缀接 AST 通道）。
- docs/reference/phase-guards.md build→verify 清单追加该检查项（权威源同步）。

## 不做什么

- 不改主规范侧 E-SPEC-015 语义；不做 implicit-manual 一票否决裁决（该裁决涉及存量约束迁移，另案）。
- 不校验 verify.md 内容与约束的对应（manual 证据匹配已由 missingManualEvidence 承担）。

## 测试用例

1. TC1 constraints 含无通道 SHALL NOT + SHALL → E-GUARD-010 两条，detail 含文件名。
2. TC2 块级 `Enforcement: manual(...)` → 通过；词法锚点（反引号词）→ 通过；`ast:` 前缀 → 通过。
3. TC3 delta-specs 中的条目同样受检；空目录/无文件 → 通过。
4. TC4 既有门禁回归：build_to_verify 既有测试全绿。
