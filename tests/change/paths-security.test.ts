import { describe, it, expect } from 'vitest';
import { getChangeDir, getDiscardedDir, getArchivedChangeDir } from '../../src/change/paths.js';
import { MumuSpecError } from '../../src/core/errors.js';

describe('paths.ts security', () => {
  const root = '/fake/project';

  describe('getChangeDir', () => {
    it('should accept valid change names', () => {
      expect(() => getChangeDir(root, 'feature-123')).not.toThrow();
      expect(() => getChangeDir(root, 'MyChange')).not.toThrow();
      expect(() => getChangeDir(root, 'fix.auth.login')).not.toThrow();
    });

    it('should throw E-SECURITY-002 for path traversal', () => {
      expect(() => getChangeDir(root, '../etc')).toThrow(MumuSpecError);
      expect(() => getChangeDir(root, '..')).toThrow(MumuSpecError);
      expect(() => getChangeDir(root, 'foo/../../bar')).toThrow(MumuSpecError);
    });

    it('should throw E-SECURITY-002 for absolute paths', () => {
      expect(() => getChangeDir(root, '/etc/passwd')).toThrow(MumuSpecError);
    });

    it('should throw E-SECURITY-002 for shell metacharacters', () => {
      expect(() => getChangeDir(root, 'foo;rm -rf')).toThrow(MumuSpecError);
      expect(() => getChangeDir(root, '$(whoami)')).toThrow(MumuSpecError);
    });

    it('should throw E-SECURITY-002 for empty string', () => {
      expect(() => getChangeDir(root, '')).toThrow(MumuSpecError);
    });
  });

  describe('getDiscardedDir', () => {
    it('should throw E-SECURITY-002 for invalid names', () => {
      expect(() => getDiscardedDir(root, '../evil')).toThrow(MumuSpecError);
      expect(() => getDiscardedDir(root, '')).toThrow(MumuSpecError);
      expect(() => getDiscardedDir(root, 'foo bar')).toThrow(MumuSpecError);
    });

    it('should accept valid names and return path with discarded segment', () => {
      const result = getDiscardedDir(root, 'my-change');
      expect(result).toContain('discarded');
      expect(result).toContain('my-change');
    });
  });

  describe('getArchivedChangeDir', () => {
    it('should throw E-SECURITY-002 for invalid names', () => {
      // getArchivedChangeDir may return undefined if archive doesn't exist,
      // but validation should still throw for invalid names
      expect(() => getArchivedChangeDir(root, '../etc')).toThrow(MumuSpecError);
    });
  });

  describe('error code and context', () => {
    it('should include changeName in error context', () => {
      try {
        getChangeDir(root, '../bad');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(MumuSpecError);
        expect((err as MumuSpecError).code).toBe('E-SECURITY-002');
        expect((err as MumuSpecError).context).toEqual({ changeName: '../bad' });
      }
    });
  });
});
