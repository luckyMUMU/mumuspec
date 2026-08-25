/**
 * Generate prefixed unique id.
 * ponytail: 用 crypto.randomUUID (平台原生特性, Web Crypto API)。
 */
export function generateId(prefix: string): string {
  const rand = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${rand}`;
}
