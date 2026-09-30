/**
 * cognitive-map command — Cognitive framework (Q1-Q4) management.
 *
 * Subcommands:
 *   mumuspec cognitive-map <name>          Show cognitive-map status
 *   mumuspec cognitive-map init <name>     Initialize cognitive-map.yaml from template
 *   mumuspec cognitive-map sync <name>     Recompute state.cognitive_framework from yaml entries
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, readText, readYaml, writeText } from '../../core/utils.js';
import {
  DEFAULT_MIN_DISTINCT_ASPECTS,
  classifyAspects,
  isAspectCoverageConverged,
} from '../../spec/aspects.js';
import { getChangeDir, loadChangeState, saveChangeState } from '../../change/manager.js';

interface CognitiveMapEntry {
  quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  category?: string;
  question?: string;
  answer?: string;
  confidence?: string;
  source?: string;
  status?: string;
  options?: string[];
}

interface CognitiveMapFile {
  entries?: CognitiveMapEntry[];
}

/**
 * q4_min_dimensions comes from the project config, read through the same
 * mocked-safe utils as the rest of this command (loadConfig touches real fs,
 * which the CLI handler tests deliberately keep out of the mock surface).
 */
function readMinDistinctAspects(root: string): number {
  const configPath = join(root, '.mumuspec', 'config.yaml');
  if (!existsSync(configPath)) return DEFAULT_MIN_DISTINCT_ASPECTS;
  const parsed = readYaml<Record<string, unknown>>(configPath);
  const framework = parsed?.cognitive_framework as Record<string, unknown> | undefined;
  const value = Number(framework?.q4_min_dimensions);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MIN_DISTINCT_ASPECTS;
}
/** Locate a cognitive-map template (projectRoot/templates or .mumuspec/templates) */
function findTemplatePath(projectRoot: string): string | undefined {
  const candidates = [
    join(projectRoot, 'templates', 'cognitive-map-template.yaml'),
    join(projectRoot, '.mumuspec', 'templates', 'cognitive-map-template.yaml'),
  ];
  return candidates.find((p) => existsSync(p));
}

/** Read and parse a change's cognitive-map.yaml (empty entries if absent) */
function loadCognitiveMap(changeDir: string): { file: CognitiveMapFile; exists: boolean } {
  const path = join(changeDir, 'cognitive-map.yaml');
  if (!existsSync(path)) return { file: { entries: [] }, exists: false };
  return { file: readYaml<CognitiveMapFile>(path) ?? { entries: [] }, exists: true };
}

