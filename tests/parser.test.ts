import { describe, it, expect } from 'vitest';
import { parseSpecFile, parseRequirements, serializeSpecFile, createDefaultSpecContent } from '../src/spec/parser.js';
import { MumuSpecError } from '../src/core/errors.js';

describe('parser', () => {
  const validSpecContent = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: Auth

### SHALL
- 必须使用 bcrypt 哈希密码
- 必须验证所有输入

### SHALL NOT
- 禁止明文存储密码
- 禁止使用 eval

### Enforcement
- AUTH-1: check bcrypt usage
- AUTH-2: check input validation
`;

  it('should parse valid spec content', () => {
    const spec = parseSpecFile(validSpecContent, '/test/spec.md');

    expect(spec.frontmatter.layer).toBe(0);
    expect(spec.frontmatter.scope).toBe('.');
    expect(spec.requirements).toHaveLength(1);

    const req = spec.requirements[0];
    expect(req.name).toBe('Auth');
    expect(req.shall).toHaveLength(2);
    expect(req.shallNot).toHaveLength(2);
    expect(req.enforcement).toHaveLength(2);
    expect(req.shall[0]).toContain('bcrypt');
    expect(req.shallNot[0]).toContain('明文');
  });

  it('should throw on missing frontmatter', () => {
    expect(() => parseSpecFile('No frontmatter', '/test/spec.md')).toThrow(MumuSpecError);
  });

  it('should throw on invalid frontmatter types', () => {
    const badContent = `---
layer: "not-a-number"
scope: "."
---

## Requirement: Test
`;
    expect(() => parseSpecFile(badContent, '/test/spec.md')).toThrow(MumuSpecError);
  });

  it('should parse multiple requirements', () => {
    const multi = `---
layer: 1
scope: "src/api"
last_updated: "2026-01-01"
---

## Requirement: API Auth

### SHALL
- 使用 JWT

### SHALL NOT
- 禁止 CORS *

## Requirement: Rate Limiting

### SHALL
- 限制每分钟 100 次请求
`;
    const spec = parseSpecFile(multi, '/test/spec.md');
    expect(spec.requirements).toHaveLength(2);
    expect(spec.requirements[0].name).toBe('API Auth');
    expect(spec.requirements[1].name).toBe('Rate Limiting');
  });

  it('should serialize spec back to markdown', () => {
    const spec = parseSpecFile(validSpecContent, '/test/spec.md');
    const serialized = serializeSpecFile(spec);

    expect(serialized).toContain('layer: 0');
    expect(serialized).toContain('## Requirement: Auth');
    expect(serialized).toContain('### SHALL');
    expect(serialized).toContain('### SHALL NOT');
    expect(serialized).toContain('bcrypt');
  });

  it('should create default spec content', () => {
    const content = createDefaultSpecContent(2, 'src/api');
    const spec = parseSpecFile(content, '/test/spec.md');

    expect(spec.frontmatter.layer).toBe(2);
    expect(spec.frontmatter.scope).toBe('src/api');
    expect(spec.requirements).toHaveLength(1);
  });

  it('should parse SHOULD section', () => {
    const content = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: Code Quality

### SHALL
- 代码必须有注释

### SHOULD
- 应该使用 TypeScript
`;
    const spec = parseSpecFile(content, '/test/spec.md');
    expect(spec.requirements[0].should).toBeDefined();
    expect(spec.requirements[0].should).toHaveLength(1);
  });
});
