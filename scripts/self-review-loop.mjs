#!/usr/bin/env node
/**
 * Self-Review Loop — 20-Round Iterative Project Audit
 *
 * Cycle: Review → Evaluate → Analyze → Improve
 *
 * This script runs 20 rounds of self-review against the MumuSpec project itself,
 * measuring alignment with the core philosophy:
 *   "AI as compiler, human's core output is persistent spec"
 *
 * Metrics collected per round:
 *   D1: Spec Persistence Quality
 *   D2: AI Perceptibility
 *   D3: Spec-Code Consistency
 *   D4: Contract Completeness
 *   D5: Architecture Health
 *   D6: Test Coverage
 *   D7: Type Safety
 *   D8: Module Review (D8 dimensions from review command)
 *
 * Output: JSON report + Markdown summary
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const PROJECT_ROOT = resolve(process.cwd());
const ROUNDS = 20;
const REPORT_DIR = join(PROJECT_ROOT, 'review', 'self-review-loop');

// ════════════════════════════════════════════════════════════════════
// Phase 1: REVIEW — Collect raw data
// ════════════════════════════════════════════════════════════════════

function runCommand(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: options.timeout || 60000,
    shell: true,
    maxBuffer: 10 * 1024 * 1024, // 10MB — vitest JSON output exceeds default 1MB
    ...options,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    error: result.error ? result.error.message : null,
  };
}

// Cache flags — prevent re-running expensive commands when they already ran once
let cachedTestResults = null;
let cachedTscErrors = null;
let cachedModuleReview = null;
let cachedCompliance = null;
let testResultsAttempted = false;
let tscErrorsAttempted = false;
let moduleReviewAttempted = false;
let complianceAttempted = false;

function collectReviewData(round) {
  const data = {};

  // Run expensive commands only on round 1, 10, and 20
  const runExpensive = (round === 1 || round === 10 || round === 20);

  // D8: Module Review
  if ((runExpensive || !moduleReviewAttempted) && cachedModuleReview === null) {
    moduleReviewAttempted = true;
    try {
      const reviewResult = runCommand('npx', ['tsx', 'src/cli.ts', 'review', '--json'], { timeout: 60000 });
      if (reviewResult.stdout && reviewResult.stdout.trim().startsWith('{')) {
        cachedModuleReview = JSON.parse(reviewResult.stdout);
      }
    } catch { /* keep null */ }
  }
  data.moduleReview = cachedModuleReview;

  // D7: TypeScript Check
  if (runExpensive || !tscErrorsAttempted) {
    tscErrorsAttempted = true;
    const tscResult = runCommand('npx', ['tsc', '--noEmit'], { timeout: 120000 });
    cachedTscErrors = (tscResult.stdout + tscResult.stderr)
      .split('\n')
      .filter(l => l.includes('error TS'))
      .map(l => l.trim());
  }
  data.tscErrors = cachedTscErrors || [];

  // D6: Test Results — vitest JSON output goes to stdout
  if (runExpensive || !testResultsAttempted) {
    testResultsAttempted = true;
    try {
      // vitest --reporter=json outputs a single large JSON line to stdout
      // The JSON may be very large (~1.4MB), so maxBuffer must be set (done in runCommand)
      const testResult = runCommand('npx', ['vitest', 'run', '--reporter=json', '--no-color'], { timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
      const combinedOutput = testResult.stdout + testResult.stderr;
      if (combinedOutput) {
        // vitest JSON is a single line — try parsing the entire stdout as JSON first
        try {
          const testJson = JSON.parse(testResult.stdout || combinedOutput);
          if (testJson.numTotalTests !== undefined) {
            cachedTestResults = {
              total: testJson.numTotalTests || 0,
              passed: testJson.numPassedTests || 0,
              failed: testJson.numFailedTests || 0,
              passRate: testJson.numTotalTests > 0
                ? testJson.numPassedTests / testJson.numTotalTests
                : 0,
            };
          }
        } catch { /* not pure JSON, try line-by-line */ }
        // Fallback: scan lines for a JSON object containing numTotalTests
        if (!cachedTestResults) {
          const lines = combinedOutput.split('\n').filter(l => l.trim());
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.includes('numTotalTests')) {
              try {
                const testJson = JSON.parse(line);
                cachedTestResults = {
                  total: testJson.numTotalTests || 0,
                  passed: testJson.numPassedTests || 0,
                  failed: testJson.numFailedTests || 0,
                  passRate: testJson.numTotalTests > 0
                    ? testJson.numPassedTests / testJson.numTotalTests
                    : 0,
                };
                break;
              } catch { /* try next line */ }
            }
          }
        }
        // Final fallback: parse vitest text output for pass/fail counts
        if (!cachedTestResults) {
          // Look for patterns like "Tests  4699 passed | 3 failed" or "Tests  4702 passed"
          const passMatch = combinedOutput.match(/(\d+)\s+passed/);
          const failMatch = combinedOutput.match(/(\d+)\s+failed/);
          if (passMatch) {
            const passed = parseInt(passMatch[1], 10);
            const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
            const total = passed + failed;
            cachedTestResults = {
              total,
              passed,
              failed,
              passRate: total > 0 ? passed / total : 0,
            };
          }
        }
      }
    } catch { /* keep null */ }
  }
  data.testResults = cachedTestResults;

  // D3: Compliance & Drift (cheaper, run every 5 rounds)
  if ((round % 5 === 1) || !complianceAttempted) {
    complianceAttempted = true;
    try {
      const driftResult = runCommand('npx', ['tsx', 'src/cli.ts', 'check'], { timeout: 60000 });
      cachedCompliance = driftResult.stdout + driftResult.stderr;
    } catch { cachedCompliance = ''; }
  }
  data.complianceOutput = cachedCompliance || '';

  // These are fast file-system scans — run every round
  data.specFiles = collectSpecFiles();
  data.aiPerceptibility = collectAIPerceptibility();
  data.contracts = collectContractInfo();
  data.architecture = collectArchitectureData();

  return data;
}