export function registerCognitiveMapCommands(program: Command): void {
  const cmd = program
    .command('cognitive-map')
    .description('Cognitive framework (Q1-Q4) management');

  cmd
    .command('show')
    .description('Show cognitive-map status for a change')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      const changeDir = getChangeDir(root, name);
      const { file, exists } = loadCognitiveMap(changeDir);
      const entries = file.entries ?? [];

      const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
      for (const e of entries) {
        if (counts[e.quadrant] !== undefined) counts[e.quadrant]++;
      }

      console.log(`\nCognitive Map: ${name}`);
      console.log(`  File: ${exists ? 'cognitive-map.yaml ✓' : 'cognitive-map.yaml 不存在'}`);
      console.log(`  Q1 已知的已知:  ${counts.Q1}`);
      console.log(`  Q2 已知的未知:  ${counts.Q2}`);
      console.log(`  Q3 推理推导:    ${counts.Q3}`);
      console.log(`  Q4 盲区扫描:    ${counts.Q4}`);

      const cf = state.cognitive_framework;
      if (cf) {
        console.log(`\n  状态机字段 (.mumuspec.yaml):`);
        console.log(`  enabled:            ${cf.enabled}`);
        console.log(`  q1_count:           ${cf.q1_count}`);
        console.log(`  q2_pending:         ${cf.q2_pending}`);
        console.log(`  q3_pending:         ${cf.q3_pending}`);
        console.log(`  q4_scans_completed: ${cf.q4_scans_completed}`);
        console.log(`  converged:          ${cf.converged}`);
        console.log(`  rounds_completed:   ${cf.rounds_completed}`);
        console.log(`\n  提示: 'mumuspec cognitive-map sync ${name}' 可从 yaml 重新计算这些字段`);
      } else {
        console.log('\n  (状态机无 cognitive_framework 字段 — 运行 sync 初始化)');
      }
    });

  cmd
    .command('init')
    .description('Initialize cognitive-map.yaml from template')
    .argument('<name>', 'change name')
    .option('--force', 'overwrite existing cognitive-map.yaml')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      if (!loadChangeState(root, name)) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      const changeDir = getChangeDir(root, name);
      const target = join(changeDir, 'cognitive-map.yaml');
      if (existsSync(target) && !options.force) {
        console.error(`✗ ${target} 已存在 (使用 --force 覆盖)`);
        process.exit(1);
      }

      const template = findTemplatePath(root);
      if (template) {
        writeText(target, readText(template) ?? '');
        console.log(`✓ cognitive-map.yaml 已从模板初始化 (${template})`);
      } else {
        writeText(
          target,
          `# Cognitive Map — 乔哈里窗变体
# 格式规范: quadrant/category/question/answer/confidence/source
entries:
  - quadrant: Q1
    category: known-known
    question: "【填写】已知的确定事实？"
    answer: "【填写】答案"
    confidence: high
    source: "【填写】来源"
`,
        );
        console.log('✓ cognitive-map.yaml 已初始化 (内置最小模板)');
      }
      console.log('  下一步: mumuspec cognitive-map sync <name> 同步状态机字段');
    });

  cmd
    .command('sync')
    .description('Recompute state.cognitive_framework from cognitive-map.yaml entries')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      const changeDir = getChangeDir(root, name);
      const { file, exists } = loadCognitiveMap(changeDir);
      const entries = file.entries ?? [];
      if (!exists || entries.length === 0) {
        console.error(`✗ cognitive-map.yaml 不存在或为空: ${join(changeDir, 'cognitive-map.yaml')}`);
        console.error('  先运行: mumuspec cognitive-map init <name>');
        process.exit(1);
      }

      const q1Count = entries.filter((e) => e.quadrant === 'Q1').length;
      const q2Pending = entries.filter(
        (e) => e.quadrant === 'Q2' && (!e.answer || e.answer.includes('【填写】')),
      ).length;
      const q3Pending = entries.filter(
        (e) => e.quadrant === 'Q3' && e.status !== 'confirmed',
      ).length;
      const minDistinct = readMinDistinctAspects(root);
      const coverage = classifyAspects(entries);
      const q4Scans = coverage.rows;
      const converged =
        q2Pending === 0 && q3Pending === 0 && isAspectCoverageConverged(coverage, { minDistinct });

      const cf = state.cognitive_framework ?? {
        enabled: true,
        q1_count: 0,
        q2_pending: 0,
        q3_pending: 0,
        q4_scans_completed: 0,
        converged: false,
        rounds_completed: 0,
      };
      cf.enabled = true;
      cf.cognitive_map_ref = 'cognitive-map.yaml';
      cf.q1_count = q1Count;
      cf.q2_pending = q2Pending;
      cf.q3_pending = q3Pending;
      cf.q4_scans_completed = q4Scans;
      cf.q4_aspects_covered = coverage.distinct;
      cf.q4_aspects_missing = coverage.missingRequired;
      cf.converged = converged;
      state.cognitive_framework = cf;
      state.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      saveChangeState(root, name, state);

      console.log(`✓ cognitive_framework 已同步: ${name}`);
      console.log(`  q1_count: ${q1Count}, q2_pending: ${q2Pending}, q3_pending: ${q3Pending}, q4_scans: ${q4Scans}`);
      console.log(`  q4_aspects: ${coverage.distinct.join(', ') || '(none)'}`);
      if (coverage.missingRequired.length > 0) {
        console.warn(`  缺失必需覆盖维度: ${coverage.missingRequired.join(', ')}`);
      }
      if (coverage.unknown.length > 0) {
        console.warn(`  未登记的维度标签（不计入覆盖）: ${coverage.unknown.join(', ')}`);
      }
      console.log(`  converged: ${converged}`);
      if (!converged) {
        console.warn(
          `  提示: 认知地图未收敛 — 需 ${minDistinct} 个不同覆盖维度且必需维度齐备（行数为 ${q4Scans} 不构成覆盖）`,
        );
      }
    });
}
