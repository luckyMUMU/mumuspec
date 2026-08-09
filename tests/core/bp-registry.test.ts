/**
 * Unit Tests — bp-registry.ts
 *
 * Covers: registerBP, getBPRegistry, getBP, hasBP, unregisterBP, clearBPRegistry, getBPForPhase, resolveBP
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerBP,
  getBPRegistry,
  getBP,
  hasBP,
  unregisterBP,
  clearBPRegistry,
  getBPForPhase,
  resolveBP,
} from '../../src/core/bp-registry.js';
import type { BlockingPoint } from '../../src/core/bp-registry.js';

describe('bp-registry', () => {
  beforeEach(() => {
    clearBPRegistry();
  });

  // ─── registerBP ───
  describe('registerBP', () => {
    it('adds a BP to the registry', () => {
      const bp: BlockingPoint = {
        id: 'BP-99',
        description: 'Test blocking point',
        phase: 'design',
        required: true,
      };
      registerBP(bp);
      expect(hasBP('BP-99')).toBe(true);
      expect(getBP('BP-99')).toEqual(bp);
    });

    it('overwrites existing BP with same ID', () => {
      const bp1: BlockingPoint = {
        id: 'BP-100',
        description: 'First',
        phase: 'design',
        required: false,
      };
      const bp2: BlockingPoint = {
        id: 'BP-100',
        description: 'Second',
        phase: 'build',
        required: true,
      };
      registerBP(bp1);
      registerBP(bp2);
      const stored = getBP('BP-100');
      expect(stored?.description).toBe('Second');
      expect(stored?.phase).toBe('build');
    });

    it('stores a defensive copy (not the original object)', () => {
      const bp: BlockingPoint = {
        id: 'BP-101',
        description: 'Test',
        phase: 'verify',
        required: true,
      };
      registerBP(bp);
      bp.description = 'Mutated';
      const stored = getBP('BP-101');
      expect(stored?.description).toBe('Test');
    });
  });

  // ─── getBPRegistry ───
  describe('getBPRegistry', () => {
    it('returns empty map when no BPs registered', () => {
      const reg = getBPRegistry();
      expect(reg.size).toBe(0);
    });

    it('returns all registered BPs', () => {
      registerBP({ id: 'BP-1', description: 'A', phase: 'open', required: true });
      registerBP({ id: 'BP-2', description: 'B', phase: 'design', required: false });
      const reg = getBPRegistry();
      expect(reg.size).toBe(2);
      expect(reg.has('BP-1')).toBe(true);
      expect(reg.has('BP-2')).toBe(true);
    });

    it('returns a copy (mutations do not affect registry)', () => {
      registerBP({ id: 'BP-1', description: 'A', phase: 'open', required: true });
      const reg = getBPRegistry();
      reg.delete('BP-1');
      expect(hasBP('BP-1')).toBe(true);
    });
  });

  // ─── getBP ───
  describe('getBP', () => {
    it('returns undefined for unknown ID', () => {
      expect(getBP('BP-UNKNOWN')).toBeUndefined();
    });

    it('returns the BP for known ID', () => {
      const bp: BlockingPoint = {
        id: 'BP-200',
        description: 'Known BP',
        phase: 'verify',
        required: true,
      };
      registerBP(bp);
      expect(getBP('BP-200')).toEqual(bp);
    });
  });

  // ─── hasBP ───
  describe('hasBP', () => {
    it('returns false for unknown ID', () => {
      expect(hasBP('BP-NOPE')).toBe(false);
    });

    it('returns true for registered ID', () => {
      registerBP({ id: 'BP-300', description: 'Test', phase: 'build', required: true });
      expect(hasBP('BP-300')).toBe(true);
    });
  });

  // ─── unregisterBP ───
  describe('unregisterBP', () => {
    it('removes existing BP and returns true', () => {
      registerBP({ id: 'BP-400', description: 'Test', phase: 'build', required: true });
      const result = unregisterBP('BP-400');
      expect(result).toBe(true);
      expect(hasBP('BP-400')).toBe(false);
    });

    it('returns false for unknown ID', () => {
      expect(unregisterBP('BP-NOPE')).toBe(false);
    });
  });

  // ─── clearBPRegistry ───
  describe('clearBPRegistry', () => {
    it('removes all registered BPs', () => {
      registerBP({ id: 'BP-1', description: 'A', phase: 'open', required: true });
      registerBP({ id: 'BP-2', description: 'B', phase: 'design', required: true });
      registerBP({ id: 'BP-3', description: 'C', phase: 'build', required: true });
      clearBPRegistry();
      expect(getBPRegistry().size).toBe(0);
    });

    it('does nothing when registry already empty', () => {
      clearBPRegistry();
      expect(getBPRegistry().size).toBe(0);
    });
  });

  // ─── getBPForPhase ───
  describe('getBPForPhase', () => {
    it('returns empty array when no BPs for phase', () => {
      registerBP({ id: 'BP-1', description: 'Test', phase: 'design', required: true });
      const result = getBPForPhase('build');
      expect(result).toHaveLength(0);
    });

    it('returns only BPs matching the given phase', () => {
      registerBP({ id: 'BP-A', description: 'Open', phase: 'open', required: true });
      registerBP({ id: 'BP-B', description: 'Design', phase: 'design', required: true });
      registerBP({ id: 'BP-C', description: 'Design2', phase: 'design', required: false });
      registerBP({ id: 'BP-D', description: 'Build', phase: 'build', required: true });
      const designBPs = getBPForPhase('design');
      expect(designBPs).toHaveLength(2);
      expect(designBPs.every((bp) => bp.phase === 'design')).toBe(true);
    });

    it('returns empty array for empty registry', () => {
      expect(getBPForPhase('open')).toHaveLength(0);
    });
  });

  // ─── resolveBP ───
  describe('resolveBP', () => {
    it('returns null when BP not found', async () => {
      const result = await resolveBP('BP-GHOST', {
        changeName: 'test',
        projectRoot: '.',
        phase: 'build',
        state: {},
      });
      expect(result).toBeNull();
    });

    it('returns null when BP has no resolver', async () => {
      registerBP({ id: 'BP-NO-RESOLVER', description: 'Test', phase: 'build', required: true });
      const result = await resolveBP('BP-NO-RESOLVER', {
        changeName: 'test',
        projectRoot: '.',
        phase: 'build',
        state: {},
      });
      expect(result).toBeNull();
    });

    it('calls resolver with context and returns result', async () => {
      const resolver = async (ctx: { changeName: string }) => ({
        resolved: true,
        message: `Resolved for ${ctx.changeName}`,
      });
      registerBP({
        id: 'BP-WITH-RESOLVER',
        description: 'Test',
        phase: 'build',
        required: true,
        resolver,
      });
      const result = await resolveBP('BP-WITH-RESOLVER', {
        changeName: 'my-change',
        projectRoot: '.',
        phase: 'build',
        state: {},
      });
      expect(result).not.toBeNull();
      expect(result?.resolved).toBe(true);
      expect(result?.message).toBe('Resolved for my-change');
    });

    it('catches resolver exceptions and returns resolved=false', async () => {
      registerBP({
        id: 'BP-BAD-RESOLVER',
        description: 'Test',
        phase: 'build',
        required: true,
        resolver: async () => {
          throw new Error('Resolver exploded');
        },
      });
      const result = await resolveBP('BP-BAD-RESOLVER', {
        changeName: 'test',
        projectRoot: '.',
        phase: 'build',
        state: {},
      });
      expect(result).not.toBeNull();
      expect(result?.resolved).toBe(false);
      expect(result?.message).toContain('Resolver exploded');
    });

    it('attaches metadata to solution when resolver returns it', async () => {
      registerBP({
        id: 'BP-META',
        description: 'Test',
        phase: 'verify',
        required: true,
        resolver: async () => ({
          resolved: true,
          message: 'Meta',
          metadata: { key: 'value' },
        }),
      });
      const result = await resolveBP('BP-META', {
        changeName: 'test',
        projectRoot: '.',
        phase: 'build',
        state: {},
      });
      expect(result?.metadata).toEqual({ key: 'value' });
    });
  });

  // ─── Full workflow ───
  describe('full registration lifecycle', () => {
    it('supports register → query → resolve → unregister → clear', async () => {
      // Register
      registerBP({
        id: 'BP-FULL',
        description: 'Full lifecycle test',
        phase: 'design',
        required: true,
        resolver: async () => ({ resolved: true, message: 'OK' }),
      });

      // Query
      expect(hasBP('BP-FULL')).toBe(true);
      expect(getBPForPhase('design')).toHaveLength(1);

      // Resolve
      const solution = await resolveBP('BP-FULL', {
        changeName: 'test',
        projectRoot: '.',
        phase: 'design',
        state: {},
      });
      expect(solution?.resolved).toBe(true);

      // Unregister
      unregisterBP('BP-FULL');
      expect(hasBP('BP-FULL')).toBe(false);

      // Clear
      registerBP({ id: 'BP-X', description: 'Temp', phase: 'open', required: false });
      clearBPRegistry();
      expect(getBPRegistry().size).toBe(0);
    });
  });
});
