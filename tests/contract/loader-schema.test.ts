/**
 * Contract registry schema validation tests (Phase 2.4).
 *
 * Dirty registry data must be rejected with E-CONTRACT-011 instead of
 * silently skipped or crashing downstream (find/includes on undefined).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContractRegistry } from '../../src/contract/loader.js';
import { MumuSpecError } from '../../src/core/errors.js';

let base: string;

function makeRegistryDir(name: string, content: string, ext: 'json' | 'yaml' = 'json'): string {
  const dir = join(base, name, '.mumuspec', 'contracts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `contracts.${ext}`), content);
  return join(base, name, '.mumuspec', 'contracts');
}

const VALID_REGISTRY = JSON.stringify({
  version: '1.0.0',
  last_updated: '2026-09-06T00:00:00.000Z',
  contracts: [
    {
      id: 'API-001',
      name: 'Users API',
      category: 'api',
      status: 'active',
      criticality: 'high',
      version: '1.0.0',
      source: 'src/api/users.ts',
      description: 'User endpoints',
      upstream: [],
      downstream: [],
      schema: {},
    },
  ],
  dependency_graph: {},
  outbound_ids: ['API-001'],
  inbound_ids: [],
});

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'mumu-contract-schema-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('loadContractRegistry — schema validation', () => {
  it('accepts a structurally valid registry', () => {
    const dir = makeRegistryDir('valid', VALID_REGISTRY);
    const reg = loadContractRegistry(dir);
    expect(reg).not.toBeNull();
    expect(reg!.contracts).toHaveLength(1);
    expect(reg!.outbound_ids).toEqual(['API-001']);
  });

  it('tolerates legacy hand-maintained contracts with extra/missing optional fields', () => {
    const legacy = JSON.stringify({
      version: '1.0.0',
      contracts: [{ id: 'API-002' }],
      outbound_ids: [],
      inbound_ids: [],
    });
    const dir = makeRegistryDir('legacy', legacy);
    const reg = loadContractRegistry(dir);
    expect(reg).not.toBeNull();
    expect(reg!.contracts[0].id).toBe('API-002');
  });

  it('rejects non-object root', () => {
    const dir = makeRegistryDir('array-root', '[1,2,3]');
    expect(() => loadContractRegistry(dir)).toThrow(MumuSpecError);
  });

  it('rejects missing contracts array', () => {
    const dir = makeRegistryDir('no-contracts', JSON.stringify({ version: '1.0.0', outbound_ids: [], inbound_ids: [] }));
    expect(() => loadContractRegistry(dir)).toThrow(MumuSpecError);
  });

  it('rejects contract entries without string id', () => {
    const dirty = JSON.stringify({
      version: '1.0.0',
      contracts: [{ name: 'no id here' }],
      outbound_ids: [],
      inbound_ids: [],
    });
    const dir = makeRegistryDir('no-id', dirty);
    expect(() => loadContractRegistry(dir)).toThrow(MumuSpecError);
  });

  it('rejects non-array outbound_ids', () => {
    const dirty = JSON.stringify({ version: '1.0.0', contracts: [], outbound_ids: 'API-001', inbound_ids: [] });
    const dir = makeRegistryDir('bad-outbound', dirty);
    expect(() => loadContractRegistry(dir)).toThrow(MumuSpecError);
  });

  it('rejects JSON with __proto__ pollution keys', () => {
    const dirty = `{"version":"1.0.0","contracts":[],"outbound_ids":[],"inbound_ids":[],"__proto__":{"polluted":true}}`;
    const dir = makeRegistryDir('proto-json', dirty);
    try {
      loadContractRegistry(dir);
      expect.unreachable();
    } catch (e) {
      expect((e as MumuSpecError).code).toBe('E-CONTRACT-011');
    }
  });

  it('rejects YAML with __proto__ keys', () => {
    const dirty = [
      'version: "1.0.0"',
      'contracts: []',
      'outbound_ids: []',
      'inbound_ids: []',
      '__proto__:',
      '  polluted: true',
    ].join('\n');
    const dir = makeRegistryDir('proto-yaml', dirty, 'yaml');
    expect(() => loadContractRegistry(dir)).toThrow(MumuSpecError);
  });

  it('rejects nested pollution keys inside contracts', () => {
    const dirty = JSON.stringify({
      version: '1.0.0',
      contracts: [{ id: 'X', constructor: {} }],
      outbound_ids: [],
      inbound_ids: [],
    });
    const dir = makeRegistryDir('proto-nested', dirty);
    expect(() => loadContractRegistry(dir)).toThrow(MumuSpecError);
  });

  it('error context names the offending file', () => {
    const dirty = JSON.stringify({ version: 42 });
    const dir = makeRegistryDir('ctx', dirty);
    try {
      loadContractRegistry(dir);
      expect.unreachable();
    } catch (e) {
      expect((e as MumuSpecError).context?.filePath).toContain('contracts.json');
    }
  });
});