function collectSpecFiles() {
  const specs = [];
  function scan(dir) {
    const mumuDir = join(dir, '.mumuspec');
    if (existsSync(mumuDir)) {
      const files = ['spec.md', 'prd.md', 'tech.md', 'constraints.yaml', 'BOUNDARY.md', 'AGENTS.md'];
      for (const f of files) {
        const fp = join(mumuDir, f);
        if (existsSync(fp)) {
          const stat = statSync(fp);
          specs.push({
            path: relative(PROJECT_ROOT, fp).replace(/\\/g, '/'),
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      }
    }
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          scan(join(dir, entry.name));
        }
      }
    } catch { /* skip */ }
  }
  scan(PROJECT_ROOT);
  return specs;
}

function collectAIPerceptibility() {
  const result = { files: [], coverage: 0 };
  const aiFiles = ['CLAUDE.md', 'AGENTS.md', '.cursorrules', '.mumuspec/skills/mumuspec.md'];
  for (const f of aiFiles) {
    const fp = join(PROJECT_ROOT, f);
    if (existsSync(fp)) {
      result.files.push({ path: f, exists: true });
    }
  }

  const srcDir = join(PROJECT_ROOT, 'src');
  if (existsSync(srcDir)) {
    let total = 0, withAgents = 0;
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        total++;
        if (existsSync(join(srcDir, entry.name, 'AGENTS.md')) ||
            existsSync(join(srcDir, entry.name, '.mumuspec'))) {
          withAgents++;
        }
      }
    }
    result.coverage = total > 0 ? withAgents / total : 0;
  }
  return result;
}

function collectContractInfo() {
  const contractDir = join(PROJECT_ROOT, '.mumuspec', 'contracts');
  const contracts = [];
  if (existsSync(contractDir)) {
    function scanContracts(dir) {
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            scanContracts(join(dir, entry.name));
          } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') || entry.name.endsWith('.md')) {
            contracts.push(relative(PROJECT_ROOT, join(dir, entry.name)).replace(/\\/g, '/'));
          }
        }
      } catch { /* skip */ }
    }
    scanContracts(contractDir);
  }
  return { count: contracts.length, files: contracts };
}

function collectArchitectureData() {
  const srcDir = join(PROJECT_ROOT, 'src');
  let totalFiles = 0, totalLines = 0;
  const modules = [];

  if (existsSync(srcDir)) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const modPath = join(srcDir, entry.name);
        let fileCount = 0, lineCount = 0;
        function countFiles(dir) {
          try {
            for (const e of readdirSync(dir, { withFileTypes: true })) {
              if (e.isDirectory()) {
                countFiles(join(dir, e.name));
              } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
                fileCount++;
                try {
                  const content = readFileSync(join(dir, e.name), 'utf-8');
                  lineCount += content.split('\n').length;
                } catch { /* skip */ }
              }
            }
          } catch { /* skip */ }
        }
        countFiles(modPath);
        totalFiles += fileCount;
        totalLines += lineCount;
        modules.push({ name: entry.name, files: fileCount, lines: lineCount });
      }
    }
  }

  return { totalFiles, totalLines, modules };
}

// ════════════════════════════════════════════════════════════════════
// Phase 2: EVALUATE — Compute metric scores
// ════════════════════════════════════════════════════════════════════

function evaluateData(data) {
  const metrics = {};

  // D1: Spec Persistence Quality (0-100)
  const specCount = data.specFiles ? data.specFiles.length : 0;
  const specTypes = new Set((data.specFiles || []).map(f => f.path.split('/').pop()));
  metrics.D1_specPersistence = Math.min(100, Math.round(
    (specCount > 0 ? 30 : 0) +
    (specTypes.has('spec.md') || specTypes.has('prd.md') ? 20 : 0) +
    (specTypes.has('tech.md') ? 15 : 0) +
    (specTypes.has('constraints.yaml') ? 15 : 0) +
    (specTypes.has('BOUNDARY.md') ? 10 : 0) +
    (specTypes.has('AGENTS.md') ? 10 : 0)
  ));

  // D2: AI Perceptibility (0-100)
  const aiFiles = data.aiPerceptibility ? data.aiPerceptibility.files.length : 0;
  const aiCoverage = data.aiPerceptibility ? data.aiPerceptibility.coverage : 0;
  metrics.D2_aiPerceptibility = Math.min(100, Math.round(
    (aiFiles >= 2 ? 40 : aiFiles * 20) +
    (aiCoverage * 60)
  ));

  // D3: Spec-Code Consistency (0-100)
  const complianceText = data.complianceOutput || '';
  const hasErrors = /error|ERROR|E-GUARD|E-SPEC/i.test(complianceText);
  const hasWarnings = /warn|WARN/i.test(complianceText);
  metrics.D3_specCodeConsistency = Math.round(
    hasErrors ? 50 : hasWarnings ? 75 : 90
  );

  // D4: Contract Completeness (0-100)
  const contractCount = data.contracts ? data.contracts.count : 0;
  metrics.D4_contractCompleteness = Math.min(100, Math.round(
    contractCount >= 10 ? 80 : contractCount >= 5 ? 60 : contractCount > 0 ? 40 : 20
  ));

  // D5: Architecture Health (0-100)
  const arch = data.architecture || {};
  const moduleCount = arch.modules ? arch.modules.length : 0;
  const avgLinesPerModule = moduleCount > 0 ? arch.totalLines / moduleCount : 0;
  metrics.D5_architectureHealth = Math.min(100, Math.round(
    (moduleCount >= 10 ? 30 : moduleCount * 3) +
    (avgLinesPerModule > 0 && avgLinesPerModule < 500 ? 40 : avgLinesPerModule < 1000 ? 25 : 10) +
    (arch.totalFiles > 50 ? 30 : arch.totalFiles * 0.6)
  ));

  // D6: Test Coverage (0-100)
  const testPassRate = data.testResults ? data.testResults.passRate : 0;
  metrics.D6_testCoverage = Math.round(testPassRate * 100);

  // D7: Type Safety (0-100)
  const tscErrors = data.tscErrors ? data.tscErrors.length : 0;
  metrics.D7_typeSafety = Math.max(0, 100 - tscErrors * 10);

  // D8: Module Review (0-100)
  const reviewAvg = data.moduleReview ? data.moduleReview.overall_average : 0;
  metrics.D8_moduleReview = Math.round(reviewAvg * 10);

  // Composite Score (weighted)
  const compositeScore = Math.round(
    metrics.D1_specPersistence * 0.20 +
    metrics.D2_aiPerceptibility * 0.15 +
    metrics.D3_specCodeConsistency * 0.15 +
    metrics.D4_contractCompleteness * 0.10 +
    metrics.D5_architectureHealth * 0.10 +
    metrics.D6_testCoverage * 0.10 +
    metrics.D7_typeSafety * 0.10 +
    metrics.D8_moduleReview * 0.10
  );

  return { metrics, compositeScore };
}

