import type {
  SpecFile,
  SpecFrontmatter,
  PrdFile,
  TechFile,
  PrdFrontmatter,
  TechFrontmatter,
  Requirement,
  EnforcementRule,
} from '../core/types.js';
import { parseFrontmatter } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';
import { stringify as stringifyYaml } from 'yaml';

/** Parse a spec.md file into structured data */
export function parseSpecFile(content: string, filePath: string): SpecFile {
  const { frontmatter, body } = parseFrontmatter<SpecFrontmatter>(content);

  // Validate frontmatter
  if (!frontmatter) {
    throw new MumuSpecError('E-SPEC-001', { file: filePath, detail: 'Missing YAML frontmatter' });
  }

  if (typeof frontmatter.layer !== 'number' || typeof frontmatter.scope !== 'string') {
    throw new MumuSpecError('E-SPEC-001', {
      file: filePath,
      detail: 'frontmatter must have numeric "layer" and string "scope" fields',
    });
  }

  if (!frontmatter.last_updated) {
    frontmatter.last_updated = new Date().toISOString().split('T')[0];
  }

  const requirements = parseRequirements(body);

  return {
    path: filePath,
    frontmatter,
    requirements,
    raw: content,
  };
}

/** Parse requirement blocks from markdown body */
export function parseRequirements(body: string): Requirement[] {
  const requirements: Requirement[] = [];

  // Match ## Requirement: <name> blocks
  const reqRegex = /^##\s+Requirement:\s+(.+)$/gm;
  const matches: { name: string; index: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = reqRegex.exec(body)) !== null) {
    matches.push({ name: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const block = body.substring(start, end);

    const req = parseRequirementBlock(block, matches[i].name);
    requirements.push(req);
  }

  return requirements;
}

/** Parse a single requirement block */
function parseRequirementBlock(block: string, name: string): Requirement {
  const shall: string[] = [];
  const shallNot: string[] = [];
  const should: string[] = [];
  const enforcement: EnforcementRule[] = [];

  const lines = block.split('\n');
  let currentSection: 'shall' | 'shall-not' | 'should' | 'enforcement' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('### SHALL NOT') || trimmed.startsWith('### SHALL_NOT')) {
      currentSection = 'shall-not';
      continue;
    }
    if (trimmed.startsWith('### SHALL')) {
      currentSection = 'shall';
      continue;
    }
    if (trimmed.startsWith('### SHOULD')) {
      currentSection = 'should';
      continue;
    }
    if (trimmed.startsWith('### Enforcement')) {
      currentSection = 'enforcement';
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const item = trimmed.substring(2).trim();
      switch (currentSection) {
        case 'shall':
          shall.push(item);
          break;
        case 'shall-not':
          shallNot.push(item);
          break;
        case 'should':
          should.push(item);
          break;
        case 'enforcement': {
          // Parse: - SHALL-1: description
          const enforcementMatch = item.match(/^(\S+):\s*(.+)$/);
          let id: string;
          let description: string;
          if (enforcementMatch) {
            id = enforcementMatch[1];
            description = enforcementMatch[2];
          } else {
            id = `ENF-${enforcement.length + 1}`;
            description = item;
          }
          // P0 verifier semantics: manual(...) reserved word — explicit human
          // verification declaration. Legacy free text → implicit-manual.
          const manualMatch = description.match(/^manual\((.*)\)$/s);
          if (manualMatch) {
            enforcement.push({
              id,
              description: manualMatch[1].trim(),
              kind: 'manual',
              severity: 'ERROR',
            });
          } else {
            enforcement.push({
              id,
              description,
              kind: 'implicit-manual',
              severity: 'ERROR',
            });
          }
          break;
        }
      }
    }
  }

  return { name, shall, shallNot, should, enforcement };
}

