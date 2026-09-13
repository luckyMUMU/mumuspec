import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const p = '.mumuspec/spec.md';
const orig = readFileSync(p, 'utf8');
const anchor = '- SHALL NOT 将约束密度直接判定为';
const i = orig.indexOf(anchor);
if (i === -1) { console.log('ANCHOR NOT FOUND'); process.exit(2); }
const lineEnd = orig.indexOf('\n', i);
const injected = orig.slice(0, lineEnd + 1) + '- SHALL NOT 临时注入的不可验证占位约束 tc2 probe qzxkv\n' + orig.slice(lineEnd + 1);
writeFileSync(p, injected);
try {
  const res = spawnSync(process.execPath, ['dist/cli.js', 'validate', '--json'], { encoding: 'utf8', timeout: 60000 });
  const out = res.stdout || '';
  const j = JSON.parse(out.slice(out.indexOf('{')));
  console.log('passed:', j.passed, '| errors:', j.errors.length, '| warnings:', j.warnings.length);
  console.log('coverage total:', j.coverage?.total, '| unverifiable:', j.coverage?.unverifiable);
  for (const e of j.errors.slice(0, 3)) console.log('ERR:', e.code, e.message?.slice(0, 80));
} finally {
  writeFileSync(p, orig);
  console.log('restored');
}
