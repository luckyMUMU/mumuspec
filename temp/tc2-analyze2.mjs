import { readFileSync } from 'node:fs';
const d = readFileSync('.mumuspec/spec.md', 'utf8');
const starts = [];
const re = /^## Requirement:.*/gm;
let m;
while ((m = re.exec(d))) starts.push(m.index);
console.log('requirements:', starts.length);
for (let k = 0; k < starts.length; k++) {
  const end = k + 1 < starts.length ? starts[k + 1] : d.length;
  const block = d.slice(starts[k], end);
  const sn = (block.match(/^- SHALL NOT .*/gm) || []).length;
  if (sn > 0 && !/Enforcement:/.test(block)) {
    console.log(`[target ${k}]`, block.split('\n')[0].slice(0, 60), '| shallNot:', sn);
    const lines = block.split('\n');
    const idx = lines.findIndex((l) => /^- SHALL NOT /.test(l));
    console.log('  first SHALL NOT line:', lines[idx].slice(0, 70));
  }
}
