/**
 * Extra tests for src/cli/ui-helpers.ts — step, success, warn, fail, tip, formatDuration, resetSteps.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  step,
  success,
  warn,
  fail,
  tip,
  formatDuration,
  resetSteps,
} from '../../src/cli/ui-helpers.js';

describe('ui-helpers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    resetSteps();
  });

  describe('step', () => {
    it('should increment step counter starting from 1', () => {
      step('First task');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[1]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('First task'));
    });

    it('should increment for each call', () => {
      step('A');
      step('B');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[2]'));
    });
  });

  describe('success', () => {
    it('should print with checkmark', () => {
      success('Done');
      expect(logSpy).toHaveBeenCalledWith('  ✓ Done');
    });
  });

  describe('warn', () => {
    it('should print with warning icon', () => {
      warn('Careful');
      expect(logSpy).toHaveBeenCalledWith('  ⚠ Careful');
    });
  });

  describe('fail', () => {
    it('should print with X icon', () => {
      fail('Error');
      expect(logSpy).toHaveBeenCalledWith('  ✗ Error');
    });

    it('should print recovery suggestion when provided', () => {
      fail('Error', 'Try X');
      expect(logSpy).toHaveBeenCalledWith('  ✗ Error');
      expect(logSpy).toHaveBeenCalledWith('    💡 Try X');
    });

    it('should not print recovery when not provided', () => {
      fail('Error');
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('tip', () => {
    it('should print with info icon', () => {
      tip('Hint');
      expect(logSpy).toHaveBeenCalledWith('  ℹ Hint');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds under 1s', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds with decimal', () => {
      expect(formatDuration(1500)).toBe('1.5s');
    });

    it('should format under 60s as seconds', () => {
      expect(formatDuration(30000)).toBe('30.0s');
    });

    it('should format minutes and seconds for over 60s', () => {
      const result = formatDuration(65000);
      expect(result).toContain('m');
      expect(result).toContain('s');
    });

    it('should handle exactly 1000ms as 1.0s', () => {
      expect(formatDuration(1000)).toBe('1.0s');
    });

    it('should handle 0ms', () => {
      expect(formatDuration(0)).toBe('0ms');
    });
  });

  describe('resetSteps', () => {
    it('should reset counter to 0', () => {
      step('A');
      step('B');
      resetSteps();
      step('C');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[1] → C'));
    });
  });
});
