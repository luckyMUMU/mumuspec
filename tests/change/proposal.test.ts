/**
 * Tests for src/change/proposal.ts — `## User Decisions` 段解析与 blocking 签收判定。
 *
 * lightweight-freeze-gate：proposal 声明影响可见结果的用户决策，blocking 项须经
 * decisions.md 签收后才能进入 build（仅在显式声明时生效，默认无新增硬门）。
 */
import { describe, it, expect } from 'vitest';
import { parseUserDecisions, unsignedBlockingDecisions } from '../../src/change/proposal.js';

describe('parseUserDecisions', () => {
  it('extracts blocking and non-blocking items from the User Decisions section', () => {
    const md = `# Proposal: x

## Why
背景

## User Decisions
- [blocking] 确认新鉴权路由为唯一出口
- 实现技术选型可自行决定

## What
内容
`;
    expect(parseUserDecisions(md)).toEqual([
      { text: '确认新鉴权路由为唯一出口', blocking: true },
      { text: '实现技术选型可自行决定', blocking: false },
    ]);
  });

  it('returns [] when the section is absent', () => {
    expect(parseUserDecisions('# Proposal: x\n\n## Why\n背景')).toEqual([]);
  });

  it('stops at the next ## heading', () => {
    const md = `# Proposal: x

## User Decisions
- [blocking] 保留旧接口兼容

## Workflow
full
`;
    expect(parseUserDecisions(md)).toEqual([{ text: '保留旧接口兼容', blocking: true }]);
  });

  it('empty section yields []', () => {
    expect(parseUserDecisions('# Proposal: x\n\n## User Decisions\n')).toEqual([]);
  });
});

describe('unsignedBlockingDecisions', () => {
  it('marks blocking items unsigned when decisions.md lacks the text', () => {
    const decisions = `## [open] 2026-09-18T00:00:00Z\n其他决策内容，与鉴权无关`;
    const blocking = [{ text: '确认新鉴权路由为唯一出口', blocking: true }];
    expect(unsignedBlockingDecisions(decisions, blocking)).toEqual(blocking);
  });

  it('whitespace-normalized substring presence counts as signed', () => {
    const decisions = `## [open] 2026-09-18T00:00:00Z\n已签收：确认新鉴权路由为唯一出口（双人）`;
    const blocking = [{ text: '确认新鉴权路由为唯一出口', blocking: true }];
    expect(unsignedBlockingDecisions(decisions, blocking)).toEqual([]);
  });

  it('empty decisions content → all blocking items unsigned', () => {
    expect(unsignedBlockingDecisions('', [{ text: 'a', blocking: true }])).toEqual([
      { text: 'a', blocking: true },
    ]);
  });
});