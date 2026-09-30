/**
 * Drafting input slot (core-consolidation L1, R-0014).
 *
 * Locks TC-L1-004: `--request` stores the author's terse words verbatim so the
 * coverage gate has something mechanical to compare against. Absent the option,
 * no slot is written and change creation behaves exactly as before — the
 * compatibility surface must not move.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../src/core/config.js';
import { createChange } from '../../src/change/lifecycle.js';

const REQUEST = '做一个支付退款接口，要求幂等，别把卡号明文返回';

function scratchRoot(label: string): string {
  const root = join(tmpdir(), `mumu-request-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  // Empty config file → loadConfig falls back to defaults; keeps the probe honest
  // about what an unconfigured project does.
  writeFileSync(join(root, '.mumuspec', 'config.yaml'), '');
  return root;
}

function slotPath(root: string): string {
  return join(root, '.mumuspec', 'changes', 'probe-change', 'request.md');
}

describe('request.md drafting slot', () => {
  it('stores the request byte-for-byte, with no derived content', () => {
    const root = scratchRoot('with');
    try {
      createChange(root, 'probe-change', 'hotfix', loadConfig(root), [], '.', { requestText: REQUEST });
      expect(readFileSync(slotPath(root), 'utf-8')).toBe(REQUEST);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes nothing when no request is supplied', () => {
    const root = scratchRoot('without');
    try {
      createChange(root, 'probe-change', 'hotfix', loadConfig(root), [], '.');
      expect(existsSync(slotPath(root))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats an empty request as a deliberate empty slot, not as absence', () => {
    const root = scratchRoot('empty');
    try {
      createChange(root, 'probe-change', 'hotfix', loadConfig(root), [], '.', { requestText: '' });
      expect(existsSync(slotPath(root))).toBe(true);
      expect(readFileSync(slotPath(root), 'utf-8')).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
