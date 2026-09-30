/**
 * Grill-Me Universal Engine — Phase-Gate Questioning Mechanism
 *
 * Triggerable at ANY stage when ambiguity exists. Each phase has its own
 * qualification criteria. The engine:
 *
 * 1. Static-checks phase qualification criteria
 * 2. Detects ambiguities/gaps that warrant questioning
 * 3. In interactive mode: enters readline loop (one question at a time)
 * 4. Agent provides recommendation + reasoning for each question
 * 5. Fact self-check: skip questions answerable from code/docs
 * 6. Explicit consensus gate: user must confirm before proceeding
 * 7. Round limit (default 10, configurable per phase)
 * 8. DFS on decision branches (design phase)
 * 9. Results persisted to ChangeState
 *
 * Design phase uses the full protocol from KP-0035 (DFS questioning,
 * fact/decision separation). Other phases use
 * lighter-weight static checks + question generation.
 */

import * as readline from 'node:readline';
import type { ChangeState } from './types-workflow.js';

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════

/** Supported phases for grill-me questioning */
export type GrillMePhase = 'open' | 'design' | 'build' | 'verify' | 'loop';

/** A qualification criterion for phase entry */
export interface GrillMeCriterion {
  id: string;
  /** Human-readable description of what this checks */
  description: string;
  /** Returns true if the criterion passes */
  check: (ctx: GrillMeContext) => boolean;
  /** Severity when failing */
  severity: 'error' | 'warning' | 'info';
  /** Suggested fix when failing */
  suggestion?: string;
}

/** A question presented to the user during interactive grilling */
export interface GrillMeQuestion {
  id: string;
  /** The question text */
  question: string;
  /** Agent's recommended answer */
  recommendation: string;
  /** Reasoning behind the recommendation */
  reasoning: string;
  /** Source of information (Q1 file, code, etc.) */
  source?: string;
  /** Whether this is a fact query (true) or decision query (false) */
  isFactQuery: boolean;
}

/** User response to a grill-me question */
export interface GrillMeAnswer {
  questionId: string;
  /** accepted / rejected / deferred */
  status: 'accepted' | 'rejected' | 'deferred';
  /** User's free-text clarification */
  comment?: string;
}

/** Context for the grill-me engine */
export interface GrillMeContext {
  /** Target phase to validate against */
  phase: GrillMePhase;
  /** Project root directory */
  projectRoot: string;
  /** Change state (if applicable) */
  changeState?: ChangeState;
  /** For loop mode: goal statement */
  goal?: string;
  /** For loop mode: convergence criteria */
  criteria?: string[];
  /** For loop mode: max rounds */
  maxRounds?: number;
  /** Maximum number of questioning rounds (default 10) */
  maxQuestionRounds?: number;
  /** Whether to run interactive mode (default false = static only) */
  interactive?: boolean;
  /** Injectable prompt function for interactive mode (used for testing) */
  promptFn?: (question: string) => Promise<string>;
}

/** Static qualification report (non-interactive) */
export interface GrillMeStaticReport {
  phase: GrillMePhase;
  passed: boolean;
  criteria: Array<{
    id: string;
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  /** Ambiguities detected that could benefit from questioning */
  ambiguities: GrillMeQuestion[];
}

/** Full interactive session report */
export interface GrillMeInteractiveReport {
  phase: GrillMePhase;
  questions: GrillMeQuestion[];
  answers: GrillMeAnswer[];
  consensusReached: boolean;
  roundsUsed: number;
  maxRounds: number;
  deferredCount: number;
  completed: boolean;
}

/** Union of both report types */
export type GrillMeReport = GrillMeStaticReport | GrillMeInteractiveReport;

// ════════════════════════════════════════════════════════════════════
// Phase Qualification Criteria Registry
// ════════════════════════════════════════════════════════════════════

/**
 * Get qualification criteria for a given phase.
 * These define "合格标准" for each stage.
 */
function getCriteriaForPhase(phase: GrillMePhase, ctx: GrillMeContext): GrillMeCriterion[] {
  switch (phase) {
    case 'open':
      return getOpenCriteria(ctx);
    case 'design':
      return getDesignCriteria(ctx);
    case 'build':
      return getBuildCriteria(ctx);
    case 'verify':
      return getVerifyCriteria(ctx);
    case 'loop':
      return getLoopCriteria(ctx);
    default:
      return [];
  }
}

function getOpenCriteria(_ctx: GrillMeContext): GrillMeCriterion[] {
  const criteria: GrillMeCriterion[] = [];

  // Scope clarity
  criteria.push({
    id: 'open-scope-defined',
    description: 'affected_scopes 已明确定义',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && s.affected_scopes.length > 0;
    },
    severity: 'warning',
    suggestion: '在 .mumuspec.yaml 中显式列出 affected_scopes',
  });

