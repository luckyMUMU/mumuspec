/**
 * Tests for src/change/state-machine.ts — phase transition state machine
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getValidTransitions,
  isTerminal,
  findTransitionPath,
} from '../../src/change/state-machine.js';

describe('phase state machine', () => {
  it('allows forward transitions', () => {
    expect(canTransition('open', 'design')).toBe(true);
    expect(canTransition('design', 'build')).toBe(true);
  });

  it('blocks backward transitions', () => {
    expect(canTransition('build', 'open')).toBe(false);
    expect(canTransition('archive-completed', 'build')).toBe(false);
  });

  it('getValidTransitions returns allowed next phases', () => {
    const transitions = getValidTransitions('open');
    expect(transitions).toContain('design');
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('isTerminal identifies archive-completed as terminal', () => {
    expect(isTerminal('archive-completed')).toBe(true);
  });

  it('isTerminal returns false for reversible phases', () => {
    expect(isTerminal('open')).toBe(false);
    expect(isTerminal('build')).toBe(false);
  });

  it('findTransitionPath returns valid path', () => {
    const path = findTransitionPath('open', 'archive-completed');
    expect(path).toBeInstanceOf(Array);
    expect(path).toContain('open');
    expect(path[path.length - 1]).toBe('archive-completed');
  });
});
