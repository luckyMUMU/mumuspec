import { readFileSync, writeFileSync } from 'node:fs';
const p = '.mumuspec/tech.md';
let d = readFileSync(p, 'utf8');
const anchor = '- SHALL NOT 归档时静默丢弃无法合并的 delta-spec 文件';
const i = d.indexOf(anchor);
if (i === -1) { console.log('ANCHOR NOT FOUND'); process.exit(2); }
const lineEnd = d.indexOf('\n', i);
const injected = d.slice(0, lineEnd + 1) + '- SHALL NOT 临时注入的不可验证占位约束 tc2 probe qzxkv\n' + d.slice(lineEnd + 1);
writeFileSync(p, injected);
console.log('injected at line', d.slice(0, lineEnd).split('\n').length);
