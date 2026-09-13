import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const p = '.mumuspec/spec.md';
const orig = readFileSync(p, 'utf8');
writeFileSync(p, orig + '\n- tc2 drift probe line qzxkv\n');
try {
  const res = spawnSync(process.execPath, ['scripts/ci-check.mjs'], { encoding: 'utf8', timeout: 120000 });
  const out = res.stdout || '';
  const lines = out.split('\n').filter((l) => /❌|E-AGENTS|Results/i.test(l)).slice(0, 5);
  console.log('exit:', res.status);
  console.log(lines.join('\n'));
} finally {
  writeFileSync(p, orig);
  console.log('restored');
}