/** Serialize a SpecFile back to markdown */
export function serializeSpecFile(spec: SpecFile): string {
  const lines: string[] = [];

  // Frontmatter
  // P0 fidelity fix (2026-08-29): the previous serializer wrote only the known
  // fields and silently DROPPED any other frontmatter keys on round-trip
  // (e.g. doc_type, parent_prd). Preserve them after the known fields.
  const fm = spec.frontmatter as unknown as Record<string, unknown>;
  const knownKeys = new Set(['layer', 'scope', 'last_updated', 'prohibitions']);
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(fm)) {
    if (!knownKeys.has(key) && fm[key] !== undefined) extras[key] = fm[key];
  }
  lines.push('---');
  lines.push(`layer: ${fm.layer}`);
  lines.push(`scope: "${fm.scope}"`);
  lines.push(`last_updated: "${fm.last_updated}"`);
  // P1-1 Fix: Serialize prohibitions annotations
  if (fm.prohibitions && (fm.prohibitions as unknown[]).length > 0) {
    lines.push('prohibitions:');
    for (const p of fm.prohibitions as NonNullable<SpecFrontmatter['prohibitions']>) {
      lines.push(`  - text: "${p.text}"`);
      lines.push('    annotation:');
      lines.push(`      type: ${p.annotation.type}`);
      if (p.annotation.scope) lines.push(`      scope: ${p.annotation.scope}`);
      if (p.annotation.target) lines.push(`      target: "${p.annotation.target}"`);
      if (p.annotation.ast_constraint) lines.push(`      ast_constraint: "${p.annotation.ast_constraint}"`);
      if (p.annotation.rationale) lines.push(`      rationale: "${p.annotation.rationale}"`);
    }
  }
  if (Object.keys(extras).length > 0) {
    // Deterministic order (not object order) keeps round-trips stable
    for (const key of Object.keys(extras).sort()) {
      const value = extras[key];
      if (typeof value === 'string') {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(...stringifyYaml({ [key]: value }).trimEnd().split('\n'));
      }
    }
  }
  lines.push('---');
  lines.push('');

  // Requirements
  for (const req of spec.requirements) {
    lines.push(`## Requirement: ${req.name}`);
    lines.push('');

    if (req.shall.length > 0) {
      lines.push('### SHALL');
      for (const s of req.shall) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (req.shallNot.length > 0) {
      lines.push('### SHALL NOT');
      for (const s of req.shallNot) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (req.should && req.should.length > 0) {
      lines.push('### SHOULD');
      for (const s of req.should) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (req.enforcement.length > 0) {
      lines.push('### Enforcement');
      for (const e of req.enforcement) {
        // P0: re-wrap explicit manual declarations so the marker round-trips
        const text = e.kind === 'manual' ? `manual(${e.description})` : e.description;
        lines.push(`- ${e.id}: ${text}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/** Create a default spec.md content */
export function createDefaultSpecContent(layer: number, scope: string): string {
  const spec: SpecFile = {
    path: '',
    frontmatter: {
      layer,
      scope,
      last_updated: new Date().toISOString().split('T')[0],
    },
    requirements: [
      {
        name: 'General',
        shall: ['定义本层的正向要求'],
        shallNot: ['定义本层的反向禁止'],
        enforcement: [],
      },
    ],
    raw: '',
  };

  return serializeSpecFile(spec);
}

// ════════════════════════════════════════════════════════════════════
// PRD / Tech document parsing (Distributed Spec V2)
// ════════════════════════════════════════════════════════════════════

/** Parse a prd.md file into structured PrdFile */
export function parsePrdFile(content: string, filePath: string): PrdFile {
  const { frontmatter, body } = parseFrontmatter<PrdFrontmatter>(content);

  if (!frontmatter) {
    throw new MumuSpecError('E-SPEC-008', { file: filePath, detail: 'Missing YAML frontmatter' });
  }

  if (typeof frontmatter.layer !== 'number' || typeof frontmatter.scope !== 'string') {
    throw new MumuSpecError('E-SPEC-008', {
      file: filePath,
      detail: 'prd.md frontmatter must have numeric "layer" and string "scope" fields',
    });
  }

  if (!frontmatter.last_updated) {
    frontmatter.last_updated = new Date().toISOString().split('T')[0];
  }

  // PRD documents use standard ## Requirement: format for structured constraints
  const requirements = parseRequirements(body);

  // Extract user scenarios and acceptance criteria from requirements
  const userScenarios: string[] = [];
  const acceptanceCriteria: string[] = [];

  for (const req of requirements) {
    if (/scenario|场景|用户/.test(req.name)) {
      userScenarios.push(...req.shall);
    }
    if (/criteria|验收|acceptance/.test(req.name)) {
      acceptanceCriteria.push(...req.shall);
    }
  }

  return {
    path: filePath,
    scope: frontmatter.scope,
    layer: frontmatter.layer,
    content: body,
    userScenarios,
    acceptanceCriteria,
    requirements,
  };
}

/** Parse a tech.md file into structured TechFile */
export function parseTechFile(content: string, filePath: string): TechFile {
  const { frontmatter, body } = parseFrontmatter<TechFrontmatter>(content);

  if (!frontmatter) {
    throw new MumuSpecError('E-SPEC-009', { file: filePath, detail: 'Missing YAML frontmatter' });
  }

  if (typeof frontmatter.layer !== 'number' || typeof frontmatter.scope !== 'string') {
    throw new MumuSpecError('E-SPEC-009', {
      file: filePath,
      detail: 'tech.md frontmatter must have numeric "layer" and string "scope" fields',
    });
  }

  if (!frontmatter.last_updated) {
    frontmatter.last_updated = new Date().toISOString().split('T')[0];
  }

  // Tech documents use standard ## Requirement: format for structured constraints
  const requirements = parseRequirements(body);

  // Extract architecture decisions from architecture-related requirements
  const architectureDecisions: string[] = [];
  for (const req of requirements) {
    if (/architecture|架构|design/.test(req.name)) {
      architectureDecisions.push(...req.shall);
    }
  }

  return {
    path: filePath,
    scope: frontmatter.scope,
    layer: frontmatter.layer,
    content: body,
    requirements,
    architectureDecisions,
  };
}

/** Serialize a PrdFile back to markdown */
export function serializePrdFile(prd: PrdFile): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`layer: ${prd.layer}`);
  lines.push(`scope: "${prd.scope}"`);
  lines.push(`last_updated: "${new Date().toISOString().split('T')[0]}"`);
  lines.push('doc_type: prd');
  lines.push('---');
  lines.push('');

  // Reconstruct requirements as standard blocks
  if (prd.userScenarios.length > 0) {
    lines.push('## Requirement: User Scenarios');
    lines.push('');
    lines.push('### SHALL');
    for (const s of prd.userScenarios) {
      lines.push(`- ${s}`);
    }
    lines.push('');
  }

  if (prd.acceptanceCriteria.length > 0) {
    lines.push('## Requirement: Acceptance Criteria');
    lines.push('');
    lines.push('### SHALL');
    for (const c of prd.acceptanceCriteria) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Serialize a TechFile back to markdown */
export function serializeTechFile(tech: TechFile): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`layer: ${tech.layer}`);
  lines.push(`scope: "${tech.scope}"`);
  lines.push(`last_updated: "${new Date().toISOString().split('T')[0]}"`);
  lines.push('doc_type: tech');
  lines.push('---');
  lines.push('');

  for (const req of tech.requirements) {
    lines.push(`## Requirement: ${req.name}`);
    lines.push('');

    if (req.shall.length > 0) {
      lines.push('### SHALL');
      for (const s of req.shall) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (req.shallNot.length > 0) {
      lines.push('### SHALL NOT');
      for (const s of req.shallNot) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (req.should && req.should.length > 0) {
      lines.push('### SHOULD');
      for (const s of req.should) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    if (req.enforcement.length > 0) {
      lines.push('### Enforcement');
      for (const e of req.enforcement) {
        // P0: re-wrap explicit manual declarations so the marker round-trips
        const text = e.kind === 'manual' ? `manual(${e.description})` : e.description;
        lines.push(`- ${e.id}: ${text}`);
      }
      lines.push('');
    }
  }

  // Append inherited requirements
  if (tech.inherited_requirements && tech.inherited_requirements.length > 0) {
    lines.push('## Requirement: Inherited from Parent');
    lines.push('');
    for (const req of tech.inherited_requirements) {
      lines.push(`### From: ${req.name}`);
      if (req.shall.length > 0) {
        lines.push('#### SHALL');
        for (const s of req.shall) {
          lines.push(`- ${s}`);
        }
      }
      if (req.shallNot.length > 0) {
        lines.push('#### SHALL NOT');
        for (const s of req.shallNot) {
          lines.push(`- ${s}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Create a default prd.md content with standard Requirement blocks */
export function createDefaultPrdContent(layer: number, scope: string, change?: string): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`layer: ${layer}`);
  lines.push(`scope: "${scope}"`);
  lines.push(`last_updated: "${new Date().toISOString().split('T')[0]}"`);
  lines.push('doc_type: prd');
  if (change) {
    lines.push(`change: ${change}`);
  }
  lines.push('---');
  lines.push('');

  lines.push('## Requirement: Feature Goals');
  lines.push('');
  lines.push('### SHALL');
  lines.push('- <Describe product/feature goals>');
  lines.push('');
  lines.push('### SHALL NOT');
  lines.push('- <Describe forbidden behaviors or out-of-scope items>');
  lines.push('');
  lines.push('## Requirement: User Scenarios');
  lines.push('');
  lines.push('### SHALL');
  lines.push('- <Describe user-facing scenarios this feature addresses>');
  lines.push('');
  lines.push('## Requirement: Acceptance Criteria');
  lines.push('');
  lines.push('### SHALL');
  lines.push('- <Describe measurable acceptance criteria>');
  lines.push('');

  return lines.join('\n');
}

/** Create a default tech.md content with standard Requirement blocks */
export function createDefaultTechContent(
  layer: number,
  scope: string,
  change?: string,
  phase?: 'design' | 'build' | 'verify',
): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`layer: ${layer}`);
  lines.push(`scope: "${scope}"`);
  lines.push(`last_updated: "${new Date().toISOString().split('T')[0]}"`);
  lines.push('doc_type: tech');
  if (change) {
    lines.push(`change: ${change}`);
  }
  if (phase) {
    lines.push(`phase: ${phase}`);
  }
  lines.push('---');
  lines.push('');

  lines.push('## Requirement: <Domain Name> Constraints');
  lines.push('');
  lines.push('### SHALL');
  lines.push('- <Describe mandatory technical constraints>');
  lines.push('');
  lines.push('### SHALL NOT');
  lines.push('- <Describe forbidden technical practices>');
  lines.push('');
  lines.push('### SHOULD');
  lines.push('- <Describe recommended practices>');
  lines.push('');
  lines.push('### Enforcement');
  lines.push('- <ID>: <Enforcement description>');
  lines.push('');

  return lines.join('\n');
}
