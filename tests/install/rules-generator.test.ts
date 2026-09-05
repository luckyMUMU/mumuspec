/**
 * Tests for src/install/rules-generator.ts + AGENT_RULE_TARGETS.
 * Locked test cases: TC-A2 / TC-A3 / TC-A5 (layer-2-cases.md).
 */
import { describe, it, expect } from 'vitest';
import {
  renderRuleFiles,
  renderCanonicalRules,
  renderBridgeFile,
  MANAGED_MARKER,
  type RuleGenContext,
} from '../../src/install/rules-generator.js';
import { AGENT_RULE_TARGETS, AGENT_MANIFEST, type AgentType } from '../../src/install/installer-registry.js';

const ctx: RuleGenContext = {
  specSummary: '- R1: 核心链路（grill-me → 完备性门禁 → build）',
  ponytail: '- SHALL NOT: 禁止未被请求的抽象层',
  cliCommands: 'mumuspec init / new / status / guard',
  mcpEntry: 'npx @mumuspec/mcp-server',
};

describe('TC-A2: CLAUDE.md 薄壳首行 === @AGENTS.md', () => {
  it('claude 渲染含 CLAUDE.md 桥，首行严格为 @AGENTS.md（无前导空行）', () => {
    const plans = renderRuleFiles('claude', ctx, { existingFiles: {} });
    const bridge = plans.find((p) => p.path === 'CLAUDE.md');
    expect(bridge).toBeDefined();
    expect(bridge!.action).toBe('create');
    expect(bridge!.content!.split('\n')[0]).toBe('@AGENTS.md');
    // 薄壳说明 ≤3 行（首行 + 空行 + 标记行 + 末空行）
    expect(bridge!.content!.trim().split('\n').length).toBeLessThanOrEqual(3);
  });

  it('AGENTS.md canonical 含标记头与四节内容，≤200 行', () => {
    const plans = renderRuleFiles('claude', ctx, { existingFiles: {} });
    const canonical = plans.find((p) => p.path === 'AGENTS.md');
    expect(canonical).toBeDefined();
    expect(canonical!.content).toContain(MANAGED_MARKER);
    expect(canonical!.content).toContain('## 规范链摘要');
    expect(canonical!.content).toContain('## Ponytail 编码约束');
    expect(canonical!.content).toContain('## CLI 速查');
    expect(canonical!.content).toContain('## MCP 入口');
    expect(canonical!.content!.split('\n').length).toBeLessThanOrEqual(200);
  });

  it('GEMINI.md 桥首行同样为 @AGENTS.md', () => {
    const plans = renderRuleFiles('gemini', ctx, { existingFiles: {} });
    const bridge = plans.find((p) => p.path === 'GEMINI.md');
    expect(bridge).toBeDefined();
    expect(bridge!.content!.split('\n')[0]).toBe('@AGENTS.md');
  });
});

describe('TC-A3: 冲突三态判定 + --force-rules 覆盖', () => {
  it('absent → create', () => {
    const plans = renderRuleFiles('codex', ctx, { existingFiles: {} });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ path: 'AGENTS.md', action: 'create' });
    expect(plans[0].content).toBeDefined();
  });

  it('managed（含标记头）→ update', () => {
    const plans = renderRuleFiles('codex', ctx, {
      existingFiles: { 'AGENTS.md': `# 旧内容\n> ${MANAGED_MARKER}\n` },
    });
    expect(plans[0].action).toBe('update');
    expect(plans[0].content).toContain(MANAGED_MARKER);
  });

  it('user（无标记头）→ skip + warn，且 skip 计划不携带 content', () => {
    const plans = renderRuleFiles('codex', ctx, {
      existingFiles: { 'AGENTS.md': '# 我手写的规则，勿动\n' },
    });
    expect(plans[0].action).toBe('skip');
    expect(plans[0].content).toBeUndefined();
    expect(plans[0].diagnostic).toBeTruthy();
  });

  it('user + forceRules: true → update（接管，诊断记录 force）', () => {
    const plans = renderRuleFiles('codex', ctx, {
      existingFiles: { 'AGENTS.md': '# 我手写的规则\n' },
      forceRules: true,
    });
    expect(plans[0].action).toBe('update');
    expect(plans[0].content).toContain(MANAGED_MARKER);
    expect(plans[0].diagnostic).toContain('force-rules');
  });

  it('三态对 AGENTS.md 与 CLAUDE.md 独立判定', () => {
    const plans = renderRuleFiles('claude', ctx, {
      existingFiles: {
        // AGENTS.md 用户手写 → skip；CLAUDE.md 托管 → update
        'AGENTS.md': '# 手写\n',
        'CLAUDE.md': `@AGENTS.md\n\n> ${MANAGED_MARKER} — bridge\n`,
      },
    });
    const agents = Object.fromEntries(plans.map((p) => [p.path, p.action]));
    expect(agents['AGENTS.md']).toBe('skip');
    expect(agents['CLAUDE.md']).toBe('update');
  });
});

describe('TC-A5: 表驱动冒烟 — 新增 agent 零渲染逻辑改动', () => {
  const TABLE_AGENTS = Object.keys(AGENT_RULE_TARGETS) as AgentType[];

  it('表中每个 agent 至少产出 1 个 rules 文件计划', () => {
    expect(TABLE_AGENTS.sort()).toEqual(['claude', 'codex', 'copilot', 'gemini', 'windsurf']);
    for (const agent of TABLE_AGENTS) {
      const plans = renderRuleFiles(agent, ctx, { existingFiles: {} });
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans[0].path).toBe('AGENTS.md');
    }
  });

  it('所有桥文件首行规则成立', () => {
    for (const agent of TABLE_AGENTS) {
      const target = AGENT_RULE_TARGETS[agent]!;
      for (const bridge of Object.values(target.bridges)) {
        expect(bridge.line).toBe('@AGENTS.md');
        const plans = renderRuleFiles(agent, ctx, { existingFiles: {} });
        const plan = plans.find((p) => p.path === bridge.file)!;
        expect(plan.content!.split('\n')[0]).toBe(bridge.line);
      }
    }
  });

  it('结构断言：目标表不含 .cursorrules / .windsurfrules（D2 红线）', () => {
    const serialized = JSON.stringify(AGENT_RULE_TARGETS);
    expect(serialized).not.toContain('.cursorrules');
    expect(serialized).not.toContain('.windsurfrules');
  });

  it('渲染函数无 per-agent 分支：表外 agent 返回空计划（行为由表决定）', () => {
    for (const agent of ['catpaw', 'cursor', 'trae', 'workbuddy', 'opencode'] as AgentType[]) {
      expect(renderRuleFiles(agent, ctx, { existingFiles: {} })).toEqual([]);
    }
  });

  it('新 agent 的 manifest 已注册（+4，additive）', () => {
    for (const agent of ['codex', 'windsurf', 'gemini', 'copilot'] as AgentType[]) {
      expect(AGENT_MANIFEST[agent].length).toBeGreaterThanOrEqual(1);
    }
    // 既有 6 agent manifest 不变
    expect(AGENT_MANIFEST['catpaw'].length).toBe(7);
    expect(AGENT_MANIFEST['workbuddy'].length).toBe(7);
  });
});

describe('渲染内容契约', () => {
  it('renderCanonicalRules 与 renderBridgeFile 均携带托管标记', () => {
    expect(renderCanonicalRules(ctx)).toContain(MANAGED_MARKER);
    expect(renderBridgeFile('@AGENTS.md')).toContain(MANAGED_MARKER);
  });
});
