import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeState, GuardResult } from '../core/types.js';
import { readText, computeHash } from '../core/utils.js';
import { getChangeDir, loadChangeState, verifyTestCases } from '../change/manager.js';

/** Run a phase guard check */
export function runPhaseGuard(
  projectRoot: string,
  changeName: string,
  targetPhase: string,
): GuardResult {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) {
    return {
      passed: false,
      errors: [{ code: 'E-GUARD-001', message: `Change not found: ${changeName}` }],
      warnings: [],
    };
  }

  switch (targetPhase) {
    case 'design':
      return checkOpenToDesign(state, projectRoot, changeName);
    case 'build':
      if (state.workflow === 'hotfix' || state.workflow === 'tweak') {
        return checkOpenToBuildHotfix(state, projectRoot, changeName);
      }
      return checkDesignToBuild(state, projectRoot, changeName);
    case 'verify':
      return checkBuildToVerify(state, projectRoot, changeName);
    case 'archive-in-progress':
      return checkVerifyToArchive(state, projectRoot, changeName);
    default:
      return {
        passed: false,
        errors: [{ code: 'E-CHANGE-006', message: `Unknown target phase: ${targetPhase}` }],
        warnings: [],
      };
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

  return { passed: errors.length === 0, errors, warnings };
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

  // Check test cases still locked
  if (!state.test_cases.design_locked) {
    errors.push({ code: 'E-GUARD-004', message: 'test_cases 设计锁定被重置' });
  }

  // Check suites locked
  if (!state.test_cases.suites_locked) {
    warnings.push({ code: 'E-GUARD-004', message: 'test suites 未锁定' });
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

  return { passed: errors.length === 0, errors, warnings };
}
