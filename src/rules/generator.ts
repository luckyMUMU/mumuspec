/**
 * Rules generation orchestrator (CHG-3 + goal-p0-dispatch-gate C2/C3/D1/D2).
 *
 * goal-p0-dispatch-gate: content rendering and three-state conflict decisions
 * are delegated to src/install/rules-generator.ts (single source of truth for
 * both). This module is the glue: config/specContext → RuleGenContext → plans
 * → disk writes + agents-hash.json (AGENTS.md ↔ spec drift detection).
 *
 * C3 (D2): `.cursorrules` / `.windsurfrules` are NEVER generated — hard-filtered
 * even when present in a legacy `config.ai.rules_files`. 停止生成 ≠ 删除存量.
 * C2 (D1): CLAUDE.md / GEMINI.md are thin-shell bridges (first line @AGENTS.md);
 * user-owned files are skipped with a diagnostic (`--force-rules` takeover lives
 * on the install path).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MumuSpecConfig } from '../core/config.js';
import type { SpecContext } from '../core/types.js';
import { writeText, readText, getMumuSpecDir, now } from '../core/utils.js';
import { computeSpecHash } from '../guard/checker.js';
import {
  buildRuleGenContext,
  decideAction,
  renderCanonicalRules,
  renderBridgeFile,
} from '../install/rules-generator.js';

/** C3/D2 — legacy rule files are never generated */
export const LEGACY_RULE_FILES = ['.cursorrules', '.windsurfrules'];

/** Files rendered as thin-shell bridges (first line @AGENTS.md) */
const BRIDGE_FILES = new Set(['CLAUDE.md', 'GEMINI.md']);

export interface SkippedRuleFile {
  path: string;
  diagnostic?: string;
}

export interface GenerateRulesResult {
  written: string[];
  skipped: SkippedRuleFile[];
}

/** Generate AI Rules files (AGENTS.md canonical + thin-shell bridges) */
export function generateRulesFiles(
  projectRoot: string,
  config: MumuSpecConfig,
  specContext?: SpecContext,
): GenerateRulesResult {
  const legacyFiltered = config.ai.rules_files.filter((f) => !LEGACY_RULE_FILES.includes(f));
  const ctx = buildRuleGenContext(config, specContext);
  const written: string[] = [];
  const skipped: SkippedRuleFile[] = [];

  for (const rulesFile of legacyFiltered) {
    const content = BRIDGE_FILES.has(rulesFile)
      ? renderBridgeFile('@AGENTS.md')
      : renderCanonicalRules(ctx);
    const filePath = join(projectRoot, rulesFile);
    const current = existsSync(filePath) ? readText(filePath) : undefined;
    const { action, diagnostic } = decideAction(rulesFile, current, false);
    if (action === 'skip') {
      skipped.push({ path: filePath, diagnostic });
      continue;
    }
    writeText(filePath, content);
    written.push(filePath);
  }

  // CHG-3: 生成 spec 内容 hash（供 detectAgentsDrift 校验 AGENTS.md↔spec 漂移）
  try {
    const hashData = {
      version: 1,
      generatedAt: now(),
      specHash: computeSpecHash(projectRoot),
      rulesFiles: written,
    };
    writeText(
      join(getMumuSpecDir(projectRoot), 'agents-hash.json'),
      JSON.stringify(hashData, null, 2) + '\n',
    );
  } catch {
    // Best-effort: hash 写入失败不阻断 rules 生成
  }

  return { written, skipped };
}
