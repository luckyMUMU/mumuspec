/**
 * Delta constraint channel gate (delta-channel-gate, 2026-09-13).
 *
 * Constraints carried by a change (constraints/ + delta-specs/) flow into the
 * main spec at archive time. This module verifies — BEFORE the verify phase —
 * that every carried item has a verification channel, closing the gap between
 * E-SPEC-015 (main-spec side) and the change-artifact side: an unchanneled
 * constraint must not silently pass verify and enter the enforced surface.
 *
 * Channel semantics mirror verifier-classify (R1 ast: > R2 lexical > R3
 * declared manual), minus the annotation channel: change artifacts carry no
 * prohibitions frontmatter, so annotations are always empty here.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRegexCheckable } from '../spec/verifier-classify.js';

export interface UnchanneledItem {
  /** Path relative to the change directory. */
  file: string;
  requirement: string;
  polarity: 'shall' | 'shall-not';
  text: string;
  /** Human-readable gap description. */
  reason: string;
}

/** Constraint-bearing subdirectories (same scope as findCarriedSpecArtifacts). */
const CONSTRAINT_DIRS = ['constraints', 'delta-specs'] as const;

/** Extract `- SHALL:` / `- SHALL NOT` item lines (both writing forms). */
const SHALL_NOT_RE = /^- SHALL NOT[: ]?\s*(.+)$/;
const SHALL_RE = /^- SHALL[: ]?\s*(?!NOT)(.+)$/;

/** One parsed constraint block: requirement name + items + channel state. */
interface ParsedBlock {
  requirement: string;
  hasEnforcement: boolean;
  items: { polarity: 'shall' | 'shall-not'; text: string }[];
}

function parseConstraintFile(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock | null = null;

  for (const raw of content.split('\n')) {
    const trimmed = raw.trim();
    // Fenced code blocks: documented examples are not live items.
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      current = null;
      continue;
    }
    const hm = /^##\s+Requirement:\s*(.+)$/.exec(trimmed);
    if (hm) {
      current = { requirement: hm[1].trim(), hasEnforcement: false, items: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    if (/^Enforcement:/.test(trimmed)) current.hasEnforcement = true;
    const sn = SHALL_NOT_RE.exec(trimmed);
    if (sn) {
      current.items.push({ polarity: 'shall-not', text: sn[1].trim() });
      continue;
    }
    const sh = SHALL_RE.exec(trimmed);
    if (sh) {
      current.items.push({ polarity: 'shall', text: sh[1].trim() });
    }
  }
  return blocks;
}

function classifyBlockItem(
  block: ParsedBlock,
  item: { polarity: 'shall' | 'shall-not'; text: string },
): string | null {
  if (block.hasEnforcement) return null; // declared manual channel
  if (item.text.startsWith('ast:')) return null; // R1 AST channel
  if (item.polarity === 'shall-not' && isRegexCheckable(item.text)) return null; // R2 lexical
  return item.polarity === 'shall'
    ? 'SHALL 无自动验证通道且块内无 Enforcement 声明'
    : 'SHALL NOT 无词法锚点、ast: 前缀且块内无 Enforcement 声明';
}

/** Collect carried constraint items lacking any verification channel. */
export function collectUnchanneledDeltaConstraints(changeDir: string): UnchanneledItem[] {
  const out: UnchanneledItem[] = [];
  for (const sub of CONSTRAINT_DIRS) {
    const dir = join(changeDir, sub);
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // unreadable dir is archive's concern, not the channel gate's
    }
    for (const file of entries) {
      if (!file.endsWith('.md')) continue;
      const rel = `${sub}/${file}`;
      let content: string;
      try {
        content = readFileSync(join(dir, file), 'utf8');
      } catch {
        continue;
      }
      if (!content.trim()) continue;
      for (const block of parseConstraintFile(content)) {
        for (const item of block.items) {
          const reason = classifyBlockItem(block, item);
          if (reason) {
            out.push({
              file: rel,
              requirement: block.requirement,
              polarity: item.polarity,
              text: item.text,
              reason,
            });
          }
        }
      }
    }
  }
  return out;
}
