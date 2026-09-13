import { readFileSync, writeFileSync } from 'node:fs';
import { parseSpecFile } from '../dist/spec/parser.js';
const p = '.mumuspec/spec.md';
const orig = readFileSync(p, 'utf8');
const anchor = '- SHALL NOT 将约束密度直接判定为';
const i = orig.indexOf(anchor);
const lineEnd = orig.indexOf('\n', i);
const injected = orig.slice(0, lineEnd + 1) + '- SHALL NOT 临时注入的不可验证占位约束 tc2 probe qzxkv\n' + orig.slice(lineEnd + 1);
writeFileSync(p, injected);
try {
  const spec = parseSpecFile(injected, p);
  const req = spec.requirements.find((r) => r.shallNot.some((t) => t.includes('qzxkv')) || r.shall.some((t) => t.includes('qzxkv')));
  console.log('found req:', req?.name);
  console.log('enforcement rules:', JSON.stringify(req?.enforcement?.map((e) => ({ id: e.id, kind: e.kind }))));
  console.log('shallNot count:', req?.shallNot?.length);
  console.log('frontmatter prohibitions:', spec.frontmatter?.prohibitions?.length);
} finally {
  writeFileSync(p, orig);
  console.log('restored');
}