  // Proposal completeness
  criteria.push({
    id: 'open-proposal-complete',
    description: 'Open 阶段已完成初步决策记录或认知框架',
    check: (_ctx) => {
      const s = _ctx.changeState;
      if (!s) return false;
      return (s.decisions_log?.counts?.open ?? 0) > 0 || !!s.cognitive_framework?.cognitive_map_ref;
    },
    severity: 'warning',
    suggestion: '运行 proposal 生成或手动补全 proposal.md 的关键章节',
  });

  // Key decisions exist
  criteria.push({
    id: 'open-decisions-recorded',
    description: '至少已记录一项 Open 阶段关键决策',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && (s.decisions_log?.counts?.open ?? 0) >= 1;
    },
    severity: 'info',
    suggestion: '使用 decisions.md 记录关键决策及其依据',
  });

  return criteria;
}

function getDesignCriteria(_ctx: GrillMeContext): GrillMeCriterion[] {
  const criteria: GrillMeCriterion[] = [];

  // Design layers defined
  criteria.push({
    id: 'design-layers-defined',
    description: 'build_layers 已定义非空',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && s.build_layers.length > 0;
    },
    severity: 'warning',
    suggestion: '在设计文档中明确定义实现层次 (build_layers)',
  });

  // SHALL constraints identified
  criteria.push({
    id: 'design-constraints-identified',
    description: '设计阶段已记录关键技术决策（>=1）',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && (s.decisions_log?.counts?.design ?? 0) >= 1;
    },
    severity: 'warning',
    suggestion: '在设计中明确关键技术决策及其依据',
  });

  // Cognitive framework convergence (full workflow)
  criteria.push({
    id: 'design-cognitive-converged',
    description: '认知框架已收敛（full 工作流适用）',
    check: (_ctx) => {
      const s = _ctx.changeState;
      if (!s || s.workflow !== 'full') return true; // skip for non-full
      return !!s.cognitive_framework?.converged;
    },
    severity: 'warning',
    suggestion: '完成认知框架 Q1-Q4 扫描并收敛',
  });

  // Test cases designed
  criteria.push({
    id: 'design-testcases-designed',
    description: 'test cases 已设计并锁定',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && s.test_cases.design_locked;
    },
    severity: 'warning',
    suggestion: '在设计阶段完成 test cases 并锁定',
  });

  return criteria;
}

function getBuildCriteria(_ctx: GrillMeContext): GrillMeCriterion[] {
  const criteria: GrillMeCriterion[] = [];

  // Tests suites locked and passing
  criteria.push({
    id: 'build-tests-locked',
    description: 'test suites 已锁定',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && s.test_cases.suites_locked;
    },
    severity: 'error',
    suggestion: '完成测试套件锁定 (suites_locked = true)',
  });

  criteria.push({
    id: 'build-tests-covered',
    description: '所有 build_layers 对应测试已覆盖',
    check: (_ctx) => {
      const s = _ctx.changeState;
      if (!s) return false;
      const lockedLayers = s.test_cases.suites_locked_layers ?? [];
      return s.build_layers.every((layer) => lockedLayers.includes(layer.layer));
    },
    severity: 'warning',
    suggestion: '确保每层 build_layer 都对应测试覆盖',
  });

  return criteria;
}

