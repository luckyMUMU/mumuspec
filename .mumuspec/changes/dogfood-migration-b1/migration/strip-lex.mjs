// 移除批回写产生的显式 lex: 前缀（偏差登记后 B 类取消时用）
import { readFileSync, writeFileSync } from 'node:fs';
const p = process.argv[2];
const lines = readFileSync(p, 'utf8').split('\n');
let n = 0;
const out = lines.map((l) => {
  if (l.startsWith('- lex: ')) { n++; return '- ' + l.slice(7); }
  return l;
});
writeFileSync(p, out.join('\n'));
console.log(JSON.stringify({ file: p, lexRemoved: n }));
