import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeState, GuardResult } from '../core/types.js';
import { readText, computeHash, resolveWithinRoot } from '../core/utils.js';
import { getChangeDir, loadChangeState, saveChangeState, verifyTestCases } from '../change/manager.js';
import { planParallelGroups } from '../change/parallel-planner.js';
import { validateArtifact, extractDecisionRefs, type ArtifactKind } from '../change/artifact-validator.js';
import { applyStrengthToGuardResult } from './checker.js';
import { collectUnchanneledDeltaConstraints } from './delta-channels.js';
import { parseSpecFile, parseTechFile } from '../spec/parser.js';
import { classifyRequirements, missingManualEvidence, type ClassifiedItem } from '../spec/verifier-classify.js';
import type { ConstraintStrengthField } from '../core/config.js';
import { resolveWorkflowRule } from '../core/constraint-evaluator.js';
import { WORKFLOW_RULE_DIMENSION, WORKFLOW_STRENGTH_MATRIX } from '../core/config-tree.js';
import { parse as parseYaml } from 'yaml';

/**
 * Completeness gate v1 (goal-p0-dispatch-gate, ENF-1..4).
 *
 * Double-sign semantics: LLM drafts the artifact (open-questions.yaml /
 * assumptions.yaml) + human signs off via decisions.md (resolution.decision_ref
 * anchors). LLM advisory fields (free-text "complete" markers) never enter this
 * decision path — ENF-3 red line.
 *
 * Fail-closed (KP-0060 axiom 3): schema-invalid artifacts are refused via
 * E-CHANGE-020/021 (always_enforce), never degraded to warnings.
 *
 * Missing-artifact escape hatch (design.md §2.3): an explicit declaration
 * marker in design.md is accepted ONLY with a human signoff entry in
 * decisions.md (≥1 `## [<phase>] <timestamp>` heading).
 */
function checkCompletenessGate(
  projectRoot: string,
  changeName: string,
  kind: ArtifactKind,
  errors: { code: string; message: string; detail?: string }[],
): void {
  const changeDir = getChangeDir(projectRoot, changeName);
  const result = validateArtifact(projectRoot, changeName, kind);

  if (!result.exists) {
    const marker = kind === 'open-questions' ? '<!-- no-open-questions -->' : '<!-- no-assumptions -->';
    const designPath = join(changeDir, 'design.md');
    const declared = existsSync(designPath) && (readText(designPath) || '').includes(marker);
    if (declared) {
      // Declaration path still requires human signoff (双签不可省略)
      const decisionsPath = join(changeDir, 'decisions.md');
      const signoffCount = existsSync(decisionsPath)
        ? extractDecisionRefs(readText(decisionsPath) || '').length
        : 0;
      if (signoffCount === 0) {
        errors.push({
          code: 'E-GUARD-008',
          message: `${kind}.yaml 缺失且 design.md 已声明${marker}，但 decisions.md 无签收条目`,
          detail: '声明路径仍需人工签收：先 mumuspec decisions append 落签收条目',
        });
      }
      return;
    }
    errors.push({
      code: 'E-GUARD-008',
      message: `${kind}.yaml 缺失（完备性门禁要求结构化工件）`,
      detail: `起草工件，或在 design.md 声明 ${marker} 后经 decisions.md 签收`,
    });
    return;
  }

  if (!result.isValid) {
    // Fail-closed: refuse to consume invalid artifacts (TC-B2f)
    for (const e of result.errors) {
      errors.push({ code: e.code, message: `${kind}: ${e.message}`, detail: e.path });
    }
    return;
  }

  if (result.openItemIds.length > 0) {
    // Unresolved open items with no signoff → block (TC-B2a); advisory
    // completeness markers are ignored by construction (TC-B2b)
    errors.push({
      code: 'E-GUARD-008',
      message: `${kind}: ${result.openItemIds.length} 个未消解 open 项（无人工签收不放行）`,
      detail: result.openItemIds.join(', '),
    });
    return;
  }

  if (result.items.length === 0) {
    // Empty artifact = no resolution chain = no signoff record → block
    errors.push({
      code: 'E-GUARD-008',
      message: `${kind}.yaml items 为空（无 resolution 链即无签收记录）`,
      detail: '起草真实 items，或删除工件改用 design.md 声明路径',
    });
  }
}

/**
 * Load design schema from templates/design-schema.yaml
 * Returns the schema or null if file doesn't exist
 */
