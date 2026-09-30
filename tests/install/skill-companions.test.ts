/**
 * Companion registry — the engine-consumer distinction (core-consolidation V6).
 *
 * Before this, 28 companions were advertised as required while none was read by
 * any gate. The registry now separates "the engine looks at this one" from "this
 * is an environment fact report for the agent", and that split is what the tests
 * lock — availability probing itself is filesystem-dependent by design.
 */
import { describe, it, expect } from 'vitest';

import {
  COMPANIONS,
  SECURITY_COMPANION,
  WIRED_COMPANIONS,
  resolveCompanions,
} from '../../src/install/skill-companions.js';

describe('companion wiring', () => {
  it('wires exactly the companion the coverage gate reads', () => {
    expect([...WIRED_COMPANIONS]).toEqual([SECURITY_COMPANION]);
    expect(COMPANIONS.some((c) => c.name === SECURITY_COMPANION)).toBe(true);
  });

  it('reports the flag per entry without consulting the filesystem for it', () => {
    const rows = resolveCompanions();
    expect(rows.filter((r) => r.wired).map((r) => r.name)).toEqual([SECURITY_COMPANION]);
    expect(rows).toHaveLength(COMPANIONS.length);
  });
});
