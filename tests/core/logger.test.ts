import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/core/logger.js';

describe('Logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.MUMUSPEC_LOG_LEVEL;
    delete process.env.MUMUSPEC_LOG_JSON;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    warnSpy.mockRestore();
    delete process.env.MUMUSPEC_LOG_LEVEL;
    delete process.env.MUMUSPEC_LOG_JSON;
  });

  describe('default level (info)', () => {
    it('should output warn messages via console.warn', () => {
      Logger.warn('test.module', 'warning msg');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test.module'));
    });

    it('should output error messages via console.error', () => {
      Logger.error('test.module', 'error msg');
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
    });

    it('should not output debug when level is info', () => {
      Logger.debug('test.module', 'debug msg');
      expect(stderrSpy).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should not output trace when level is info', () => {
      Logger.trace('test.module', 'trace msg');
      expect(stderrSpy).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug level', () => {
    it('should output debug messages when level is debug', () => {
      process.env.MUMUSPEC_LOG_LEVEL = 'debug';
      Logger.debug('test.module', 'debug msg');
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
    });

    it('should still filter trace when level is debug', () => {
      process.env.MUMUSPEC_LOG_LEVEL = 'debug';
      Logger.trace('test.module', 'trace msg');
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe('trace level', () => {
    it('should output warn and error when level is trace', () => {
      process.env.MUMUSPEC_LOG_LEVEL = 'trace';
      Logger.warn('m', 'w');
      Logger.error('m', 'e');

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    });
  });

  describe('error level (highest)', () => {
    it('should only output error messages', () => {
      process.env.MUMUSPEC_LOG_LEVEL = 'error';

      Logger.trace('m', 't');
      Logger.debug('m', 'd');
      Logger.info('m', 'i');
      Logger.warn('m', 'w');
      Logger.error('m', 'e');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('JSON mode', () => {
    it('should output JSON format to stderr when MUMUSPEC_LOG_JSON=true', () => {
      process.env.MUMUSPEC_LOG_JSON = 'true';
      Logger.info('test.module', 'json test', { key: 'value' });

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.module).toBe('test.module');
      expect(parsed.message).toBe('json test');
      expect(parsed.context).toEqual({ key: 'value' });
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include context in JSON output', () => {
      process.env.MUMUSPEC_LOG_JSON = 'true';
      Logger.error('m', 'with ctx', { a: 1, b: 'str' });

      const output = stderrSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.context).toEqual({ a: 1, b: 'str' });
    });
  });

  describe('context formatting', () => {
    it('should format context in human-readable mode', () => {
      process.env.MUMUSPEC_LOG_LEVEL = 'info';
      Logger.warn('test.mod', 'msg with ctx', { userId: 'u123', action: 'create' });

      const output = warnSpy.mock.calls[0][0];
      expect(output).toContain('userId=u123');
      expect(output).toContain('action=create');
    });
  });
});
