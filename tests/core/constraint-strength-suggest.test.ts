/**
 * Strength 建议值（strength-suggested）——TC-L0-01/02/03。
 */

import { describe, it, expect } from 'vitest';
import {
  suggestStrengthFor,
  collectStrengthDeviations,
} from '../../src/core/constraint-evaluator.js';
import { ERROR_CODES } from '../../src/core/errors.js';
import type { ConstraintStrengthField } from '../../src/core/config.js';
import type { Severity } from '../../src/core/types-constraint.js';

describe('suggestStrengthFor', () => {
  it('TC-L0-01: severity → 强度映射（ERROR→high / WARN→medium / INFO→low / 缺省→low）', () => {
    expect(suggestStrengthFor({ severity: 'ERROR' as Severity })).toBe('high');
    expect(suggestStrengthFor({ severity: 'WARN' as Severity })).toBe('medium');
    expect(suggestStrengthFor({ severity: 'INFO' as Severity })).toBe('low');
    expect(suggestStrengthFor({})).toBe('low');
  });

  it('幂等：同一输入恒定', () => {
    expect(suggestStrengthFor({ severity: 'ERROR' as Severity })).toBe(suggestStrengthFor({ severity: 'ERROR' as Severity }));
  });
});

describe('collectStrengthDeviations', () => {
  const base: ConstraintStrengthField = {
    technical_design: 'high',
    requirement_goals: 'high',
    exceptions: [],
  };

  it('TC-L0-02: 维度强度低于 ERROR 级建议 → 报告偏差', () => {
    const low: ConstraintStrengthField = {
      technical_design: 'medium',
      requirement_goals: 'high',
      exceptions: [],
    };
    const deviations = collectStrengthDeviations(low);
    const errorsOnTech = deviations.filter((d) => d.dimension === 'technical_design');
    // 注册表中 ERROR 级 def 应存在；建议均为 high，实际 medium → 全部偏差
    expect(errorsOnTech.length).toBeGreaterThan(0);
    for (const d of errorsOnTech) {
      expect(d.suggested).toBe('high');
      expect(d.actual).toBe('medium');
      expect(d.code in ERROR_CODES).toBe(true);
    }
    // requirement_goals=high → 无 ERROR 级偏差
    expect(deviations.filter((d) => d.dimension === 'requirement_goals')).toHaveLength(0);
  });

  it('TC-L0-03: 全维度 high → 空偏差', () => {
    expect(collectStrengthDeviations(base)).toHaveLength(0);
  });
});