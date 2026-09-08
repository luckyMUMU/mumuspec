/**
 * P0-A（最小版）: CommandMetadata + `mumuspec capability` 查询命令。
 * 二期不在本变更范围：全局 dry-run 框架、不可逆操作的名称二次确认。
 */
import { describe, it, expect } from 'vitest';
import {
  COMMAND_METADATA,
  DEFAULT_METADATA,
  getCommandMetadata,
  listCommandMetadata,
} from '../../src/cli/capability.js';

describe('CommandMetadata — 能力分层元数据', () => {
  it('未登记命令回落 general 只读默认', () => {
    const m = getCommandMetadata('context');
    expect(m.tier).toBe('general');
    expect(m.composable).toBe(true);
    expect(m.confirmRequired).toBe(false);
    expect(m).toEqual(expect.objectContaining(DEFAULT_METADATA));
  });

  it('已登记的专用工具返回声明的属性', () => {
    const m = getCommandMetadata('archive');
    expect(m.tier).toBe('dedicated');
    expect(m.risk).toBe('high');
    expect(m.confirmRequired).toBe(true);
    expect(m.reversible).toBe(false);
    expect(m.composable).toBe(false);
  });

  it('专用工具 composable=false、通用能力 composable=true', () => {
    expect(getCommandMetadata('discard').composable).toBe(false);
    expect(getCommandMetadata('doctor').composable).toBe(true);
  });

  it('所有登记条目字段完整合法', () => {
    for (const [name, partial] of Object.entries(COMMAND_METADATA)) {
      const m = getCommandMetadata(name);
      expect(['general', 'dedicated']).toContain(m.tier);
      expect(['none', 'low', 'medium', 'high']).toContain(m.risk);
      expect(typeof m.confirmRequired).toBe('boolean');
      expect(typeof m.reversible).toBe('boolean');
      expect(typeof m.composable).toBe('boolean');
      expect(Object.keys(partial).length).toBeGreaterThan(0);
    }
  });
});

describe('capability 列表查询', () => {
  it('列出全部已登记命令（含元数据）', () => {
    const all = listCommandMetadata();
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(
      Object.keys(COMMAND_METADATA).length,
    );
    expect(all['archive'].tier).toBe('dedicated');
    // context 未登记，不在列表内，但查询时回落 general
    expect(all['context']).toBeUndefined();
    expect(getCommandMetadata('context').tier).toBe('general');
  });
});
