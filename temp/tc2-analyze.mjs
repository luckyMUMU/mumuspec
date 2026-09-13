import { readFileSync } from 'node:fs';
const d = readFileSync('.mumuspec/tech.md', 'utf8');
console.log('has doc_type tech:', /^doc_type:\s*tech/m.test(d));
const starts = [];
const re = /^## Requirement:.*/gm;
let m;
while ((m = re.exec(d))) starts.push(m.index);
for (let k = 0; k < starts.length; k++) {
  const end = k + 1 < starts.length ? starts[k + 1] : d.length;
  const block = d.slice(starts[k], end);
  const sn = (block.match(/^- SHALL NOT .*/gm) || []).length;
  const sh = (block.match(/^- SHALL (?!NOT).*/gm) || []).length;
  console.log(
    `[${k}]`, block.split('\n')[0].slice(0, 60),
    '| shallNot:', sn, '| shall:', sh,
    '| hasEnforcement:', /Enforcement:/.test(block),
  );
}
