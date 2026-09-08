/**
 * Unit Tests — Multi-language AST Constraint Engine (R-0003)
 *
 * Covers:
 * TC-01: TSProvider.parse() 返回有效 ASTResult
 * TC-02: TSProvider.checkConstraint no-mutable-state
 * TC-03: TSProvider.checkConstraint enforce-idempotent
 * TC-04: TSProvider.checkConstraint no-circular-imports
 * TC-05: JavaScriptProvider .js 路由
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { typescriptProvider } from '../../src/guard/providers/typescript-provider.js';
import { javascriptProvider } from '../../src/guard/providers/javascript-provider.js';
import { registerLanguageProvider, clearProviderRegistry, getLanguageProvider } from '../../src/guard/language-provider-registry.js';
import type { ASTResult } from '../../../src/guard/types-constraint-ast.js';

describe('R-0003 — AST Engine', () => {
  beforeEach(() => {
    clearProviderRegistry();
  });

  // ─── TC-01: TSProvider.parse() 返回有效 ASTResult ───
  describe('TC-01: TSProvider.parse()', () => {
    it('should return a valid ASTResult for TypeScript source', () => {
      const source = 'export const x: number = 1;\n';
      const result = typescriptProvider.parse(source, 'test.ts');

      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
      expect(result.sourceFile).toBe('test.ts');
      expect(result.root).toBeDefined();
      expect(result.root.kind).toBe('SourceFile');
      expect(result.diagnostics).toBeInstanceOf(Array);
    });

    it('should handle complex TypeScript constructs', () => {
      const source = `
        interface User { name: string; }
        class UserService {
          async getUser(id: string): Promise<User> {
            const result = await fetch('/api/users/' + id);
            return result.json();
          }
        }
      `;
      const result = typescriptProvider.parse(source, 'service.ts');
      expect(result.root.children.length).toBeGreaterThan(0);
    });
  });

  // ─── TC-02: no-mutable-state ───
  describe('TC-02: no-mutable-state', () => {
    it('should detect let reassignment (conservative mode)', () => {
      const source = 'let counter = 0;\ncounter = 1;\n';
      const ast = typescriptProvider.parse(source, 'mutable.ts');
      const violations = typescriptProvider.checkConstraint(ast, {
        type: 'no-mutable-state',
        params: {},
      });

      // Conservative mode: flags all let declarations
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe('E-AST-TS-001');
      expect(violations[0].severity).toBe('warning');
    });

    it('should not flag const declarations', () => {
      // Note: current implementation is conservative — it flags all let but
      // const declarations should never trigger. However, the sample source
      // uses `let`, so we verify the detection is about `let` keyword.
      const source = 'const x = 1;\nconst y = 2;\n';
      const ast = typescriptProvider.parse(source, 'immutable.ts');
      const violations = typescriptProvider.checkConstraint(ast, {
        type: 'no-mutable-state',
        params: {},
      });

      // const declarations should not be flagged
      for (const v of violations) {
        expect(v.snippet).not.toContain('const');
      }
    });
  });

  // ─── TC-03: enforce-idempotent ───
  describe('TC-03: enforce-idempotent', () => {
    it('should detect assignment inside function (side effect)', () => {
      const source = `
        function process() {
          let state = 0;
          state = state + 1;
        }
      `;
      const ast = typescriptProvider.parse(source, 'func.ts');
      const violations = typescriptProvider.checkConstraint(ast, {
        type: 'enforce-idempotent',
        params: {},
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe('E-AST-TS-002');
    });

    it('should not flag pure functions (no assignment)', () => {
      const source = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const ast = typescriptProvider.parse(source, 'pure.ts');
      const violations = typescriptProvider.checkConstraint(ast, {
        type: 'enforce-idempotent',
        params: {},
      });

      // Pure function should not trigger
      expect(violations).toHaveLength(0);
    });
  });

  // ─── TC-04: no-circular-imports ───
  describe('TC-04: no-circular-imports', () => {
    it('should flag relative imports (potential circular candidates)', () => {
      const source = `import { foo } from './bar';\n`;
      const ast = typescriptProvider.parse(source, 'module.ts');
      const violations = typescriptProvider.checkConstraint(ast, {
        type: 'no-circular-imports',
        params: {},
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe('E-AST-TS-003');
    });

    it('should not flag external (node_modules/absolute) imports', () => {
      const source = `import path from 'path';\n`;
      const ast = typescriptProvider.parse(source, 'external.ts');
      const violations = typescriptProvider.checkConstraint(ast, {
        type: 'no-circular-imports',
        params: {},
      });

      // External imports are lower risk — no violations expected
      expect(violations).toHaveLength(0);
    });
  });

  // ─── TC-05: JavaScriptProvider 路由 ───
  describe('TC-05: JavaScriptProvider routing', () => {
    it('should have javascript language identifier', () => {
      expect(javascriptProvider.language).toBe('javascript');
    });

    it('should support .js and .jsx extensions', () => {
      expect(javascriptProvider.extensions).toContain('.js');
      expect(javascriptProvider.extensions).toContain('.jsx');
    });

    it('should be registered and retrievable via registry', () => {
      clearProviderRegistry();
      registerLanguageProvider(javascriptProvider);

      const provider = getLanguageProvider('.js');

      expect(provider).not.toBeNull();
      expect(provider!.language).toBe('javascript');
    });

    it('should parse JS source correctly', () => {
      const source = 'export const x = 1;\n';
      const result = javascriptProvider.parse(source, 'test.js');

      expect(result.language).toBe('typescript'); // Underlying uses TS Compiler API
      expect(result.root).toBeDefined();
    });
  });
});
