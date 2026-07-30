import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SkillScaffoldResult {
  created: string[];
  errors: string[];
}

export const AUTHORING_PROTOCOL = {
  version: '0.12.2',
  schema: 'mumuspec-skill-v1',
  subagents: ['skill-core-author', 'reference-author', 'workflow-entry-author', 'skill-reviewer'],
  templates: ['phase-skill', 'analysis-skill', 'custom-workflow'],
};

export function validateSkill(projectRoot: string, skillName: string): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const skillDir = join(projectRoot, '.mumuspec', 'skills', skillName);

  if (!existsSync(skillDir)) {
    errors.push(`Skill directory not found: ${skillDir}`);
    return { valid: false, errors, warnings };
  }

  const mainFile = join(skillDir, 'SKILL.md');
  const directFile = join(projectRoot, '.mumuspec', 'skills', `${skillName}.md`);

  if (!existsSync(mainFile) && !existsSync(directFile)) {
    errors.push(`Missing SKILL.md or ${skillName}.md`);
  }

  if (existsSync(mainFile)) {
    const content = readFileSync(mainFile, 'utf8');
    if (!content.startsWith('# ')) {
      warnings.push('SKILL.md should start with a title (# heading)');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function listCustomSkills(projectRoot: string): { name: string; path: string; valid: boolean }[] {
  const skillsDir = join(projectRoot, '.mumuspec', 'skills');
  if (!existsSync(skillsDir)) return [];

  const skills: { name: string; path: string; valid: boolean }[] = [];

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'en' && entry.name !== 'zh') {
        const skillDir = join(skillsDir, entry.name);
        const validation = validateSkill(projectRoot, entry.name);
        skills.push({ name: entry.name, path: skillDir, valid: validation.valid });
      }
    }
  } catch {
    // ignore
  }

  return skills;
}

export function scaffoldSkill(
  projectRoot: string,
  skillName: string,
  options: { type?: string; description?: string } = {},
): SkillScaffoldResult {
  const created: string[] = [];
  const errors: string[] = [];

  const skillDir = join(projectRoot, '.mumuspec', 'skills', skillName);

  if (existsSync(skillDir)) {
    errors.push(`Skill "${skillName}" already exists at ${skillDir}`);
    return { created, errors };
  }

  try {
    mkdirSync(skillDir, { recursive: true });
    created.push(skillDir);
  } catch (err) {
    errors.push(`Failed to create directory: ${err instanceof Error ? err.message : String(err)}`);
    return { created, errors };
  }

  const skillFile = join(skillDir, 'SKILL.md');
  try {
    writeFileSync(skillFile, `# ${skillName}

> **Version**: 0.1.0 | **Type**: ${options.type || 'custom'}

## Description

${options.description || '[Describe what this skill does]'}

## Instructions

[Add step-by-step instructions for the AI agent]

## Input

[What context/data does this skill need?]

## Output

[What should this skill produce?]

## Examples

[Add usage examples]
`);
    created.push(skillFile);
  } catch (err) {
    errors.push(`Failed to create SKILL.md: ${err instanceof Error ? err.message : String(err)}`);
  }

  const refDir = join(skillDir, 'reference');
  try {
    mkdirSync(refDir, { recursive: true });
    created.push(refDir);
  } catch (err) {
    errors.push(`Failed to create reference dir: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { created, errors };
}

export function generateAuthoringProtocol(projectRoot: string): { path: string; created: boolean } {
  const protocolDir = join(projectRoot, '.mumuspec', 'skill-authoring');
  const protocolFile = join(protocolDir, 'protocol.yaml');

  if (existsSync(protocolFile)) {
    return { path: protocolFile, created: false };
  }

  try {
    if (!existsSync(protocolDir)) {
      mkdirSync(protocolDir, { recursive: true });
    }

    writeFileSync(protocolFile, `# MumuSpec Authoring Protocol
version: ${AUTHORING_PROTOCOL.version}
schema: ${AUTHORING_PROTOCOL.schema}

subagents:
${AUTHORING_PROTOCOL.subagents.map((s) => `  - ${s}`).join('\n')}

templates:
${AUTHORING_PROTOCOL.templates.map((t) => `  - ${t}`).join('\n')}
`);
    return { path: protocolFile, created: true };
  } catch {
    return { path: protocolFile, created: false };
  }
}
