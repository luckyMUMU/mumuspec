/**
 * Schema migration framework tests.
 * Covers: legacy stamping, idempotency, future-version rejection,
 * backup creation, purity (no input mutation), and error propagation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  migrateSchema,
  resolveMigrationChain,
  cmpVersion,
} from '../../src/core/migrations.js';
import { CURRENT_SCHEMA_VERSION, LEGACY_VERSION } from '../../src/core/schema-version.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mumuspec-migration-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('cmpVersion', () => {
  it('orders semver strings numerically', () => {
    expect(cmpVersion('1.0.0', '0.0.0')).toBeGreaterThan(0);
    expect(cmpVersion('0.0.0', '1.0.0')).toBeLessThan(0);
    expect(cmpVersion('1.0.0', '1.0.0')).toBe(0);
    expect(cmpVersion('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(cmpVersion('1.0', '1.0.0')).toBe(0);
  });
});

describe('resolveMigrationChain', () => {
  it('returns the legacy stamp chain', () => {
    const chain = resolveMigrationChain('changeState', LEGACY_VERSION);
    expect(chain).toHaveLength(1);
    expect(chain[0].to).toBe('1.0.0');
  });

  it('returns empty chain when already current', () => {
    expect(resolveMigrationChain('config', CURRENT_SCHEMA_VERSION.config)).toHaveLength(0);
  });

  it('throws when no path exists from a below-floor version', () => {
    expect(() => resolveMigrationChain('changeState', '0.5.0')).toThrow(/No migration path/);
  });
});

describe('migrateSchema — changeState', () => {
  it('stamps schema_version on legacy data', () => {
    const raw = { name: 'x', phase: 'open' };
    const result = migrateSchema<{ name: string; schema_version?: string }>(
      'changeState',
      raw,
      { filePath: join(dir, 'state.yaml') },
    );
    expect(result.data.schema_version).toBe('1.0.0');
    expect(result.applied).toHaveLength(1);
    expect(result.version).toBe('1.0.0');
  });

  it('is a no-op for data already at the current version', () => {
    const raw = { name: 'x', schema_version: CURRENT_SCHEMA_VERSION.changeState };
    const result = migrateSchema('changeState', raw, { filePath: join(dir, 'state.yaml') });
    expect(result.applied).toHaveLength(0);
    expect(result.backupPath).toBeUndefined();
  });

  it('rejects versions higher than supported', () => {
    expect(() =>
      migrateSchema('changeState', { schema_version: '9.9.9' }, { filePath: 'x.yaml' }),
    ).toThrow(/higher than the supported/);
  });

  it('does not mutate the input object (pure migrations)', () => {
    const raw = { name: 'x' };
    migrateSchema('changeState', raw, { filePath: join(dir, 'state.yaml') });
    expect(raw).not.toHaveProperty('schema_version');
  });

  it('round-trips: migrating twice yields deep-equal results', () => {
    const raw = { name: 'x', phase: 'build' };
    const a = migrateSchema('changeState', raw, { filePath: 'f' });
    const b = migrateSchema('changeState', a.data, { filePath: 'f' });
    expect(b.data).toEqual(a.data);
    expect(b.applied).toHaveLength(0);
  });
});

describe('migrateSchema — backup', () => {
  it('writes a backup before migrating an existing file', () => {
    const file = join(dir, 'state.yaml');
    const backupDir = join(dir, 'backups');
    writeFileSync(file, 'name: x\n', 'utf8');

    const result = migrateSchema('changeState', { name: 'x' }, { filePath: file, backupDir });

    expect(result.backupPath).toBeDefined();
    expect(existsSync(result.backupPath!)).toBe(true);
    expect(readFileSync(result.backupPath!, 'utf8')).toBe('name: x\n');
  });

  it('creates no backup when no migration runs', () => {
    const file = join(dir, 'state.yaml');
    writeFileSync(file, 'name: x\n', 'utf8');
    const result = migrateSchema('changeState', { name: 'x', schema_version: '1.0.0' }, {
      filePath: file,
      backupDir: join(dir, 'backups'),
    });
    expect(result.backupPath).toBeUndefined();
    expect(existsSync(join(dir, 'backups'))).toBe(false);
  });
});

describe('migrateSchema — config and contractRegistry', () => {
  it('stamps config regardless of its legacy `version` field', () => {
    const raw = { version: '0.1.0', project: { name: 'p' } };
    const result = migrateSchema('config', raw, { filePath: 'config.yaml' });
    expect(result.data.schema_version).toBe('1.0.0');
    expect(result.data.version).toBe('0.1.0');
  });

  it('stamps contractRegistry', () => {
    const result = migrateSchema('contractRegistry', { contracts: [] }, { filePath: 'contracts.json' });
    expect(result.data.schema_version).toBe('1.0.0');
  });
});