function loadDesignSchema(projectRoot: string): Record<string, unknown> | null {
  try {
    const schemaPath = join(projectRoot, 'templates', 'design-schema.yaml');
    if (!existsSync(schemaPath)) return null;
    const content = readFileSync(schemaPath, 'utf-8');
    return parseYaml(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Check if design.md has all required sections based on schema
 * Returns missing section names
 */
function checkRequiredSections(
  designContent: string,
  workflow: string,
  schema: Record<string, unknown> | null,
): string[] {
  if (!schema || !schema.sections) return [];

  const sections = schema.sections as Array<{
    name: string;
    patterns: string[];
    required_for: string[];
  }>;

  const missing: string[] = [];
  for (const section of sections) {
    if (!section.required_for.includes(workflow)) continue;

    const hasSection = section.patterns.some((pattern) => {
      const regex = new RegExp(pattern, 'im');
      return regex.test(designContent);
    });

    if (!hasSection) {
      missing.push(section.name);
    }
  }
  return missing;
}

/**
 * Run a phase guard check
 *
 * CHG-5: `options.expectedTddMode`（默认 'tdd'）替代硬编码 'tdd' 校验。
 * 旧变更（tdd_mode 与配置不符）只报 WARN，不阻断。
 */
export function runPhaseGuard(
  projectRoot: string,
  changeName: string,
  targetPhase: string,
  options: { strength?: ConstraintStrengthField; expectedTddMode?: string } = {},
): GuardResult {
  const expectedTddMode = options.expectedTddMode ?? 'tdd';
  const state = loadChangeState(projectRoot, changeName);
  if (!state) {
    return applyStrengthToGuardResult(
      {
        passed: false,
        errors: [{ code: 'E-GUARD-001', message: `Change not found: ${changeName}` }],
        warnings: [],
      },
      options.strength,
    );
  }

  let rawResult: GuardResult;
  switch (targetPhase) {
    case 'design':
      rawResult = checkOpenToDesign(state, projectRoot, changeName);
      break;
    case 'build':
      if (state.workflow === 'hotfix' || state.workflow === 'tweak') {
        rawResult = checkOpenToBuildHotfix(state, projectRoot, changeName, expectedTddMode);
      } else {
        rawResult = checkDesignToBuild(state, projectRoot, changeName, expectedTddMode, options.strength);
      }
      break;
    case 'verify':
      rawResult = checkBuildToVerify(state, projectRoot, changeName);
      break;
    case 'archive-in-progress':
      rawResult = checkVerifyToArchive(state, projectRoot, changeName, options.strength?.enforcement_strict !== false);
      break;
    default:
      rawResult = {
        passed: false,
        errors: [{ code: 'E-CHANGE-006', message: `Unknown target phase: ${targetPhase}` }],
        warnings: [],
      };
  }

  return applyStrengthToGuardResult(rawResult, options.strength);
}

/**
 * CHG-5: tdd_mode 校验 — 只校验合法枚举（tdd|non-tdd）且与配置默认值一致。
 * 非法值 → error；合法但与期望不符（旧变更）→ WARN 不阻断。
 */
function checkTddMode(
  state: ChangeState,
  expectedTddMode: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  const mode = state.tdd_mode;
  if (mode !== 'tdd' && mode !== 'non-tdd') {
    errors.push({
      code: 'E-GUARD-001',
      message: `tdd_mode 非法: ${String(mode)} (合法值: tdd|non-tdd)`,
    });
    return;
  }
  if (mode !== expectedTddMode) {
    warnings.push({
      code: 'W-GUARD-001',
      message: `tdd_mode (${mode}) 与配置默认值 (${expectedTddMode}) 不一致（旧变更不迁移）`,
    });
  }
}

/** open_to_design guard */
function checkOpenToDesign(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];
  const changeDir = getChangeDir(projectRoot, changeName);

  // Check proposal.md exists and non-empty
  const proposalPath = join(changeDir, 'proposal.md');
  if (!existsSync(proposalPath)) {
    errors.push({ code: 'E-GUARD-001', message: 'proposal.md 不存在' });
  } else {
    const content = readText(proposalPath);
    if (!content || content.trim().length < 10) {
      errors.push({ code: 'E-GUARD-001', message: 'proposal.md 为空或内容过少' });
    }
  }

  // Check delta-specs has at least one spec file
  const deltaSpecsDir = join(changeDir, 'delta-specs');
  if (!existsSync(deltaSpecsDir)) {
    warnings.push({ code: 'E-GUARD-001', message: 'delta-specs/ 目录不存在' });
  }

  // Check affected_scopes defined
  if (state.affected_scopes.length === 0) {
    warnings.push({ code: 'E-GUARD-001', message: 'affected_scopes 未定义' });
  }

  // Check decisions.md hash
  const decisionsPath = join(changeDir, 'decisions.md');
  if (existsSync(decisionsPath)) {
    const content = readText(decisionsPath) || '';
    const actualHash = computeHash(content);
    if (state.decisions_log.content_hash && state.decisions_log.content_hash !== actualHash) {
      errors.push({
        code: 'E-CHANGE-007',
        message: 'decisions.md content_hash 不匹配（可能被篡改）',
        detail: `expected: ${state.decisions_log.content_hash}, actual: ${actualHash}`,
      });
    }
  }

  // Check decisions count
  if ((state.decisions_log.counts.open || 0) === 0) {
    warnings.push({ code: 'E-GUARD-001', message: 'Open 阶段无决策记录' });
  }

  return { passed: errors.length === 0, errors, warnings };
}

/** open_to_build_hotfix guard */
function checkOpenToBuildHotfix(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
  expectedTddMode: string = 'tdd',
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];
  const changeDir = getChangeDir(projectRoot, changeName);

  // Check proposal.md — CHG-5 (0.20): downgraded to warning for hotfix/tweak.
  // Process constraint; result constraint (verify pass) catches missing artifacts.
  const proposalPath = join(changeDir, 'proposal.md');
  if (!existsSync(proposalPath)) {
    warnings.push({ code: 'W-GUARD-001', message: 'proposal.md 不存在（hotfix 可省略，结果约束为 verify 通过）' });
  }

  // Check workflow
  if (state.workflow !== 'hotfix' && state.workflow !== 'tweak') {
    errors.push({
      code: 'E-CHANGE-006',
      message: `workflow must be hotfix or tweak, got ${state.workflow}`,
    });
  }

  // Check build_layers defined — CHG-5 (0.20): downgraded to warning for hotfix/tweak.
  // LLM may choose its own implementation strategy.
  if (state.build_layers.length === 0) {
    warnings.push({ code: 'W-GUARD-001', message: 'build_layers 未定义（行为约束 — 允许 LLM 自主选择实现策略）' });
  }

  // Check test-cases exists and locked — CHG-5 (0.20): downgraded to warning
  // for hotfix/tweak paths. Test existence is a process constraint; the result
  // constraint (build_to_verify: all tests green) catches actual failures.
  const testCasesDir = join(changeDir, 'test-cases');
  if (!existsSync(testCasesDir)) {
    warnings.push({ code: 'W-GUARD-001', message: 'test-cases/ 目录不存在（hotfix 可无测试用例，结果约束为 build→verify 全绿）' });
  } else {
    if (!state.test_cases.design_locked) {
      warnings.push({ code: 'W-GUARD-001', message: 'test_cases.design_locked 未设置（行为约束 — 允许 hotfix 灵活实现）' });
    }
  }

  // Check tdd_mode（CHG-5: 比对 expectedTddMode，非法报错，旧变更不匹配仅 WARN）
  checkTddMode(state, expectedTddMode, errors, warnings);

  return { passed: errors.length === 0, errors, warnings };
}

/** design_to_build guard */
function checkDesignToBuild(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
  expectedTddMode: string = 'tdd',
  strength?: ConstraintStrengthField,
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];
  const changeDir = getChangeDir(projectRoot, changeName);

  // Check design.md exists
  const designPath = join(changeDir, 'design.md');
  if (!existsSync(designPath)) {
    errors.push({ code: 'E-GUARD-001', message: 'design.md 不存在' });
  } else {
    const content = readText(designPath);
    if (!content || content.trim().length < 10) {
      errors.push({ code: 'E-GUARD-001', message: 'design.md 为空' });
    }
  }

  // Check constraints
  const shallPath = join(changeDir, 'constraints', 'new-shall.md');
  const shallNotPath = join(changeDir, 'constraints', 'new-shall-not.md');
  if (!existsSync(shallPath) && !existsSync(shallNotPath)) {
    warnings.push({ code: 'E-GUARD-001', message: 'constraints/ 下无 new-shall.md 或 new-shall-not.md' });
  }

  // Check build_layers defined — CHG-5 (0.20): downgraded to warning.
  // Process constraint; result constraint (build_to_verify: all layers done) catches this.
  if (state.build_layers.length === 0) {
    warnings.push({ code: 'W-GUARD-001', message: 'build_layers 未定义（行为约束 — LLM 可自主选择实现分层，结果约束为 build→verify 全部完成）' });
  }

  // Check test-cases locked — behavior constraint, downgraded to WARN for LLM freedom
  if (!state.test_cases.design_locked) {
    warnings.push({ code: 'W-GUARD-001', message: 'test_cases 未锁定（行为约束 — 允许 LLM 自主选择实现策略）' });
  }

  // Verify test-cases hash — behavior constraint, downgraded to WARN for LLM freedom
  const testVerify = verifyTestCases(projectRoot, changeName);
  if (!testVerify.valid) {
    warnings.push({
      code: 'W-GUARD-004',
      message: 'test-cases hash 不匹配（行为约束 — 允许 Build 阶段迭代调整测试）',
      detail: `expected: ${testVerify.expectedHash}, actual: ${testVerify.actualHash}`,
    });
  }

  // Check tdd_mode（CHG-5: 比对 expectedTddMode，非法报错，旧变更不匹配仅 WARN）
  checkTddMode(state, expectedTddMode, errors, warnings);

  // DS-001: Structured Design Template check (W-DESIGN-009 — advisory, not E-)
  // CHG-5 (0.20): downgraded from error to warning — design structure is a
  // process constraint (HOW), not a result constraint. LLM may design freely.
  if (existsSync(designPath)) {
    const designContent = readText(designPath) || '';
    const schema = loadDesignSchema(projectRoot);
    if (schema) {
      const missingSections = checkRequiredSections(designContent, state.workflow, schema);
      if (missingSections.length > 0) {
        warnings.push({
          code: 'W-DESIGN-009',
          message: `Design 文档建议补充字段: ${missingSections.join(', ')}`,
          detail: `可使用 \`mumuspec guard X design --verbose\` 查看匹配规则。此为建议，不阻塞转换。`,
        });
      }
    }
  }

  // DS-004: Cross-artifact consistency check — the helper tags its findings
  // `E-DESIGN-010`, but they are advisory on this path (process constraint
  // BP-10), so the code is remapped to W-DESIGN-010 before entering warnings.
  // Do not "fix" this to E- : that would silently turn a design-review hint
  // into a blocking gate.
  const consistencyWarnings = checkCrossArtifactConsistencySync(state, projectRoot, changeName).map(
    (e) => ({ ...e, code: 'W-DESIGN-010' }),
  );
  warnings.push(...consistencyWarnings);

  // Cognitive framework (full workflow only) — 过程 BP（BP-9/11/12/13 认知框架）
  // 推荐执行：未完成仅产生 warning，不阻塞阶段转换
  if (state.workflow === 'full' && state.cognitive_framework?.enabled) {
    const cf = state.cognitive_framework;
    if (!cf.cognitive_map_ref) {
      warnings.push({ code: 'W-DESIGN-001', message: 'cognitive-map.yaml 不存在' });
    }
    if (cf.q1_count === 0) {
      warnings.push({ code: 'W-DESIGN-002', message: 'Q1 已知的已知为空' });
    }
    if (cf.q2_pending > 0 && cf.rounds_completed < 5) {
      warnings.push({ code: 'W-DESIGN-003', message: `Q2 存在 ${cf.q2_pending} 个待回答问题` });
    }
    if (cf.q3_pending > 0 && cf.rounds_completed < 5) {
      warnings.push({ code: 'W-DESIGN-004', message: `Q3 存在 ${cf.q3_pending} 个待确认推导` });
    }
    if (cf.q4_scans_completed < 3) {
      warnings.push({ code: 'W-DESIGN-005', message: `Q4 扫描仅 ${cf.q4_scans_completed} 个维度（需至少3个）` });
    }
    if (!cf.converged) {
      warnings.push({ code: 'W-DESIGN-006', message: '认知地图未收敛' });
    }
  }

  // Grill-me result — 阶段准入质询，各阶段可在有疑义时触发
  // 未完成仅产生 warning，不阻塞阶段转换；phase-aware 检查：
  // 当 grill_me_result.phase 存在时，只在该 phase 匹配 targetPhase 时检查
  if (state.grill_me_result) {
    const gm = state.grill_me_result;
    // Only check if this grill-me result is for the target phase (or unspecified = design)
    const gmPhase = gm.phase ?? 'design';
    if (gmPhase === 'design') {
      if (!gm.completed) {
        warnings.push({ code: 'W-DESIGN-007', message: 'grill-me 压力测试未完成' });
      }
      if (gm.rounds > gm.max_rounds) {
        warnings.push({
          code: 'W-DESIGN-008',
          message: `grill-me 追问轮次超出上限 (${gm.rounds}/${gm.max_rounds})`,
        });
      }
      if (!gm.consensus_reached && gm.deferred_count > 0) {
        warnings.push({
          code: 'W-DESIGN-011',
          message: `grill-me 有 ${gm.deferred_count} 个 deferred 分支未达成共识`,
        });
      }
    }
  }

  // Completeness gate v1 (ENF-3/ENF-4) — hard gate: errors, not warnings.
  // LLM drafts open-questions.yaml; human signs off via decisions.md.
  checkCompletenessGate(projectRoot, changeName, 'open-questions', errors);

  // I1 设计向上闭合 (design-build orthogonality) — coverage must have no gap.
  checkDesignCoverage(state, projectRoot, changeName, strength, errors, warnings);

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * I1 — 设计向上闭合 (design-build orthogonality, 2026-09-12).
 *
 * Designing Level N means the field of view is Level 0..N, so covering N
 * without covering some lower level is a broken chain: the design skipped a
 * layer it depends on. This is the machine-checkable half of the "自顶向下设计"
 * slogan; the other half (implementation looks down) is I2/I3 in the build and
 * verify guards.
 *
 * Two deliberate design choices (plan BP-3, option B):
 * - **The verdict is always persisted** (`state.design_coverage`). An advisory
 *   check that leaves no artifact is indistinguishable from a check that never
 *   ran — the exact failure mode recorded in archive-lifecycle-defects D1–D4.
 * - **Strength decides block vs warn**, by consuming the previously dead
 *   `workflow.top_down_design` rule (`config.ts` / `config-io.ts` /
 *   `config-tree.ts` all defined it; no consumer existed until now).
 *   No new configuration is introduced.
 */
function checkDesignCoverage(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
  strength: ConstraintStrengthField | undefined,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  const covered = collectCoveredLayers(state, projectRoot, changeName);
  const highest = covered.length > 0 ? Math.max(...covered) : -1;
  const expected = highest < 0 ? [] : Array.from({ length: highest + 1 }, (_, i) => i);
  const missing = expected.filter((n) => !covered.includes(n));
  const unreachableFrom = missing.length > 0 ? missing[0] : null;

  const enforced = strength
    ? resolveWorkflowRule('top_down_design', strength, WORKFLOW_RULE_DIMENSION, WORKFLOW_STRENGTH_MATRIX)
    : false;

  const next: NonNullable<ChangeState['design_coverage']> = {
    covered_layers: covered,
    expected_layers: expected,
    unreachable_from: unreachableFrom,
    checked_at: new Date().toISOString(),
    enforced,
  };

  // Persist the fact (best-effort: a read-only guard run must not crash)
  try {
    const previous = state.design_coverage;
    if (
      !previous ||
      previous.unreachable_from !== next.unreachable_from ||
      previous.covered_layers.join(',') !== next.covered_layers.join(',') ||
      previous.enforced !== next.enforced
    ) {
      state.design_coverage = next;
      state.updated_at = next.checked_at;
      saveChangeState(projectRoot, changeName, state);
    }
  } catch {
    // state persistence is opportunistic; the guard verdict below still stands
  }

  if (unreachableFrom === null) return;

  const message =
    `设计覆盖断链（I1 设计向上闭合）：覆盖了 L${highest} 但缺少 L${unreachableFrom}`;
  const detail =
    `covered=[${covered.join(', ')}] expected=[${expected.join(', ')}] — ` +
    `补 design 产物或修正 build_layers 层级编号`;

  if (enforced) {
    errors.push({ code: 'E-GUARD-009', message, detail });
  } else {
    warnings.push({
      code: 'W-GUARD-009',
      message: `${message}（top_down_design=false → advisory）`,
      detail,
    });
  }
}

/**
 * Layers the design actually covers: `build_layers` layer numbers ∪ the layer
 * suites present under `test-cases/layer-N-cases.md`.
 */
function collectCoveredLayers(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
): number[] {
  const covered = new Set<number>(state.build_layers.map((l) => l.layer));
  const testCasesDir = join(getChangeDir(projectRoot, changeName), 'test-cases');
  if (existsSync(testCasesDir)) {
    for (const file of readdirSync(testCasesDir)) {
      const match = file.match(/^layer-(\d+)-cases\.md$/);
      if (match) covered.add(parseInt(match[1], 10));
    }
  }
  return [...covered].sort((a, b) => a - b);
}

/**
 * DS-004: Cross-artifact consistency check (sync version)
 * Verifies alignment between proposal, design, cognitive-map, and delta-specs
 */
function checkCrossArtifactConsistencySync(
  _state: ChangeState,
  projectRoot: string,
  changeName: string,
): Array<{ code: string; message: string; detail?: string }> {
  const errors: Array<{ code: string; message: string; detail?: string }> = [];
  const changeDir = getChangeDir(projectRoot, changeName);

  // Read all artifacts
  const proposalPath = join(changeDir, 'proposal.md');
  const designPath = join(changeDir, 'design.md');
  const deltaSpecsDir = join(changeDir, 'delta-specs');

  if (!existsSync(proposalPath) || !existsSync(designPath)) {
    return errors; // Handled by other checks
  }

  const proposalContent = readText(proposalPath) || '';
  const designContent = readText(designPath) || '';

  // Check 1: Plan Coverage - proposal Plan steps should appear in design Layers
  const planSection = extractSection(proposalContent, ['Plan', '计划']);
  const designLayersSection = extractSection(designContent, ['Implementation Layers', '实现']);
  if (planSection && designLayersSection) {
    const planSteps = extractListItems(planSection);
    const missingSteps = planSteps.filter((step) => {
      const normalizedStep = step.substring(0, 30).toLowerCase();
      return !designLayersSection.toLowerCase().includes(normalizedStep);
    });
    if (missingSteps.length > 0 && planSteps.length > 2) {
      errors.push({
        code: 'E-DESIGN-010',
        message: `跨工件不一致: proposal Plan 中 ${missingSteps.length} 个步骤未在 design Layers 中找到对应`,
        detail: `缺失步骤: ${missingSteps.slice(0, 3).join('; ')}${missingSteps.length > 3 ? '...' : ''}`,
      });
    }
  }

  // Check 2: FR Satisfaction - proposal FR should be reflected in design
  const frSection = extractSection(proposalContent, ['Requirements', '需求', 'FR']);
  if (frSection && designContent) {
    const frItems = extractListItems(frSection).filter((item) => item.match(/^FR-/));
    const missingFr: string[] = [];
    for (const fr of frItems) {
      const frId = fr.match(/^(FR-\d+)/)?.[1];
      if (frId && !designContent.includes(frId)) {
        missingFr.push(frId);
      }
    }
    if (missingFr.length > 0) {
      errors.push({
        code: 'E-DESIGN-010',
        message: `跨工件不一致: proposal 中 ${missingFr.join(', ')} 未在 design 中被引用`,
      });
    }
  }

  // Check 3: Delta-Spec alignment (sync)
  if (existsSync(deltaSpecsDir) && designContent) {
    try {
      const { readdirSync } = require('node:fs');
      const deltaFiles = readdirSync(deltaSpecsDir).filter((f: string) => f.endsWith('.md'));
      for (const df of deltaFiles) {
        const dfContent = readText(join(deltaSpecsDir, df)) || '';
        const scopeMatch = dfContent.match(/scope:\s*(.+)/i);
        if (scopeMatch) {
          const scope = scopeMatch[1].trim();
          const fileName = scope.split('/').pop() || scope;
          if (fileName && !designContent.includes(fileName) && fileName !== '(new)') {
            errors.push({
              code: 'E-DESIGN-010',
              message: `跨工件不一致: delta-spec ${df} 的 scope "${scope}" 未在 design 中提及`,
            });
          }
        }
      }
    } catch {
      // Ignore delta-spec read errors
    }
  }

  return errors;
}

/**
 * Extract a section from markdown content by heading patterns
 */
function extractSection(content: string, headingPatterns: string[]): string | null {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    const isHeading = headingPatterns.some((pattern) =>
      new RegExp(`^#+\\s*${pattern}`, 'i').test(line.trim()),
    );

    if (isHeading) {
      inSection = true;
      continue;
    }

    if (inSection) {
      if (line.match(/^#{1,3}\s/) && !headingPatterns.some((p) => new RegExp(`^#+\\s*${p}`, 'i').test(line.trim()))) {
        break;
      }
      sectionLines.push(line);
    }
  }

  return sectionLines.length > 0 ? sectionLines.join('\n') : null;
}

/**
 * Extract list items from a section
 */
function extractListItems(sectionContent: string): string[] {
  const items: string[] = [];
  for (const line of sectionContent.split('\n')) {
    const match = line.match(/^\s*[-*]\s+(.+)$/) || line.match(/^\s*\d+\.\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  return items;
}

/** build_to_verify guard */
function checkBuildToVerify(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];

  // Check all build_layers are done
  const pendingLayers = state.build_layers.filter((l) => l.status !== 'done');
  if (pendingLayers.length > 0) {
    errors.push({
      code: 'E-GUARD-002',
      message: `${pendingLayers.length} 个 build_layers 未完成`,
      detail: pendingLayers.map((l) => `Layer ${l.layer}: ${l.status}`).join(', '),
    });
  }

  // I3 层内默认可并行 — same-layer scopes must be uncoupled, otherwise the
  // layer split was a claim the code does not support (design not closed).
  checkLayerParallelism(state, projectRoot, changeName, warnings);

  // Check test cases locked — behavior constraint, downgraded to WARN for LLM freedom
  if (!state.test_cases.design_locked) {
    warnings.push({ code: 'W-GUARD-004', message: 'test_cases 设计锁定被重置（行为约束 — 结果约束为测试全绿）' });
  }

  // Check suites locked — behavior constraint, downgraded to WARN
  if (!state.test_cases.suites_locked) {
    warnings.push({ code: 'W-GUARD-004', message: 'test suites 未锁定（行为约束 — 结果约束为测试全绿）' });
  }

  // ponytail: 原此处有 DS-005 任务粒度检查占位（void GranularityLimit）——
  // 从未产出任何 warning，且无任何文档声明该检查；按 YAGNI 移除（2026-09-05）。
  // 若未来需要任务粒度门禁，应基于 tasks 数据结构重新设计并补充 E/W 错误码。

  // Completeness gate v1 (ENF-3/ENF-4) — hard gate, full workflow only:
  // hotfix/tweak keep their lightweight semantics (只增不改 — no new hard
  // gates on the hotfix path, preserving CHG-5's LLM-freedom decision).
  if (state.workflow === 'full') {
    checkCompletenessGate(projectRoot, changeName, 'assumptions', errors);
  }

  // Delta channel gate (delta-channel-gate, 2026-09-13): carried constraints
  // (constraints/ + delta-specs/) must have a verification channel before the
  // verify phase — unchanneled items must not silently reach the enforced
  // surface at archive. Empty artifact sets pass trivially.
  const unchanneled = collectUnchanneledDeltaConstraints(
    getChangeDir(projectRoot, changeName, state.scope),
  );
  for (const item of unchanneled) {
    errors.push({
      code: 'E-GUARD-010',
      message: `delta 约束无验证通道 (${item.requirement}) [${item.polarity}] "${item.text.slice(0, 60)}" — ${item.reason}`,
      detail: `${item.file}`,
    });
  }

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * I3 — 层内默认可并行 (design-build orthogonality, 2026-09-12).
 *
 * Parallelism is not a capability to build; it is a property to *measure*. Two
 * scopes sitting at the same layer are claiming "we can be implemented
 * concurrently", which only holds if neither calls into the other's unfrozen
 * implementation. A direct CALLS edge between them falsifies the claim.
 *
 * Emitted as a forceable WARN, never a hard block: the edge may legitimately
 * go through a frozen contract, and a false block here would teach agents to
 * distrust the guard. No multi-scope layer → nothing to check.
 */
function checkLayerParallelism(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
  warnings: { code: string; message: string; detail?: string }[],
): void {
  const byLayer = new Map<number, string[]>();
  for (const l of state.build_layers) {
    byLayer.set(l.layer, [...(byLayer.get(l.layer) ?? []), l.scope]);
  }
  if (![...byLayer.values()].some((scopes) => scopes.length > 1)) return;

  let coupled: { from_scope: string; to_scope: string; evidence: string[]; edge_count: number }[];
  try {
    coupled = planParallelGroups(projectRoot, changeName).coupled;
  } catch {
    return; // graph unavailable — stay silent rather than guess
  }

  for (const c of coupled) {
    warnings.push({
      code: 'W-BUILD-001',
      message: `同层 scope 耦合：${c.from_scope} ⇄ ${c.to_scope}（${c.edge_count} 条直接调用边 → I3 不成立）`,
      detail:
        `${c.evidence.join('; ')} — 拆为不同 layer、或合并为一个模块；` +
        `若耦合经冻结契约，用 --force 越过`,
    });
  }
}

/** verify_to_archive guard */
function checkVerifyToArchive(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
  strict = false,
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];
  const changeDir = getChangeDir(projectRoot, changeName);

  // Check verify.md exists
  const verifyPath = join(changeDir, 'verify.md');
  if (!existsSync(verifyPath)) {
    errors.push({ code: 'E-GUARD-001', message: 'verify.md 不存在' });
  }

  // Check all build_layers done
  const pendingLayers = state.build_layers.filter((l) => l.status !== 'done');
  if (pendingLayers.length > 0) {
    errors.push({
      code: 'E-GUARD-002',
      message: `${pendingLayers.length} 个 build_layers 未完成`,
    });
  }

  // Check test immutability — behavior constraint, downgraded to WARN for LLM freedom
  const testVerify = verifyTestCases(projectRoot, changeName);
  if (!testVerify.valid) {
    warnings.push({ code: 'W-GUARD-004', message: 'test immutability 校验失败（行为约束 — 结果约束为 verify_result=pass）' });
  }

  // Check verify_result is pass
  if (state.verify_result !== 'pass' && state.verify_result !== 'pass-with-deviations') {
    errors.push({
      code: 'E-VERIFY-001',
      message: `verify_result 不为 pass (当前: ${state.verify_result})`,
    });
  }

  // Check branch_status handled
  if (state.branch_status !== 'handled') {
    errors.push({
      code: 'E-VERIFY-002',
      message: `branch_status 未处理 (当前: ${state.branch_status})`,
    });
  }

  // Check SHALL/NOT enforcement evidence in verify.md
  if (existsSync(verifyPath)) {
    const verifyContent = readText(verifyPath) || '';
    if (!verifyContent.includes('SHALL') && !verifyContent.includes('SHALL NOT')) {
      warnings.push({
        code: 'W-VERIFY-001',
        message: 'verify.md 未包含 SHALL/SHALL NOT 校验记录',
      });
    }

    // P0 verifier semantics (E-VERIFY-003, strict gate only): every manual-
    // class constraint in the affected scopes must have a verification record
    // anchored by its Enforcement ID or verbatim constraint text. This is a
    // result gate — it does not degrade with strength (always_enforce).
    if (strict) {
      const manualItems = collectManualItems(projectRoot, state.affected_scopes ?? []);
      const missing = missingManualEvidence(verifyContent, manualItems);
      for (const item of missing) {
        errors.push({
          code: 'E-VERIFY-003',
          message: `manual 约束缺少验证记录 (Requirement "${item.requirement}"): "${item.text}"`,
          detail: `${item.source} — 在 verify.md 中引用 Enforcement ID "${item.enforcementId ?? 'N/A'}" 或约束原文`,
        });
      }
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * Collect manual-class constraint items from the affected scopes' specs
 * (spec.md + tech.md per scope). Silent on unreadable/missing files —
 * verifier findings belong to `mumuspec validate`, not the phase gate.
 */
function collectManualItems(projectRoot: string, scopes: string[]): ClassifiedItem[] {
  const items: ClassifiedItem[] = [];
  for (const scope of scopes) {
    const scopeDir = !scope || scope === '.' ? projectRoot : resolveWithinRoot(projectRoot, scope);
    for (const fileName of ['spec.md', 'tech.md'] as const) {
      const specPath = join(scopeDir, '.mumuspec', fileName);
      if (!existsSync(specPath)) continue;
      try {
        const content = readText(specPath);
        if (!content) continue;
        if (fileName === 'spec.md') {
          const spec = parseSpecFile(content, specPath);
          items.push(...classifyRequirements(spec.requirements, spec.frontmatter.prohibitions ?? [], specPath));
        } else {
          const tech = parseTechFile(content, specPath);
          items.push(...classifyRequirements(tech.requirements, [], specPath));
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
  return items.filter((i) => i.cls === 'manual');
}
