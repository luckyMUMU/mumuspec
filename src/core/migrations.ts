/**
 * Schema migration framework — pure-function migrations between versions.
 *
 * Read path contract: parse YAML/JSON → migrateSchema() → validate → use.
 * Migration runs BEFORE schema validation so legacy data is normalized
 * first instead of being rejected by newer shapes.
 *
 * Behavior:
 * - No `schema_version` field → treated as LEGACY_VERSION, full chain runs.
 * - Version higher than supported → hard error (never silently down-read).
 * - Backup written before any migration is applied.
 * - Idempotent: data at the current version returns untouched (no backup).
 * - Migrations are pure functions; a throwing migration propagates the
 *   error — half-migrated state must never be returned.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_VERSION,
  SCHEMA_KINDS,
} from './schema-version.js';
import type { SchemaKind } from './schema-version.js';

export interface Migration {
  kind: SchemaKind;
  from: string;
  to: string;
  description: string;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Registry of all migrations, sorted by kind then from-version.
 *
 * v1 note: all persisted data in the wild is pre-versioning (no
 * schema_version field), so the only chain needed is 0.0.0 → 1.0.0,
 * which stamps the field without shape changes (v1 readers tolerate
 * missing optional fields). Later versions append new entries here.
 */
const MIGRATIONS: Migration[] = SCHEMA_KINDS.map((kind) => ({
  kind,
  from: LEGACY_VERSION,
  to: '1.0.0',
  description: `stamp schema_version 1.0.0 on ${kind}`,
  migrate(data) {
    return { ...data, schema_version: '1.0.0' };
  },
}));

/** Compare dot-separated numeric version strings. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Shortest (greedy) migration chain from `fromV` up to CURRENT for kind. */
export function resolveMigrationChain(kind: SchemaKind, fromV: string): Migration[] {
  const target = CURRENT_SCHEMA_VERSION[kind];
  const chain: Migration[] = [];
  let cur = fromV;
  while (cmpVersion(cur, target) < 0) {
    const candidates = MIGRATIONS.filter(
      (m) => m.kind === kind && cmpVersion(m.from, cur) === 0,
    );
    const next = candidates.sort((a, b) => cmpVersion(b.to, a.to))[0];
    if (!next || cmpVersion(next.to, cur) <= 0) {
      throw new Error(
        `No migration path for ${kind} from ${cur} to ${target} ` +
          `(data version ${fromV}). Please upgrade mumuspec.`,
      );
    }
    chain.push(next);
    cur = next.to;
  }
  return chain;
}

/** Pull the schema version out of raw persisted data. */
function extractVersion(raw: unknown): string {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const v = (raw as Record<string, unknown>)['schema_version'];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return LEGACY_VERSION;
}

export interface MigrationOptions {
  /** Absolute path of the source file (used in error messages). */
  filePath: string;
  /** When set and a migration actually runs, the source file is copied here first. */
  backupDir?: string;
}

export interface MigrationResult<T> {
  data: T;
  version: string;
  /** Human-readable list of applied migrations; empty when no-op. */
  applied: string[];
  backupPath?: string;
}

function backupFile(filePath: string, backupDir: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(backupDir, `${basename(filePath)}.pre-migration-${stamp}`);
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(dest, readFileSync(filePath));
  return dest;
}

/** Migrate raw persisted data to the current schema version. */
export function migrateSchema<T>(
  kind: SchemaKind,
  raw: unknown,
  opts: MigrationOptions,
): MigrationResult<T> {
  const version = extractVersion(raw);
  const current = CURRENT_SCHEMA_VERSION[kind];

  if (cmpVersion(version, current) > 0) {
    throw new Error(
      `Schema version ${version} in ${opts.filePath} is higher than the ` +
        `supported ${kind} schema ${current}. Please upgrade mumuspec.`,
    );
  }

  const chain = resolveMigrationChain(kind, version);
  if (chain.length === 0) {
    return { data: raw as T, version, applied: [] };
  }

  let data = structuredClone(raw) as Record<string, unknown>;
  const applied: string[] = [];
  for (const m of chain) {
    data = m.migrate(data);
    applied.push(`${m.from} -> ${m.to}: ${m.description}`);
  }

  let backupPath: string | undefined;
  if (opts.backupDir && typeof opts.filePath === 'string' && existsSync(opts.filePath)) {
    backupPath = backupFile(opts.filePath, opts.backupDir);
  }

  return { data: data as T, version: current, applied, backupPath };
}
