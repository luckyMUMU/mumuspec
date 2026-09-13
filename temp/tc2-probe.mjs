import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function probe(path) {
  const orig = readFileSync(path, 'utf8');
  writeFileSync(path, orig + '\n- tc2 drift probe line qzxkv\n');
  try {
    const res = spawnSync(process.execPath, ['dist/cli.js', 'check', '--json'], { encoding: 'utf8', timeout: 120000 });
    const out = res.stdout || '';
    const j = JSON.parse(out.slice(out.indexOf('{')));
    const errs = (j.errors || []).map((e) => e.code);
    return { path, exit: res.status, errors: errs.slice(0, 3) };
  } finally {
    writeFileSync(path, orig);
  }
}

for (const p of ['.mumuspec/spec.md', 'src/change/.mumuspec/tech.md']) {
  console.log(JSON.stringify(probe(p)));
}