function getVerifyCriteria(_ctx: GrillMeContext): GrillMeCriterion[] {
  const criteria: GrillMeCriterion[] = [];

  // Verify result
  criteria.push({
    id: 'verify-result-pass',
    description: 'verify_result 为 pass 或 pass-with-deviations',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && (s.verify_result === 'pass' || s.verify_result === 'pass-with-deviations');
    },
    severity: 'error',
    suggestion: '完成 verify 并确认结果为 pass',
  });

  // Branch status handled
  criteria.push({
    id: 'verify-branch-handled',
    description: 'branch_status 已处理',
    check: (_ctx) => {
      const s = _ctx.changeState;
      return !!s && s.branch_status === 'handled';
    },
    severity: 'error',
    suggestion: '处理分支合并/清理状态',
  });

  // Deviations reviewed (if any)
  criteria.push({
    id: 'verify-deviations-reviewed',
    description: '偏差已审查（如存在）',
    check: (_ctx) => {
      const s = _ctx.changeState;
      if (!s) return true;
      // If pass-with-deviations, there should be accepted_deviations defined
      if (s.verify_result === 'pass-with-deviations') {
        return (s.accepted_deviations?.length ?? 0) > 0;
      }
      return true;
    },
    severity: 'warning',
    suggestion: '明确定义并 review accepted_deviations',
  });

  return criteria;
}

function getLoopCriteria(ctx: GrillMeContext): GrillMeCriterion[] {
  const criteria: GrillMeCriterion[] = [];
  const goal = ctx.goal ?? '';
  const maxRounds = ctx.maxRounds ?? 3;

  criteria.push({
    id: 'loop-goal-specific',
    description: 'Goal 具体可验证（>=10字符 + 含动作动词）',
    check: () => goal.length >= 10 && /实现|完成|添加|修复|优化|重构/.test(goal),
    severity: 'warning',
    suggestion: '格式建议：实现 <具体功能>，使 <用户/系统> 能够 <具体行为>',
  });

  criteria.push({
    id: 'loop-goal-scope',
    description: 'Goal 范围适合有限轮次（<=3 个并列目标）',
    check: () => goal.split(/[,，、]/).length <= 3,
    severity: 'warning',
    suggestion: '考虑拆分目标，每次 loop 聚焦一个核心交付',
  });

  criteria.push({
    id: 'loop-rounds-reasonable',
    description: 'maxRounds 在 1-5 范围内',
    check: () => maxRounds >= 1 && maxRounds <= 5,
    severity: 'warning',
    suggestion: '推荐 2-4 轮。每轮应该能完成一个可独立评估的子目标',
  });

  criteria.push({
    id: 'loop-criteria-exist',
    description: '至少有一个收敛标准',
    check: () => (ctx.criteria?.length ?? 0) > 0,
    severity: 'error',
    suggestion: '定义 1-3 个可验证的收敛条件，例如：功能实现完成、测试通过',
  });

  return criteria;
}

// ════════════════════════════════════════════════════════════════════
// Ambiguity Detection (Question Generation)
// ════════════════════════════════════════════════════════════════════

/**
 * Detect ambiguities that would benefit from grilling.
 * These are questions where Agent has an educated recommendation but user input
 * would significantly improve confidence.
 */
