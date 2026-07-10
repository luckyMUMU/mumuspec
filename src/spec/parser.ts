import type { SpecFile, SpecFrontmatter, Requirement, EnforcementRule } from '../core/types.js';
import { parseFrontmatter } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';

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
          if (enforcementMatch) {
            enforcement.push({
              id: enforcementMatch[1],
              description: enforcementMatch[2],
              severity: 'ERROR',
            });
          } else {
            enforcement.push({
              id: `ENF-${enforcement.length + 1}`,
              description: item,
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
  const fm: SpecFrontmatter = spec.frontmatter;
  lines.push('---');
  lines.push(`layer: ${fm.layer}`);
  lines.push(`scope: "${fm.scope}"`);
  lines.push(`last_updated: "${fm.last_updated}"`);
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
        lines.push(`- ${e.id}: ${e.description}`);
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
