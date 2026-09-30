/**
 * Registered-but-not-emitted declarations (core-consolidation L6, R-0020).
 *
 * The declaration lives on the registry entry itself (`ErrorCodeDef.reserved`),
 * so the reason an agent reads in `docs/reference/error-codes.md` and the reason
 * the metric accepts are literally the same string. A code with no emission site
 * is only honest when it is *declared* as such and something guards that
 * declaration: the eval corpus asserts these codes never appear in a
 * `mustContain` expectation, and `mumuspec conformance` re-checks that claim
 * against the fixtures instead of trusting the table.
 */
import { ERROR_CODES } from './errors.js';

export const DECLARED_UNEMITTED: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(ERROR_CODES)
      .filter(([, def]) => def.reserved !== undefined)
      .map(([code, def]) => [code, def.reserved as string]),
  ),
);

export const DECLARED_UNEMITTED_CODES: readonly string[] = Object.keys(DECLARED_UNEMITTED);
