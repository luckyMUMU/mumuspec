import { describe, it, expect } from 'vitest';
import { validateChangeName } from '../../src/core/utils.js';

describe('validateChangeName', () => {
  describe('valid names', () => {
    it('should accept simple alphanumeric names', () => {
      expect(validateChangeName('feature123')).toBe(true);
      expect(validateChangeName('bugfix')).toBe(true);
      expect(validateChangeName('MyChange')).toBe(true);
    });

    it('should accept names with dots', () => {
      expect(validateChangeName('feature.auth')).toBe(true);
      expect(validateChangeName('v1.2.3')).toBe(true);
    });

    it('should accept names with hyphens', () => {
      expect(validateChangeName('add-auth')).toBe(true);
      expect(validateChangeName('fix-login-flow')).toBe(true);
    });

    it('should accept names with underscores', () => {
      expect(validateChangeName('add_auth')).toBe(true);
      expect(validateChangeName('my_change')).toBe(true);
    });

    it('should accept mixed separators', () => {
      expect(validateChangeName('feature.auth-login_v2')).toBe(true);
    });
  });

  describe('invalid names (security threats)', () => {
    it('should reject path traversal with ..', () => {
      expect(validateChangeName('../etc')).toBe(false);
      expect(validateChangeName('..')).toBe(false);
      expect(validateChangeName('foo/../bar')).toBe(false);
    });

    it('should reject absolute paths', () => {
      expect(validateChangeName('/etc/passwd')).toBe(false);
      expect(validateChangeName('/absolute/path')).toBe(false);
    });

    it('should reject path separators', () => {
      expect(validateChangeName('foo/bar')).toBe(false);
      expect(validateChangeName('foo\\bar')).toBe(false);
    });

    it('should reject names starting with dots', () => {
      expect(validateChangeName('.hidden')).toBe(false);
      expect(validateChangeName('.')).toBe(false);
    });

    it('should reject names starting with hyphens', () => {
      expect(validateChangeName('-flag')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(validateChangeName('')).toBe(false);
    });

    it('should reject names with shell metacharacters', () => {
      expect(validateChangeName('foo;rm -rf')).toBe(false);
      expect(validateChangeName('$(whoami)')).toBe(false);
      expect(validateChangeName('foo`bar`')).toBe(false);
      expect(validateChangeName('foo|bar')).toBe(false);
    });

    it('should reject names with spaces', () => {
      expect(validateChangeName('my change')).toBe(false);
      expect(validateChangeName(' leading')).toBe(false);
      expect(validateChangeName('trailing ')).toBe(false);
    });
  });
});
