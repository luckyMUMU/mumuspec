/**
 * Skill Recommendation Engine (R1) — R-0005.
 *
 * Recommends skills based on project scope (guard failure types + file extensions).
 *
 * ponytail: scope-based matching with hit-rate tracking. Cold start handled
 * by showing top-N defaults until sufficient tracking data exists.
 */

import type { SkillRecommendation, SkillRecommendResult } from './types.js';

const CONFIDENCE_THRESHOLD = 0.6;

/** Skill registry entry. */
interface SkillEntry {
  id: string;
  name: string;
  /** Scopes this skill applies to, e.g. "typescript", "guard-technical_design" */
  scopes: string[];
  /** Historical hit rate (0-1) */
  hitRate?: number;
  /** Description for recommendation reason */
  description: string;
}

/** Default built-in skills. */
const BUILTIN_SKILLS: SkillEntry[] = [
  {
    id: 'mumuspec',
    name: 'MumuSpec Workflow',
    scopes: ['mumuspec', 'workflow'],
    description: '规范驱动的 AI 编程工作流',
  },
  {
    id: 'paw-browser',
    name: 'Browser Automation',
    scopes: ['browser', 'web', 'e2e'],
    description: '浏览器自动化测试',
  },
  {
    id: 'env-setup',
    name: 'Environment Setup',
    scopes: ['environment', 'setup', 'install'],
    description: 'Python/Node.js 环境配置',
  },
  {
    id: 'skill-creator',
    name: 'Skill Creator',
    scopes: ['skill', 'create', 'optimize'],
    description: '创建和优化技能',
  },
];

/**
 * Recommend skills based on current scope/context.
 *
 * @param scopes - active scopes from guard failures / project context
 * @param limit - max recommendations to return (default 5)
 */
export function recommendSkills(
  scopes: string[],
  limit: number = 5,
  skillRegistry: SkillEntry[] = BUILTIN_SKILLS,
): SkillRecommendResult {
  if (scopes.length === 0) {
    // Cold start: return top defaults by hit rate
    const sorted = [...skillRegistry].sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0));
    return {
      recommendations: sorted.slice(0, limit).map((s) => ({
        skillId: s.id,
        skillName: s.name,
        relevanceScore: s.hitRate ?? 0.5, // neutral default
        reason: `Default recommendation: ${s.description}`,
      })),
      confidenceThreshold: CONFIDENCE_THRESHOLD,
    };
  }

  // Score each skill by scope overlap
  const scored: SkillRecommendation[] = skillRegistry
    .map((skill) => {
      const overlap = skill.scopes.filter(
        (s) => scopes.some((scope) => scope.includes(s) || s.includes(scope)),
      ).length;

      if (overlap === 0) return null;

      const relevance = Math.min(1, overlap / scopes.length);
      // Weight by hit rate if available
      const weighted = skill.hitRate !== undefined
        ? relevance * 0.7 + skill.hitRate * 0.3
        : relevance;

      return {
        skillId: skill.id,
        skillName: skill.name,
        relevanceScore: Math.round(weighted * 100) / 100,
        reason: `Matches ${overlap} scope(s). ${skill.description}`,
      };
    })
    .filter((r): r is SkillRecommendation => r !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return {
    recommendations: scored,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
  };
}

/**
 * Record a skill recommendation outcome for future calibration.
 *
 * In production this would persist to a tracking file.
 * ponytail: in-memory only for now; persistence layer deferred.
 */
const hitTracking = new Map<string, { shown: number; adopted: number }>();

export function recordRecommendationOutcome(skillId: string, adopted: boolean): void {
  const current = hitTracking.get(skillId) ?? { shown: 0, adopted: 0 };
  current.shown++;
  if (adopted) current.adopted++;
  hitTracking.set(skillId, current);
}

export function getRecommendationAccuracy(skillId: string): number | undefined {
  const data = hitTracking.get(skillId);
  if (!data || data.shown === 0) return undefined;
  return data.adopted / data.shown;
}

export function clearTracking(): void {
  hitTracking.clear();
}