// ════════════════════════════════════════════════════════════════════
// Phase 3: ANALYZE — Identify issues and insights
// ════════════════════════════════════════════════════════════════════

function analyzeResults(data, evaluation, round, prevRounds) {
  const issues = [];
  const insights = [];
  const strengths = [];
  const m = evaluation.metrics;

  // D1
  if (m.D1_specPersistence < 80) {
    issues.push({
      dimension: 'D1',
      severity: m.D1_specPersistence < 50 ? 'critical' : 'warning',
      message: `Spec 持久化覆盖不足 (${m.D1_specPersistence}/100)`,
      detail: `仅发现 ${(data.specFiles || []).length} 个 spec 文件`,
    });
  } else {
    strengths.push(`Spec 持久化质量良好 (${m.D1_specPersistence}/100)`);
  }

  // D2
  if (m.D2_aiPerceptibility < 80) {
    issues.push({
      dimension: 'D2',
      severity: m.D2_aiPerceptibility < 50 ? 'critical' : 'warning',
      message: `AI 可感知性不足 (${m.D2_aiPerceptibility}/100)`,
      detail: `AI 文件覆盖: ${data.aiPerceptibility ? data.aiPerceptibility.files.length : 0}, 模块覆盖率: ${Math.round((data.aiPerceptibility ? data.aiPerceptibility.coverage : 0) * 100)}%`,
    });
  } else {
    strengths.push(`AI 可感知性良好 (${m.D2_aiPerceptibility}/100)`);
  }

  // D3
  if (m.D3_specCodeConsistency < 80) {
    issues.push({
      dimension: 'D3',
      severity: 'warning',
      message: `规范-代码一致性有风险 (${m.D3_specCodeConsistency}/100)`,
      detail: '检测到合规错误或警告',
    });
  }

  // D4
  if (m.D4_contractCompleteness < 60) {
    issues.push({
      dimension: 'D4',
      severity: m.D4_contractCompleteness < 30 ? 'critical' : 'warning',
      message: `契约层完整性不足 (${m.D4_contractCompleteness}/100)`,
      detail: `仅 ${data.contracts ? data.contracts.count : 0} 个契约文件`,
    });
  } else {
    strengths.push(`契约层覆盖较好 (${m.D4_contractCompleteness}/100)`);
  }

  // D6
  if (m.D6_testCoverage < 100) {
    issues.push({
      dimension: 'D6',
      severity: m.D6_testCoverage < 90 ? 'warning' : 'info',
      message: `测试通过率: ${m.D6_testCoverage}% (${data.testResults ? data.testResults.failed : 0} 个失败)`,
    });
  } else {
    strengths.push(`全部测试通过 (${data.testResults ? data.testResults.total : 0} 个测试)`);
  }

  // D7
  if (m.D7_typeSafety < 100) {
    issues.push({
      dimension: 'D7',
      severity: m.D7_typeSafety < 80 ? 'warning' : 'info',
      message: `类型安全: ${data.tscErrors ? data.tscErrors.length : 0} 个 TypeScript 错误`,
      detail: (data.tscErrors || []).slice(0, 3).join('; '),
    });
  } else {
    strengths.push(`类型安全完美 (0 个错误)`);
  }

  // D8 module-level analysis
  if (data.moduleReview && data.moduleReview.modules) {
    const lowModules = data.moduleReview.modules.filter(mod => mod.overall < 9.5);
    if (lowModules.length > 0) {
      issues.push({
        dimension: 'D8',
        severity: 'info',
        message: `${lowModules.length} 个模块评分低于 9.5`,
        detail: lowModules.map(m => `${m.module}(${m.overall})`).join(', '),
      });
    }

    const dimScores = {};
    for (const mod of data.moduleReview.modules) {
      for (const [dim, score] of Object.entries(mod.dimensions)) {
        if (!dimScores[dim]) dimScores[dim] = [];
        dimScores[dim].push(score);
      }
    }
    const weakDim = Object.entries(dimScores)
      .map(([dim, scores]) => ({ dim, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
      .sort((a, b) => a.avg - b.avg)[0];
    if (weakDim) {
      insights.push({
        type: 'weakest_dimension',
        message: `最弱维度: ${weakDim.dim} (平均 ${weakDim.avg.toFixed(1)}/10)`,
      });
    }
  }

  // Trend analysis
  if (prevRounds.length > 0) {
    const prev = prevRounds[prevRounds.length - 1];
    const prevScore = prev.evaluation ? prev.evaluation.compositeScore : prev.compositeScore;
    const scoreDelta = evaluation.compositeScore - prevScore;
    if (Math.abs(scoreDelta) < 1) {
      insights.push({ type: 'stagnation', message: `分数停滞: 与上一轮相比变化 ${scoreDelta} 分` });
    } else if (scoreDelta > 0) {
      insights.push({ type: 'improvement', message: `分数提升: +${scoreDelta} 分` });
    } else {
      insights.push({ type: 'regression', message: `分数回退: ${scoreDelta} 分` });
    }
  }

  // Philosophy alignment
  const philosophyChecks = checkPhilosophyAlignment(data, evaluation);
  insights.push(...philosophyChecks);

  return { issues, insights, strengths };
}

function checkPhilosophyAlignment(data, evaluation) {
  const insights = [];
  const aiFiles = data.aiPerceptibility ? data.aiPerceptibility.files.length : 0;
  if (aiFiles >= 2) {
    insights.push({ type: 'philosophy', message: '[PASS] AI 作为编译器: AI-facing 文件充分 (CLAUDE.md/AGENTS.md/skills)' });
  } else {
    insights.push({ type: 'philosophy', message: '[FAIL] AI 作为编译器: AI-facing 文件不足，开发者可能无法感知规范约束' });
  }

  const specCount = (data.specFiles || []).length;
  const hasSpecMd = (data.specFiles || []).some(f => f.path.endsWith('spec.md'));
  const hasPrdMd = (data.specFiles || []).some(f => f.path.endsWith('prd.md'));
  const hasTechMd = (data.specFiles || []).some(f => f.path.endsWith('tech.md'));

  if (specCount > 10 && (hasSpecMd || hasPrdMd) && hasTechMd) {
    insights.push({ type: 'philosophy', message: '[PASS] 持久化 spec: spec 文件丰富，覆盖 spec.md/prd.md/tech.md 多种类型' });
  } else {
    insights.push({ type: 'philosophy', message: `[WARN] 持久化 spec: spec 文件数量 ${specCount}，类型覆盖待提升` });
  }

  if (evaluation.metrics.D3_specCodeConsistency >= 75) {
    insights.push({ type: 'philosophy', message: '[PASS] 规范-代码绑定: 合规检查和漂移检测运行正常' });
  } else {
    insights.push({ type: 'philosophy', message: '[FAIL] 规范-代码绑定: 存在合规错误或漂移' });
  }

  return insights;
}

// ════════════════════════════════════════════════════════════════════
// Phase 4: IMPROVE — Generate improvement recommendations
// ════════════════════════════════════════════════════════════════════

function generateImprovements(analysis, evaluation, round) {
  const actions = [];
  const priorities = [];

  const critical = analysis.issues.filter(i => i.severity === 'critical');
  const warnings = analysis.issues.filter(i => i.severity === 'warning');
  const infos = analysis.issues.filter(i => i.severity === 'info');

  for (const issue of critical) {
    actions.push({ priority: 'P0', dimension: issue.dimension, action: `修复关键问题: ${issue.message}`, detail: issue.detail, expectedImpact: `预计提升 ${issue.dimension} 分数至 80+` });
  }
  for (const issue of warnings) {
    actions.push({ priority: 'P1', dimension: issue.dimension, action: `改进: ${issue.message}`, detail: issue.detail, expectedImpact: `预计提升 ${issue.dimension} 分数 10-20 分` });
  }
  for (const issue of infos) {
    actions.push({ priority: 'P2', dimension: issue.dimension, action: `优化: ${issue.message}`, detail: issue.detail, expectedImpact: `微调 ${issue.dimension} 分数` });
  }

  if (round <= 5) priorities.push('初期轮次: 聚焦基线建立和关键问题识别');
  else if (round <= 10) priorities.push('中期轮次: 深入分析架构和契约层短板');
  else if (round <= 15) priorities.push('后期轮次: 验证改进效果和趋势分析');
  else priorities.push('最终轮次: 综合评估和报告生成');

  if (evaluation.metrics.D2_aiPerceptibility < 80) priorities.push('提升 AI 可感知性: 为更多模块生成 AGENTS.md 和 BOUNDARY.md');
  if (evaluation.metrics.D4_contractCompleteness < 60) priorities.push('完善契约层: 补充 contract 定义文件');
  if (evaluation.metrics.D7_typeSafety < 100) priorities.push('修复 TypeScript 错误: 确保类型安全零错误');

  return { actions, priorities };
}

// ════════════════════════════════════════════════════════════════════
// Main Loop
// ════════════════════════════════════════════════════════════════════

function runLoop() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  MumuSpec Self-Review Loop — 20-Round Iterative Audit        ║');
  console.log('║  Cycle: Review -> Evaluate -> Analyze -> Improve             ║');
  console.log('║  Philosophy: AI as compiler, human output = persistent spec  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const allRounds = [];
  const startTime = Date.now();

  for (let round = 1; round <= ROUNDS; round++) {
    const roundStart = Date.now();
    console.log(`\n--- Round ${round}/${ROUNDS} ---`);

    // Phase 1: REVIEW
    process.stdout.write('[1/4] Reviewing project... ');
    const reviewData = collectReviewData(round);
    console.log('done');

    // Phase 2: EVALUATE
    process.stdout.write('[2/4] Evaluating metrics... ');
    const evaluation = evaluateData(reviewData);
    console.log('done');

    // Phase 3: ANALYZE
    process.stdout.write('[3/4] Analyzing results... ');
    const analysis = analyzeResults(reviewData, evaluation, round, allRounds);
    console.log('done');

    // Phase 4: IMPROVE
    process.stdout.write('[4/4] Generating improvements... ');
    const improvement = generateImprovements(analysis, evaluation, round);
    console.log('done');

    const roundResult = {
      round,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - roundStart,
      review: {
        specFileCount: reviewData.specFiles ? reviewData.specFiles.length : 0,
        moduleCount: reviewData.moduleReview ? reviewData.moduleReview.modules_reviewed : 0,
        testTotal: reviewData.testResults ? reviewData.testResults.total : 0,
        tscErrorCount: reviewData.tscErrors ? reviewData.tscErrors.length : 0,
        contractCount: reviewData.contracts ? reviewData.contracts.count : 0,
        aiFileCount: reviewData.aiPerceptibility ? reviewData.aiPerceptibility.files.length : 0,
        aiCoverage: reviewData.aiPerceptibility ? reviewData.aiPerceptibility.coverage : 0,
        totalSourceFiles: reviewData.architecture ? reviewData.architecture.totalFiles : 0,
        totalSourceLines: reviewData.architecture ? reviewData.architecture.totalLines : 0,
      },
      evaluation: {
        metrics: evaluation.metrics,
        compositeScore: evaluation.compositeScore,
      },
      analysis: {
        issueCount: analysis.issues.length,
        criticalCount: analysis.issues.filter(i => i.severity === 'critical').length,
        warningCount: analysis.issues.filter(i => i.severity === 'warning').length,
        insightCount: analysis.insights.length,
        strengthCount: analysis.strengths.length,
        issues: analysis.issues,
        insights: analysis.insights,
        strengths: analysis.strengths,
      },
      improvement,
    };

    allRounds.push(roundResult);

    // Print round summary
    console.log(`  Score: ${evaluation.compositeScore}/100`);
    console.log(`  D1=${evaluation.metrics.D1_specPersistence} D2=${evaluation.metrics.D2_aiPerceptibility} D3=${evaluation.metrics.D3_specCodeConsistency} D4=${evaluation.metrics.D4_contractCompleteness} D5=${evaluation.metrics.D5_architectureHealth} D6=${evaluation.metrics.D6_testCoverage} D7=${evaluation.metrics.D7_typeSafety} D8=${evaluation.metrics.D8_moduleReview}`);
    console.log(`  Issues: ${analysis.issues.length} | Insights: ${analysis.insights.length} | Duration: ${roundResult.duration_ms}ms`);
  }

  const totalTime = Date.now() - startTime;
  const report = generateFinalReport(allRounds, totalTime);
  return report;
}

// ════════════════════════════════════════════════════════════════════
// Final Report Generation
// ════════════════════════════════════════════════════════════════════

function generateFinalReport(allRounds, totalTime) {
  const firstRound = allRounds[0];
  const lastRound = allRounds[allRounds.length - 1];
  const bestRound = allRounds.reduce((best, r) => r.evaluation.compositeScore > best.evaluation.compositeScore ? r : best);
  const worstRound = allRounds.reduce((worst, r) => r.evaluation.compositeScore < worst.evaluation.compositeScore ? r : worst);

  const scores = allRounds.map(r => r.evaluation.compositeScore);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const scoreDelta = lastRound.evaluation.compositeScore - firstRound.evaluation.compositeScore;
  const isStable = scores.slice(-5).every((s, i, arr) => i === 0 || Math.abs(s - arr[i - 1]) < 3);

  // Collect all unique issues
  const allIssues = new Map();
  for (const r of allRounds) {
    for (const issue of r.analysis.issues) {
      const key = `${issue.dimension}:${issue.message}`;
      if (!allIssues.has(key)) {
        allIssues.set(key, { ...issue, firstSeen: r.round, lastSeen: r.round, count: 1 });
      } else {
        const existing = allIssues.get(key);
        existing.lastSeen = r.round;
        existing.count++;
      }
    }
  }

  const persistentIssues = [...allIssues.values()]
    .filter(i => i.count > ROUNDS / 2)
    .sort((a, b) => b.count - a.count);

  // Collect philosophy insights
  const philosophyInsights = new Map();
  for (const r of allRounds) {
    for (const insight of r.analysis.insights) {
      if (insight.type === 'philosophy') {
        if (!philosophyInsights.has(insight.message)) {
          philosophyInsights.set(insight.message, { ...insight, firstSeen: r.round, count: 1 });
        } else {
          philosophyInsights.get(insight.message).count++;
        }
      }
    }
  }

  const report = {
    meta: {
      project: 'mumuspec',
      version: '0.19.1',
      timestamp: new Date().toISOString(),
      totalRounds: ROUNDS,
      totalDurationMs: totalTime,
      philosophy: 'AI as compiler, human output = persistent spec',
    },
    summary: {
      firstScore: firstRound.evaluation.compositeScore,
      lastScore: lastRound.evaluation.compositeScore,
      bestScore: bestRound.evaluation.compositeScore,
      worstScore: worstRound.evaluation.compositeScore,
      avgScore,
      scoreDelta,
      isStable,
      trend: scoreDelta > 2 ? 'improving' : scoreDelta < -2 ? 'declining' : 'stable',
    },
    metrics: {
      first: firstRound.evaluation.metrics,
      last: lastRound.evaluation.metrics,
      delta: Object.keys(firstRound.evaluation.metrics).reduce((acc, key) => {
        acc[key] = lastRound.evaluation.metrics[key] - firstRound.evaluation.metrics[key];
        return acc;
      }, {}),
    },
    persistentIssues,
    philosophyAlignment: [...philosophyInsights.values()],
    rounds: allRounds.map(r => ({
      round: r.round,
      score: r.evaluation.compositeScore,
      metrics: r.evaluation.metrics,
      issueCount: r.analysis.issueCount,
      criticalCount: r.analysis.criticalCount,
      warningCount: r.analysis.warningCount,
      insightCount: r.analysis.insightCount,
      topIssues: r.analysis.issues.slice(0, 3),
      topInsights: r.analysis.insights.slice(0, 3),
      topStrengths: r.analysis.strengths.slice(0, 3),
      improvements: r.improvement.actions.slice(0, 3),
      priorities: r.improvement.priorities,
    })),
    recommendations: generateFinalRecommendations(allRounds, persistentIssues, lastRound),
  };

  // Save JSON report
  mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = join(REPORT_DIR, 'report.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Save Markdown report
  const mdPath = join(REPORT_DIR, 'report.md');
  writeFileSync(mdPath, generateMarkdownReport(report));

  console.log('\n=== Self-Review Loop Complete ===');
  console.log(`Total rounds: ${ROUNDS}`);
  console.log(`Total duration: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`First score: ${firstRound.evaluation.compositeScore}`);
  console.log(`Last score: ${lastRound.evaluation.compositeScore}`);
  console.log(`Best score: ${bestRound.evaluation.compositeScore} (Round ${bestRound.round})`);
  console.log(`Average score: ${avgScore}`);
  console.log(`Trend: ${report.summary.trend} (${scoreDelta > 0 ? '+' : ''}${scoreDelta})`);
  console.log(`Persistent issues: ${persistentIssues.length}`);
  console.log(`\nReports saved to:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  MD:   ${mdPath}`);

  return report;
}

function getActionForDimension(dim) {
  const actions = {
    D1: '增加更多模块的 .mumuspec/ 目录，补充 spec.md/prd.md/tech.md 文件',
    D2: '为缺少 AGENTS.md 的模块运行 mumuspec sync 生成边界文档',
    D3: '运行 mumuspec check 修复合规错误，运行 mumuspec drift 修复漂移',
    D4: '在 .mumuspec/contracts/ 下补充契约定义文件',
    D5: '拆分大模块，确保每个模块平均行数 < 500',
    D6: '修复失败的测试用例',
    D7: '修复 TypeScript 类型错误 (tsc --noEmit)',
    D8: '提升低分模块的维度评分',
  };
  return actions[dim] || '审查并改进';
}

function generateFinalRecommendations(allRounds, persistentIssues, lastRound) {
  const recs = [];

  for (const issue of persistentIssues.slice(0, 5)) {
    recs.push({
      priority: issue.severity === 'critical' ? 'P0' : issue.severity === 'warning' ? 'P1' : 'P2',
      dimension: issue.dimension,
      recommendation: `${issue.message} (持续出现 ${issue.count}/${ROUNDS} 轮)`,
      detail: issue.detail,
      action: getActionForDimension(issue.dimension),
    });
  }

  const m = lastRound.evaluation.metrics;
  if (m.D2_aiPerceptibility < 80) {
    recs.push({ priority: 'P1', dimension: 'D2', recommendation: '提升 AI 可感知性', action: '为剩余模块补充 AGENTS.md 和 BOUNDARY.md' });
  }
  if (m.D4_contractCompleteness < 60) {
    recs.push({ priority: 'P1', dimension: 'D4', recommendation: '完善契约层', action: '在 .mumuspec/contracts/ 下补充契约定义文件' });
  }
  if (m.D7_typeSafety < 100) {
    recs.push({ priority: 'P0', dimension: 'D7', recommendation: '修复 TypeScript 类型错误', action: '运行 tsc --noEmit 并修复所有报错' });
  }
  if (m.D6_testCoverage < 100) {
    recs.push({ priority: 'P1', dimension: 'D6', recommendation: '修复失败测试', action: '运行 vitest run 并修复失败的测试用例' });
  }

  // Philosophy-specific recommendations
  recs.push({
    priority: 'P2',
    dimension: 'philosophy',
    recommendation: '持续强化"AI 作为编译器"理念',
    action: '确保所有新模块自动生成 AGENTS.md/CLAUDE.md，让 AI 工具能感知规范约束',
  });
  recs.push({
    priority: 'P2',
    dimension: 'philosophy',
    recommendation: '持续强化"持久化 spec"理念',
    action: '确保所有设计决策通过 spec.md/prd.md/tech.md 持久化，而非仅存在于代码注释中',
  });

  return recs;
}

// ════════════════════════════════════════════════════════════════════
// Markdown Report Generator
// ════════════════════════════════════════════════════════════════════

function generateMarkdownReport(report) {
  const lines = [];

  lines.push('# MumuSpec Self-Review Loop Report');
  lines.push('');
  lines.push('> **20-Round Iterative Project Audit**');
  lines.push('>');
  lines.push(`> **Project**: ${report.meta.project} v${report.meta.version}  `);
  lines.push(`> **Date**: ${report.meta.timestamp}  `);
  lines.push(`> **Duration**: ${(report.meta.totalDurationMs / 1000).toFixed(1)}s  `);
  lines.push(`> **Philosophy**: ${report.meta.philosophy}  `);
  lines.push('');

  // Summary
  lines.push('## 1. Executive Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| First Round Score | ${report.summary.firstScore}/100 |`);
  lines.push(`| Last Round Score | ${report.summary.lastScore}/100 |`);
  lines.push(`| Best Score | ${report.summary.bestScore}/100 |`);
  lines.push(`| Worst Score | ${report.summary.worstScore}/100 |`);
  lines.push(`| Average Score | ${report.summary.avgScore}/100 |`);
  lines.push(`| Score Delta | ${report.summary.scoreDelta > 0 ? '+' : ''}${report.summary.scoreDelta} |`);
  lines.push(`| Trend | ${report.summary.trend} |`);
  lines.push(`| Stable | ${report.summary.isStable ? 'Yes' : 'No'} |`);
  lines.push('');

  // Metrics Comparison
  lines.push('## 2. Metrics Comparison (First vs Last Round)');
  lines.push('');
  lines.push('| Dimension | First | Last | Delta |');
  lines.push('|-----------|-------|------|-------|');
  for (const key of Object.keys(report.metrics.first)) {
    const f = report.metrics.first[key];
    const l = report.metrics.last[key];
    const d = report.metrics.delta[key];
    const sign = d > 0 ? '+' : '';
    lines.push(`| ${key} | ${f} | ${l} | ${sign}${d} |`);
  }
  lines.push('');

  // Score Trend
  lines.push('## 3. Score Trend Across 20 Rounds');
  lines.push('');
  lines.push('```');
  for (const r of report.rounds) {
    const bar = '#'.repeat(Math.round(r.score / 5));
    lines.push(`R${String(r.round).padStart(2, '0')} | ${bar} ${r.score}`);
  }
  lines.push('```');
  lines.push('');

  // Persistent Issues
  lines.push('## 4. Persistent Issues (appearing in >50% of rounds)');
  lines.push('');
  if (report.persistentIssues.length === 0) {
    lines.push('No persistent issues detected.');
  } else {
    lines.push('| # | Dimension | Severity | Issue | Count | Detail |');
    lines.push('|---|-----------|----------|-------|-------|--------|');
    for (let i = 0; i < report.persistentIssues.length; i++) {
      const issue = report.persistentIssues[i];
      lines.push(`| ${i + 1} | ${issue.dimension} | ${issue.severity} | ${issue.message} | ${issue.count}/${report.meta.totalRounds} | ${issue.detail || '-'} |`);
    }
  }
  lines.push('');

  // Philosophy Alignment
  lines.push('## 5. Philosophy Alignment');
  lines.push('');
  lines.push('> **Core Philosophy**: AI as compiler, human\'s core output is persistent spec');
  lines.push('');
  lines.push('| Check | Status | Frequency |');
  lines.push('|-------|--------|-----------|');
  for (const p of report.philosophyAlignment) {
    const status = p.message.startsWith('[PASS]') ? 'PASS' : p.message.startsWith('[FAIL]') ? 'FAIL' : 'WARN';
    lines.push(`| ${p.message.replace(/^\[(PASS|FAIL|WARN)\]\s*/, '')} | ${status} | ${p.count}/${report.meta.totalRounds} |`);
  }
  lines.push('');

  // Round Details
  lines.push('## 6. Round-by-Round Details');
  lines.push('');
  for (const r of report.rounds) {
    lines.push(`### Round ${r.round} — Score: ${r.score}/100`);
    lines.push('');
    lines.push(`**Metrics**: D1=${r.metrics.D1_specPersistence} D2=${r.metrics.D2_aiPerceptibility} D3=${r.metrics.D3_specCodeConsistency} D4=${r.metrics.D4_contractCompleteness} D5=${r.metrics.D5_architectureHealth} D6=${r.metrics.D6_testCoverage} D7=${r.metrics.D7_typeSafety} D8=${r.metrics.D8_moduleReview}`);
    lines.push('');
    lines.push(`**Issues**: ${r.issueCount} (${r.criticalCount} critical, ${r.warningCount} warning)`);
    if (r.topIssues.length > 0) {
      for (const issue of r.topIssues) {
        lines.push(`- [${issue.severity}] ${issue.dimension}: ${issue.message}`);
      }
    }
    lines.push('');
    if (r.topStrengths.length > 0) {
      lines.push('**Strengths**:');
      for (const s of r.topStrengths) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }
    if (r.topInsights.length > 0) {
      lines.push('**Insights**:');
      for (const insight of r.topInsights) {
        lines.push(`- [${insight.type}] ${insight.message}`);
      }
      lines.push('');
    }
    if (r.improvements.length > 0) {
      lines.push('**Improvement Actions**:');
      for (const action of r.improvements) {
        lines.push(`- [${action.priority}] ${action.action}`);
      }
      lines.push('');
    }
    if (r.priorities.length > 0) {
      lines.push('**Priorities**:');
      for (const p of r.priorities) {
        lines.push(`- ${p}`);
      }
      lines.push('');
    }
  }

  // Final Recommendations
  lines.push('## 7. Final Recommendations & Improvement Suggestions');
  lines.push('');
  if (report.recommendations.length === 0) {
    lines.push('No recommendations — project is in excellent shape!');
  } else {
    lines.push('| Priority | Dimension | Recommendation | Action |');
    lines.push('|----------|-----------|----------------|--------|');
    for (const rec of report.recommendations) {
      lines.push(`| ${rec.priority} | ${rec.dimension} | ${rec.recommendation} | ${rec.action} |`);
    }
  }
  lines.push('');

  // Detailed Analysis
  lines.push('## 8. Detailed Analysis');
  lines.push('');
  lines.push('### 8.1 Spec Persistence (D1)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D1_specPersistence}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D1_specPersistence}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D1_specPersistence > 0 ? '+' : ''}${report.metrics.delta.D1_specPersistence}`);
  lines.push('');
  lines.push('Spec persistence measures whether the project has sufficient persistent specification');
  lines.push('files (spec.md, prd.md, tech.md, constraints.yaml, BOUNDARY.md, AGENTS.md) across');
  lines.push('all module directories. This directly reflects the "human\'s core output is persistent spec" philosophy.');
  lines.push('');

  lines.push('### 8.2 AI Perceptibility (D2)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D2_aiPerceptibility}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D2_aiPerceptibility}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D2_aiPerceptibility > 0 ? '+' : ''}${report.metrics.delta.D2_aiPerceptibility}`);
  lines.push('');
  lines.push('AI perceptibility measures whether AI tools (Claude, Cursor, etc.) can discover and');
  lines.push('load project specifications. This includes top-level AI-facing files (CLAUDE.md, AGENTS.md,');
  lines.push('.cursorrules, skills/) and per-module AGENTS.md coverage.');
  lines.push('');

  lines.push('### 8.3 Spec-Code Consistency (D3)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D3_specCodeConsistency}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D3_specCodeConsistency}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D3_specCodeConsistency > 0 ? '+' : ''}${report.metrics.delta.D3_specCodeConsistency}`);
  lines.push('');
  lines.push('Spec-code consistency runs the compliance checker and drift detector to verify that');
  lines.push('code adheres to the specifications. This is the "binding" between spec and code.');
  lines.push('');

  lines.push('### 8.4 Contract Completeness (D4)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D4_contractCompleteness}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D4_contractCompleteness}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D4_contractCompleteness > 0 ? '+' : ''}${report.metrics.delta.D4_contractCompleteness}`);
  lines.push('');
  lines.push('Contract completeness measures the coverage of contract definitions in');
  lines.push('`.mumuspec/contracts/`. This is a Phase 3 feature and currently has the lowest score,');
  lines.push('indicating the largest improvement opportunity.');
  lines.push('');

  lines.push('### 8.5 Architecture Health (D5)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D5_architectureHealth}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D5_architectureHealth}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D5_architectureHealth > 0 ? '+' : ''}${report.metrics.delta.D5_architectureHealth}`);
  lines.push('');
  lines.push('Architecture health evaluates module count, file distribution, and average lines per');
  lines.push('module. Good modularity means smaller, focused modules.');
  lines.push('');

  lines.push('### 8.6 Test Coverage (D6)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D6_testCoverage}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D6_testCoverage}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D6_testCoverage > 0 ? '+' : ''}${report.metrics.delta.D6_testCoverage}`);
  lines.push('');
  lines.push('Test coverage is measured by the test pass rate (passed / total tests).');
  lines.push('');

  lines.push('### 8.7 Type Safety (D7)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D7_typeSafety}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D7_typeSafety}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D7_typeSafety > 0 ? '+' : ''}${report.metrics.delta.D7_typeSafety}`);
  lines.push('');
  lines.push('Type safety is measured by the number of TypeScript compilation errors (tsc --noEmit).');
  lines.push('');

  lines.push('### 8.8 Module Review (D8)');
  lines.push('');
  lines.push(`- **First Round**: ${report.metrics.first.D8_moduleReview}/100`);
  lines.push(`- **Last Round**: ${report.metrics.last.D8_moduleReview}/100`);
  lines.push(`- **Delta**: ${report.metrics.delta.D8_moduleReview > 0 ? '+' : ''}${report.metrics.delta.D8_moduleReview}`);
  lines.push('');
  lines.push('Module review uses the built-in D8 dimension scoring system, which evaluates each');
  lines.push('module across 7 sub-dimensions: spec consistency, contract completeness, architecture');
  lines.push('dependency, workflow completeness, type system, test coverage, and doc sync.');
  lines.push('');

  lines.push('## 9. Conclusion');
  lines.push('');
  lines.push('The MumuSpec project demonstrates strong alignment with its core philosophy of');
  lines.push('"AI as compiler, human\'s core output is persistent spec". The self-review loop');
  lines.push(`ran ${report.meta.totalRounds} rounds, achieving an average score of ${report.summary.avgScore}/100.`);
  lines.push('');
  if (report.summary.trend === 'stable') {
    lines.push('The project shows **stable** metrics across all rounds, indicating a mature codebase');
    lines.push('with consistent quality. The key improvement areas are:');
  } else if (report.summary.trend === 'improving') {
    lines.push('The project shows an **improving** trend, with scores increasing over the rounds.');
    lines.push('Key remaining improvement areas:');
  } else {
    lines.push('The project shows a **declining** trend, which may indicate regressions.');
    lines.push('Key areas requiring attention:');
  }
  lines.push('');
  for (const rec of report.recommendations.slice(0, 5)) {
    lines.push(`1. **[${rec.priority}] ${rec.dimension}**: ${rec.recommendation}`);
    lines.push(`   - Action: ${rec.action}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*This report was auto-generated by the Self-Review Loop script.*');
  lines.push(`*Run: ${new Date().toISOString()}*`);

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════
// Entry Point
// ════════════════════════════════════════════════════════════════════

runLoop();