function detectAmbiguities(phase: GrillMePhase, ctx: GrillMeContext): GrillMeQuestion[] {
  const question: GrillMeQuestion[] = [];
  const state = ctx.changeState;

  switch (phase) {
    case 'design':
      // DFS on design decisions: identify design choices that need confirmation
      if (state) {
        // Check for missing technical decisions
        const designDecisions = state.decisions_log?.counts?.design ?? 0;
        if (designDecisions < 2) {
          question.push({
            id: 'design-decisions-sufficient',
            question: '设计阶段记录的技术决策较少。是否已充分评估技术选型和架构方案？',
            recommendation: '建议至少记录 2 项关键技术决策（技术栈选择、核心架构约束）',
            reasoning: '过少的决策记录通常意味着关键设计权衡未被充分讨论',
            source: 'decisions_log.counts.design',
            isFactQuery: false,
          });
        }

        // Check cognitive framework for unresolved Q4
        if (state.cognitive_framework?.enabled && state.cognitive_framework.q4_scans_completed < 3) {
          question.push({
            id: 'design-blind-spots',
            question: `认知框架 Q4 扫描仅完成 ${state.cognitive_framework.q4_scans_completed} 个维度。阻塞性盲区是否已识别？`,
            recommendation: '建议完成至少 3 个维度的盲区扫描',
            reasoning: 'Q4 盲区扫描不足可能遗漏运行时风险或隐式约束',
            source: 'cognitive_framework.q4_scans_completed',
            isFactQuery: true,
          });
        }
      }
      break;

    case 'open':
      // Check for proposal gaps
      if (state && (state.affected_scopes.length === 0)) {
        question.push({
          id: 'open-scope-clarity',
          question: 'affected_scopes 为空。是否需要界定变更影响范围？',
          recommendation: '建议列出受影响的模块/目录清单',
          reasoning: '范围界定不清会导致后续 design/build 阶段蔓延',
          source: 'change_state.affected_scopes',
          isFactQuery: false,
        });
      }
      break;

    case 'build':
      // Build-specific ambiguity: high rollback suggests unresolved design issues
      if (state && state.rollback_count > 0 && state.rollback_count >= state.rollback_limit) {
        question.push({
          id: 'build-rollback-high',
          question: `Build 阶段已回滚 ${state.rollback_count} 次（上限 ${state.rollback_limit}）。是否需回溯到 design 重新审视？`,
          recommendation: '建议暂停构建，回溯 design 阶段验证架构假设',
          reasoning: '频繁回滚通常意味着设计假设未被充分验证',
          source: 'change_state.rollback_count',
          isFactQuery: false,
        });
      }
      // Test coverage mapping gap
      if (state && state.build_layers.length > 0 && state.test_cases.suites_locked && state.test_cases.suites_locked_layers.length === 0) {
        question.push({
          id: 'build-test-layer-map',
          question: '测试已锁定但 suites_locked_layers 为空。测试与构建层次的对应关系是否明确？',
          recommendation: '建议更新 suites_locked_layers 以反映测试覆盖',
          reasoning: '缺少测试-构建层映射导致覆盖率追溯困难',
          source: 'test_cases.suites_locked_layers',
          isFactQuery: false,
        });
      }
      break;

    case 'verify':
      if (state && state.verify_result === 'pass-with-deviations' && (state.accepted_deviations?.length ?? 0) === 0) {
        question.push({
          id: 'verify-deviations-empty',
          question: 'verify 结果为 pass-with-deviations 但 accepted_deviations 为空。偏差是否已被评审？',
          recommendation: '建议明确定义 accepted_deviations 列表',
          reasoning: '未记录的偏差可能在 archive 流程中被审计标记',
          source: 'change_state.accepted_deviations',
          isFactQuery: false,
        });
      }
      break;

    case 'loop':
      // Loop-specific ambiguity detection
      if (ctx.goal && ctx.goal.split(/[,，、]/).length > 2) {
        question.push({
          id: 'loop-goal-split',
          question: `Goal 包含 ${ctx.goal.split(/[,，、]/).length} 个子目标。是否考虑拆分为多次 loop？`,
          recommendation: '建议每次 loop 聚焦一个核心目标，便于收敛评估',
          reasoning: '多目标 loop 容易导致评估偏差和进度不透明',
          source: 'goal.scope_analysis',
          isFactQuery: false,
        });
      }
      break;

    default:
      break;
  }

  return question;
}

// ════════════════════════════════════════════════════════════════════
// Static Mode — Non-interactive Qualification Report
// ════════════════════════════════════════════════════════════════════

/**
 * Run grill-me in static mode: checks qualification criteria without user interaction.
 * Returns a report with pass/fail status and detected ambiguities.
 */
export function runGrillMeStatic(context: GrillMeContext): GrillMeStaticReport {
  const criteria = getCriteriaForPhase(context.phase, context);
  // All failed criteria (both error and warning) cause passed=false,
  // because grill-me is an explicit qualification check.
  const hasFailures = criteria.some((c) => !c.check(context));

  const criterionResults = criteria.map((c) => ({
    id: c.id,
    passed: c.check(context),
    severity: c.severity,
    message: c.description,
    suggestion: c.suggestion,
  }));

  // Only detect ambiguities when there are no hard errors
  const hasErrors = criteria.some((c) => !c.check(context) && c.severity === 'error');
  const ambiguities = hasErrors ? [] : detectAmbiguities(context.phase, context);

  return {
    phase: context.phase,
    passed: !hasFailures,
    criteria: criterionResults,
    ambiguities,
  };
}

// ════════════════════════════════════════════════════════════════════
// Interactive Mode — Questioning Loop
// ════════════════════════════════════════════════════════════════════

/**
 * Run grill-me in interactive mode: enters a readline loop asking one question
 * at a time. Agent provides recommendation + reasoning for each.
 *
 * Protocol (from KP-0035):
 * - One question per round
 * - Agent recommends answer + reasoning
 * - Fact queries are self-checked when possible
 * - Explicit consensus gate at exit
 * - Max rounds enforced
 * - Defer on deep conflict
 */
