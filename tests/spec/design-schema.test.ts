/**
 * Design schema contract (core-consolidation L1, R-0014).
 *
 * Locks TC-L1-002 / TC-L1-003 at the schema boundary: the security & privacy
 * section is required for the full workflow and must be recognised by both the
 * Chinese and the English heading form. hotfix/tweak stay untouched — the gate
 * must not narrow process freedom for small changes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

interface SchemaSection {
  name: string;
  patterns: string[];
  required_for: string[];
}

const schemaPath = join(process.cwd(), 'templates', 'design-schema.yaml');
const schema = parse(readFileSync(schemaPath, 'utf-8')) as { sections: SchemaSection[] };

function section(name: string): SchemaSection {
  const found = schema.sections.find((s) => s.name === name);
  if (!found) throw new Error(`schema section missing: ${name}`);
  return found;
}

function matches(sectionName: string, heading: string): boolean {
  const s = section(sectionName);
  return s.patterns.some((p) => new RegExp(p, 'im').test(heading));
}

describe('design-schema Security & Privacy section', () => {
  it('exists and is required for full only', () => {
    const s = section('Security & Privacy');
    expect(s.required_for).toContain('full');
    expect(s.required_for).not.toContain('hotfix');
    expect(s.required_for).not.toContain('tweak');
  });

  it('recognises both heading languages', () => {
    expect(matches('Security & Privacy', '## 安全与隐私')).toBe(true);
    expect(matches('Security & Privacy', '## Security & Privacy')).toBe(true);
  });

  it('does not accept an unrelated heading', () => {
    expect(matches('Security & Privacy', '## Risk Mitigation')).toBe(false);
    expect(matches('Security & Privacy', '## 数据流')).toBe(false);
  });

  it('every section required for full is also required by at most one workflow family', () => {
    // guard against a section silently dropping out of the full profile
    const fullRequired = schema.sections.filter((s) => s.required_for.includes('full'));
    expect(fullRequired.map((s) => s.name).sort()).toEqual([
      'API Contracts',
      'Architecture Overview',
      'Constraints Analysis',
      'Data Flow',
      'Error Specification',
      'Implementation Layers',
      'Risk Mitigation',
      'Security & Privacy',
      'Test Strategy',
    ]);
  });

  it('each section declares at least one pattern', () => {
    for (const s of schema.sections) {
      expect(s.patterns.length, s.name).toBeGreaterThan(0);
    }
  });
});
