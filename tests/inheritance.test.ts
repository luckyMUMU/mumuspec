import { describe, it, expect } from 'vitest';
import { checkInheritanceConflicts, mergeSpecs } from '../src/spec/inheritance.js';
import { parseSpecFile } from '../src/spec/parser.js';
import type { SpecFile } from '../src/core/types.js';

describe('inheritance', () => {
  const parentSpecContent = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: Security

### SHALL
- 必须使用 HTTPS
- 必须验证所有 API 输入
`;

  const childSpecContent = `---
layer: 1
scope: "src/api"
last_updated: "2026-01-01"
---

## Requirement: Security

### SHALL
- 必须使用 HTTPS

### SHALL NOT
- 禁止使用明文传输
`;

  it('should detect no conflict when child tightens parent', () => {
    const parent = parseSpecFile(parentSpecContent, '/parent/spec.md');
    const child = parseSpecFile(childSpecContent, '/child/spec.md');

    const conflicts = checkInheritanceConflicts(parent, child);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect conflict when child SHALL NOT contradicts parent SHALL', () => {
    const conflictParentContent = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: Transport

### SHALL
- 必须使用 HTTP 协议进行数据传输
`;

    const conflictChildContent = `---
layer: 1
scope: "src/api"
last_updated: "2026-01-01"
---

## Requirement: Transport

### SHALL NOT
- 禁止使用 HTTP 协议进行明文通信
`;

    const parent = parseSpecFile(conflictParentContent, '/parent/spec.md');
    const child = parseSpecFile(conflictChildContent, '/child/spec.md');

    const conflicts = checkInheritanceConflicts(parent, child);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe('shall-not-vs-parent-shall');
  });

  it('should merge parent and child specs', () => {
    const parent = parseSpecFile(parentSpecContent, '/parent/spec.md');
    const child = parseSpecFile(childSpecContent, '/child/spec.md');

    const merged = mergeSpecs(parent, child);

    // Child's Security requirement should now have parent's SHALLs
    const securityReq = merged.requirements.find(r => r.name === 'Security');
    expect(securityReq).toBeDefined();
    expect(securityReq!.shall).toContain('必须使用 HTTPS');
    expect(securityReq!.shall).toContain('必须验证所有 API 输入');
    expect(securityReq!.shallNot).toContain('禁止使用明文传输');
  });

  it('should add parent requirements not in child', () => {
    const parentWithExtra = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: Security

### SHALL
- 必须使用 HTTPS

## Requirement: Logging

### SHALL
- 必须记录所有请求
`;

    const parent = parseSpecFile(parentWithExtra, '/parent/spec.md');
    const child = parseSpecFile(childSpecContent, '/child/spec.md');

    const merged = mergeSpecs(parent, child);

    // Should have both Security (merged) and Logging (from parent)
    expect(merged.requirements.find(r => r.name === 'Security')).toBeDefined();
    expect(merged.requirements.find(r => r.name === 'Logging')).toBeDefined();
  });
});
