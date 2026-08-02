import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeState, GuardResult } from '../core/types.js';
import { readText, computeHash } from '../core/utils.js';
import { getChangeDir, loadChangeState, verifyTestCases } from '../change/manager.js';
import { applyStrengthToGuardResult } from './checker.js';
import type { ConstraintStrengthField } from '../core/config.js';
import { parse as parseYaml } from 'yaml';

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
 * Run a phase guard check */
export function runPhaseGuard(
  projectRoot: string,
  changeName: string,
  targetPhase: string,
  options: { strength?: ConstraintStrengthField } = {},
): GuardResult {
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
        rawResult = checkOpenToBuildHotfix(state, projectRoot, changeName);
      } else {
        rawResult = checkDesignToBuild(state, projectRoot, changeName);
      }
      break;
    case 'verify':
      rawResult = checkBuildToVerify(state, projectRoot, changeName);
      break;
    case 'archive-in-progress':
      rawResult = checkVerifyToArchive(state, projectRoot, changeName);
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
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];
  const changeDir = getChangeDir(projectRoot, changeName);

  // Check proposal.md
  const proposalPath = join(changeDir, 'proposal.md');
  if (!existsSync(proposalPath)) {
    errors.push({ code: 'E-GUARD-001', message: 'proposal.md 不存在' });
  }

  // Check workflow
  if (state.workflow !== 'hotfix' && state.workflow !== 'tweak') {
    errors.push({
      code: 'E-CHANGE-006',
      message: `workflow must be hotfix or tweak, got ${state.workflow}`,
    });
  }

  // Check build_layers defined
  if (state.build_layers.length === 0) {
    errors.push({ code: 'E-GUARD-001', message: 'build_layers 未定义' });
  }

  // Check test-cases exists and locked
  const testCasesDir = join(changeDir, 'test-cases');
  if (!existsSync(testCasesDir)) {
    errors.push({ code: 'E-GUARD-001', message: 'test-cases/ 目录不存在' });
  } else {
    if (!state.test_cases.design_locked) {
      errors.push({ code: 'E-GUARD-001', message: 'test_cases.design_locked 未设置为 true' });
    }
  }

  // Check tdd_mode
  if (state.tdd_mode !== 'tdd') {
    errors.push({ code: 'E-GUARD-001', message: 'tdd_mode 必须为 tdd' });
  }

  return { passed: errors.length === 0, errors, warnings };
}

/** design_to_build guard */
function checkDesignToBuild(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
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

  // Check build_layers defined
  if (state.build_layers.length === 0) {
    errors.push({ code: 'E-GUARD-001', message: 'build_layers 未定义' });
  }

  // Check test-cases locked
  if (!state.test_cases.design_locked) {
    errors.push({ code: 'E-GUARD-001', message: 'test_cases 未锁定' });
  }

  // Verify test-cases hash
  const testVerify = verifyTestCases(projectRoot, changeName);
  if (!testVerify.valid) {
    errors.push({
      code: 'E-GUARD-004',
      message: 'test-cases hash 不匹配',
      detail: `expected: ${testVerify.expectedHash}, actual: ${testVerify.actualHash}`,
    });
  }

  // Check tdd_mode
  if (state.tdd_mode !== 'tdd') {
    errors.push({ code: 'E-GUARD-001', message: 'tdd_mode 必须为 tdd' });
  }

  // DS-001: Structured Design Template check (E-DESIGN-009)
  if (existsSync(designPath)) {
    const designContent = readText(designPath) || '';
    const schema = loadDesignSchema(projectRoot);
    if (schema) {
      const missingSections = checkRequiredSections(designContent, state.workflow, schema);
      if (missingSections.length > 0) {
        errors.push({
          code: 'E-DESIGN-009',
          message: `Design 文档缺少必填字段: ${missingSections.join(', ')}`,
          detail: `请补充以下 section 后重试: ${missingSections.join(', ')}。可使用 \`mumuspec guard X design --verbose\` 查看匹配规则。`,
        });
      }
    }
  }

  // DS-004: Cross-artifact consistency check (E-DESIGN-010)
  const consistencyErrors = checkCrossArtifactConsistencySync(state, projectRoot, changeName);
  errors.push(...consistencyErrors);

  // Check cognitive framework (only for full workflow)
  if (state.workflow === 'full' && state.cognitive_framework?.enabled) {
    const cf = state.cognitive_framework;
    if (!cf.cognitive_map_ref) {
      errors.push({ code: 'E-DESIGN-001', message: 'cognitive-map.yaml 不存在' });
    }
    if (cf.q1_count === 0) {
      errors.push({ code: 'E-DESIGN-002', message: 'Q1 已知的已知为空' });
    }
    if (cf.q2_pending > 0 && cf.rounds_completed < 5) {
      errors.push({ code: 'E-DESIGN-003', message: `Q2 存在 ${cf.q2_pending} 个待回答问题` });
    }
    if (cf.q3_pending > 0 && cf.rounds_completed < 5) {
      errors.push({ code: 'E-DESIGN-004', message: `Q3 存在 ${cf.q3_pending} 个待确认推导` });
    }
    if (cf.q4_scans_completed < 3) {
      errors.push({ code: 'E-DESIGN-005', message: `Q4 扫描仅 ${cf.q4_scans_completed} 个维度（需至少3个）` });
    }
    if (!cf.converged) {
      errors.push({ code: 'E-DESIGN-006', message: '认知地图未收敛' });
    }
  }

  // Check grill-me result (full workflow only)
  if (state.workflow === 'full' && state.grill_me_result) {
    const gm = state.grill_me_result;
    if (!gm.completed) {
      errors.push({ code: 'E-DESIGN-007', message: 'grill-me 压力测试未完成' });
    }
    if (gm.rounds > gm.max_rounds) {
      errors.push({
        code: 'E-DESIGN-008',
        message: `grill-me 追问轮次超出上限 (${gm.rounds}/${gm.max_rounds})`,
      });
    }
    if (!gm.consensus_reached && gm.deferred_count > 0) {
      warnings.push({
        code: 'W-DESIGN-001',
        message: `grill-me 有 ${gm.deferred_count} 个 deferred 分支未达成共识`,
      });
    }
  }

  return { passed: errors.length === 0, errors, warnings };
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
  _projectRoot: string,
  _changeName: string,
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

  // Check test cases still locked
  if (!state.test_cases.design_locked) {
    errors.push({ code: 'E-GUARD-004', message: 'test_cases 设计锁定被重置' });
  }

  // Check suites locked
  if (!state.test_cases.suites_locked) {
    warnings.push({ code: 'E-GUARD-004', message: 'test suites 未锁定' });
  }

  // DS-005: Task granularity warning (W-DESIGN-001)
  if (state.hyperplan_result && state.hyperplan_result.triggered) {
    // Check if any tasks exceed granularity limit (read from state or config)
    const GranularityLimit = 15; // minutes
    const taskLayers = state.build_layers.filter(
      (l) => l.status !== 'done' && l.scope.includes('min'),
    );
    // Note: In full implementation, this would check task metadata
    // For now, this is a placeholder for the warning mechanism
    void GranularityLimit;
    void taskLayers;
  }

  return { passed: errors.length === 0, errors, warnings };
}

/** verify_to_archive guard */
function checkVerifyToArchive(
  state: ChangeState,
  projectRoot: string,
  changeName: string,
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

  // Check test immutability
  const testVerify = verifyTestCases(projectRoot, changeName);
  if (!testVerify.valid) {
    errors.push({ code: 'E-GUARD-004', message: 'test immutability 校验失败' });
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
  }

  return { passed: errors.length === 0, errors, warnings };
}
