/**
 * Atomic write tests (Phase 2.3).
 *
 * writeYaml / writeText must write via temp-file + rename so that a crash
 * mid-write never leaves a corrupted target. Verifies content correctness,
 * overwrite semantics (rename-replace works on Windows), directory creation,
 * and that no temp residue remains.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeText, writeYaml, readYaml } from '../../src/core/utils.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mumu-atomic-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('writeText (atomic)', () => {
  it('writes content and creates parent directories', () => {
    const target = join(dir, 'nested', 'a', 'file.txt');
    writeText(target, 'hello');
    expect(readFileSync(target, 'utf8')).toBe('hello');
  });

  it('atomically replaces an existing file', () => {
    const target = join(dir, 'file.txt');
    writeText(target, 'v1');
    writeText(target, 'v2');
    expect(readFileSync(target, 'utf8')).toBe('v2');
  });

  it('leaves no temp residue after success', () => {
    const target = join(dir, 'file.txt');
    writeText(target, 'data');
    const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp.'));
    expect(leftovers).toEqual([]);
  });

  it('cleans up temp file when content is rejected by the fs', () => {
    // Write to a path whose parent is a file → writeFileSync on tmp fails
    const blocker = join(dir, 'blocker');
    writeText(blocker, 'i-am-a-file');
    const target = join(dir, 'blocker', 'impossible.txt');
    expect(() => writeText(target, 'x')).toThrow();
    const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp.'));
    expect(leftovers).toEqual([]);
  });
});

describe('writeYaml (atomic)', () => {
  it('round-trips a structured object', () => {
    const target = join(dir, 'state.yaml');
    const data = { name: 'chg-1', phase: 'open', nested: { list: [1, 2] } };
    writeYaml(target, data);
    expect(readYaml<typeof data>(target)).toEqual(data);
  });

  it('leaves no temp residue after success', () => {
    const target = join(dir, 'state.yaml');
    writeYaml(target, { a: 1 });
    const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp.'));
    expect(leftovers).toEqual([]);
  });
});
