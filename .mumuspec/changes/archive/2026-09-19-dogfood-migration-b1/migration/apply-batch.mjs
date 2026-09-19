// 批1回写器（dogfood-migration-b1）：机械三分法，逐行确定匹配，无匹配即跳过并计数。
import { readFileSync, writeFileSync } from 'node:fs';
import { parseSpecFile } from '../../../../dist/spec/parser.js';
import { classifyRequirements, isExplicitManual } from '../../../../dist/spec/verifier-classify.js';

const p = process.argv[2];
const lines = readFileSync(p, 'utf8').split('\n');
const spec = parseSpecFile(lines.join('\n'), p);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let wrapped = 0;
let lexed = 0;
let deferred = 0;
const missed = [];

for (const req of spec.requirements) {
  for (const e of req.enforcement) {
    if (isExplicitManual(e)) continue;
    const d = (e.description || '').trim();
    if (/^(ast|lex):/i.test(d)) continue;
    if (/^enforced-strong\(/i.test(d)) { deferred++; continue; }
    const re = new RegExp(`^(\\s*-\\s*)${esc(e.id)}:\\s*${esc(d)}\\s*$`);
    const idx = lines.findIndex((l) => re.test(l));
    if (idx < 0) { missed.push(e.id); continue; }
    lines[idx] = lines[idx].replace(re, (_m, pref) => `${pref}${e.id}: manual(${d})`);
    wrapped++;
  }
  // B 类（legacy weak → lex: 前缀）经批1实测取消：lex: 前缀破坏
  // checker 对 "The system SHALL NOT …" 系统行为约束的豁免路径，且引号项
  // 多为对象标识符（红线：行内码承载标识符）。见 decisions.md 偏差登记。
}

writeFileSync(p, lines.join('\n'));
console.log(JSON.stringify({ file: p, wrapped, lexed, deferred_enforced_strong: deferred, missed }));
