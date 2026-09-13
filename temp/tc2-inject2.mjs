import { readFileSync, writeFileSync } from 'node:fs';
const p = '.mumuspec/spec.md';
let d = readFileSync(p, 'utf8');
const anchor = '- SHALL NOT 将约束密度直接判定为';
const i = d.indexOf(anchor);
if (i === -1) { console.log('ANCHOR NOT FOUND'); process.exit(2); }
const lineEnd = d.indexOf('\n', i);
d = d.slice(0, lineEnd + 1) + '- SHALL NOT 临时注入的不可验证占位约束 tc2 probe qzxkv\n' + d.slice(lineEnd + 1);
writeFileSync(p, d);
console.log('injected into .mumuspec/spec.md');
