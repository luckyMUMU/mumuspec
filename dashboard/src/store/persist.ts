/**
 * localStorage / sessionStorage 读写封装，带 graceful fallback。
 * ponytail: 用 Web Storage API（平台原生），不加 idb-keyval 库。
 */

const PREFIX = 'mumuspec-dashboard:';

function getBackend(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* access denied — fallback below */
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    /* both unavailable */
  }
  return null;
}

export function readPersisted<T>(key: string): T | null {
  const be = getBackend();
  if (!be) return null;
  try {
    const raw = be.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writePersisted<T>(key: string, value: T): void {
  const be = getBackend();
  if (!be) return;
  try {
    be.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or disabled — ignore */
  }
}

export function removePersisted(key: string): void {
  const be = getBackend();
  if (!be) return;
  try {
    be.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function onboardProgressKey(role: string): string {
  return `onboard:role:${role}`;
}