export async function runGrillMeInteractive(context: GrillMeContext): Promise<GrillMeInteractiveReport> {
  const maxRounds = context.maxQuestionRounds ?? getMaxRoundsForPhase(context.phase);
  const questions: GrillMeQuestion[] = [];
  const answers: GrillMeAnswer[] = [];
  let roundsUsed = 0;
  let deferredCount = 0;

  // First, generate initial ambiguity questions
  const pendingQuestions = detectAmbiguities(context.phase, context);

  // For design phase: DFS on design decisions
  if (context.phase === 'design') {
    const designQs = generateDesignDfsQuestions(context);
    pendingQuestions.push(...designQs);
  }

  // Set up prompt function: use injected one (testing) or readline (production)
  let ask: (prompt: string) => Promise<string>;
  let rl: readline.Interface | null = null;

  if (context.promptFn) {
    ask = context.promptFn;
  } else {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    ask = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl!.question(prompt, resolve);
      });
    };
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Grill-Me — 阶段准入交互质询                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  阶段: ${context.phase} | 上限: ${maxRounds} 轮 | 当前: ${pendingQuestions.length} 个待确认项`);
  console.log('');

  // Process one question per round
  while (roundsUsed < maxRounds && pendingQuestions.length > 0) {
    roundsUsed++;
    const q = pendingQuestions.shift()!;

    // Fact self-check: if Agent can answer from code/docs, skip
    if (q.isFactQuery && canSelfCheck(q, context)) {
      console.log(`  ℹ [自答] ${q.question}`);
      console.log(`     → 基于 ${q.source} 已确认，无需追问`);
      answers.push({ questionId: q.id, status: 'accepted', comment: 'fact-self-checked' });
      continue;
    }

    // Present question with recommendation
    console.log(`\n───── 第 ${roundsUsed}/${maxRounds} 轮 ─────`);
    console.log(`  问: ${q.question}`);
    console.log(`  Agent 推荐: ${q.recommendation}`);
    console.log(`  依据: ${q.reasoning}`);
    if (q.source) {
      console.log(`  来源: ${q.source}`);
    }
    console.log('');
    console.log('  [y] 接受  [n] 拒绝  [d] 推迟  [s] 跳过本轮');
    console.log('');

    const raw = await ask('  请选择 (y/n/d/s): ');
    const choice = raw.trim().toLowerCase() || 's';

    if (choice === 'y' || choice === 'yes') {
      answers.push({ questionId: q.id, status: 'accepted' });
      questions.push(q);
    } else if (choice === 'n' || choice === 'no') {
      const comment = await ask('  请说明拒绝原因 (可选): ');
      answers.push({ questionId: q.id, status: 'rejected', comment: comment || undefined });
      questions.push(q);
    } else if (choice === 'd' || choice === 'defer') {
      deferredCount++;
      answers.push({ questionId: q.id, status: 'deferred' });
      questions.push(q);
    } else {
      // 'skip' — treat as deferred for tracking, but don't push to questions list
      deferredCount++;
      answers.push({ questionId: q.id, status: 'deferred' });
      questions.push(q);
    }
  }

  // Explicit consensus gate
  console.log('');
  console.log('═══════════════════════════════════════════');
  let consensusReached = false;
  if (deferredCount === 0) {
    console.log('所有质询项已达成共识。');
    consensusReached = true;
  } else {
    console.log(`存在 ${deferredCount} 个推迟(deferred)项未决。`);
    const gateResponse = await ask('  是否确认仍要继续？[y/n]: ');
    consensusReached = gateResponse.trim().toLowerCase() === 'y' || gateResponse.trim().toLowerCase() === 'yes';
  }

  if (consensusReached) {
    console.log('  ✅ Grill-Me 门禁通过。');
  } else {
    console.log('  ❌ Grill-Me 门禁未通过 — 请先解决 deferred 项。');
  }

  console.log('');
  if (rl) rl.close();

  return {
    phase: context.phase,
    questions,
    answers,
    consensusReached,
    roundsUsed,
    maxRounds,
    deferredCount,
    completed: true,
  };
}

// ════════════════════════════════════════════════════════════════════
// Design Phase DFS — Deep Question Generation
// ════════════════════════════════════════════════════════════════════

/**
 * Generate DFS-style deep questions for design phase.
 * Traverses the design decision tree branches.
 */
function generateDesignDfsQuestions(ctx: GrillMeContext): GrillMeQuestion[] {
  const questions: GrillMeQuestion[] = [];
  const state = ctx.changeState;

  if (!state) return questions;

  // DFS branch 2: test coverage design
  if (!state.test_cases.design_locked) {
    questions.push({
      id: 'dfs-test-design',
      question: '测试用例设计是否已锁定？',
      recommendation: '建议在设计阶段完成 test cases 锁定，防止 build 阶段漂移',
      reasoning: '测试设计锁定是 Red-Green TDD 的前提条件',
      source: 'test_cases.design_locked',
      isFactQuery: true,
    });
  }

  // DFS branch 3: multi-module coordination
  if (state.modules_affected && state.modules_affected > 1) {
    questions.push({
      id: 'dfs-multi-module',
      question: `变更影响 ${state.modules_affected} 个模块。跨模块接口是否已定义？`,
      recommendation: '建议明确跨模块接口契约，写入 delta-specs',
      reasoning: '多模块变更缺乏接口定义会导致集成风险',
      source: 'change_state.modules_affected',
      isFactQuery: false,
    });
  }

  return questions;
}

// ════════════════════════════════════════════════════════════════════
// Fact Self-Check
// ════════════════════════════════════════════════════════════════════

/**
 * Determine if a fact query can be answered from project code/docs
 * without asking the user.
 */
function canSelfCheck(_question: GrillMeQuestion, _ctx: GrillMeContext): boolean {
  // In current implementation, fact queries with a code-traceable source
  // (e.g., test_cases.Y) can be self-checked
  // because those values are boolean flags in the persisted state.
  // For a more sophisticated implementation, this would query the file system
  // or knowledge graph directly.
  return false; // Conservative default: always ask in current MVP
}

// ════════════════════════════════════════════════════════════════════
// Configuration
// ════════════════════════════════════════════════════════════════════

function getMaxRoundsForPhase(phase: GrillMePhase): number {
  switch (phase) {
    case 'design':
      return 10; // KP-0035 spec
    case 'open':
      return 5;
    case 'build':
      return 3;
    case 'verify':
      return 3;
    case 'loop':
      return 5;
    default:
      return 10;
  }
}

// ════════════════════════════════════════════════════════════════════
// Result Persistence Helper
// ════════════════════════════════════════════════════════════════════

/**
 * Create a grill_me_result object to persist in ChangeState.
 */
export function buildGrillMeResult(report: GrillMeInteractiveReport): ChangeState['grill_me_result'] {
  return {
    completed: report.completed,
    phase: report.phase,
    rounds: report.roundsUsed,
    max_rounds: report.maxRounds,
    deferred_count: report.deferredCount,
    consensus_reached: report.consensusReached,
  };
}

/**
 * Convenience: run static grill-me and print a formatted report.
 */
export function formatStaticReport(report: GrillMeStaticReport): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push(`║  Grill-Me — ${report.phase} 阶段准入检查${' '.repeat(Math.max(0, 16 - report.phase.length * 2))}║`);
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');

  const status = report.passed ? '✓ 通过' : '✗ 需修正';
  const errorCount = report.criteria.filter((c) => !c.passed && c.severity === 'error').length;
  const warnCount = report.criteria.filter((c) => !c.passed && c.severity === 'warning').length;
  lines.push(`状态: ${status} (${errorCount} error, ${warnCount} warning)`);
  lines.push('');

  if (report.criteria.length > 0) {
    lines.push('合格标准检查:');
    for (const c of report.criteria) {
      const icon = c.passed ? '✓' : c.severity === 'error' ? '✗' : '⚠';
      lines.push(`  ${icon} [${c.id}] ${c.message}`);
      if (!c.passed && c.suggestion) {
        lines.push(`     → ${c.suggestion}`);
      }
    }
    lines.push('');
  }

  if (report.ambiguities.length > 0) {
    lines.push(`识别到 ${report.ambiguities.length} 个疑义项，建议交互质询:`);
    for (const a of report.ambiguities) {
      lines.push(`  ? [${a.id}] ${a.question}`);
      lines.push(`     Agent 推荐: ${a.recommendation}`);
    }
    lines.push('');
    lines.push('  运行 `mumuspec grill-me run --phase ' + report.phase + ' --interactive` 进入交互质询模式');
    lines.push('');
  }

  lines.push('');
  return lines.join('\n');
}
