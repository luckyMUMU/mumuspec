/**
 * Skill Rule Engine — LLM Freedom Enhancement (L2 Dynamic Skill Assembly)
 *
 * Computes which skills to load based on task characteristics.
 * Required skills are always included; conditional skills are added
 * only when their triggering characteristic is present.
 */

import type { TaskCharacteristics, SkillEntry } from './types-workflow.js';

/** Skills that are always loaded regardless of task characteristics */
const REQUIRED_SKILLS = [
  'brainstorming',
  'gitnexus-exploring',
  'gitnexus-impact-analysis',
] as const;

/** Mapping from characteristic flag to skill to load */
const CONDITIONAL_RULES: Array<{
  field: keyof TaskCharacteristics;
  skill: string;
}> = [
  { field: 'involves_concurrency', skill: 'concurrency-patterns' },
  { field: 'involves_new_dependency', skill: 'dependency-management' },
  { field: 'involves_api_change', skill: 'api-design' },
  { field: 'involves_database_schema', skill: 'migration-patterns' },
  { field: 'involves_ui', skill: 'component-patterns' },
];

/**
 * Compute the set of skills to load based on task characteristics.
 *
 * Invariant: required_skills ⊆ computed_skill_set
 * Conditional skills are only added when their trigger is true.
 *
 * @param chars — Task characteristics detected from change scope
 * @returns Array of SkillEntry with metadata about why each was selected
 */
export function computeSkillSet(chars: TaskCharacteristics): SkillEntry[] {
  const result: SkillEntry[] = [];

  // 1. Always include required skills
  for (const name of REQUIRED_SKILLS) {
    result.push({ name, required: true });
  }

  // 2. Add conditional skills based on characteristics
  for (const rule of CONDITIONAL_RULES) {
    if (chars[rule.field] === true) {
      result.push({
        name: rule.skill,
        required: false,
        triggered_by: rule.field,
      });
    }
  }

  return result;
}
