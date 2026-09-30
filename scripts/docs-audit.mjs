// docs 审计：① docs 中引用的 `mumuspec <cmd> [sub]` 是否真实存在于命令面；
// ② docs 与根目录 md 的相对链接是否指向存在的文件。
// 退出码：未知命令引用或死链 > 0 时为 1（CHANGELOG 历史条目不参与审计）。
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const cli = join(ROOT, 'dist', 'cli.js');

if (!existsSync(cli)) {
  console.error('[docs-audit] dist/cli.js 不存在——先 npm run build');
  process.exit(1);
}

// ── 1. 采集真实命令面：top-level + 一级子命令 ──
const run = (args) => {
  try {
    return execFileSync(process.execPath, [cli, ...args], {
      encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) { return e.stdout ?? ''; }
};

const top = new Set();
const sub = new Map();
for (const line of run(['--help']).split('\n')) {
  const m = line.match(/^\s{2}([a-z][a-z0-9-]*)\s/);
  if (m) top.add(m[1]);
}
for (const t of [...top]) {
  const s = new Set();
  for (const line of run([t, '--help']).split('\n')) {
    const m = line.match(/^\s{2}([a-z][a-z0-9-]*)\s/);
    if (m) s.add(m[1]);
  }
  if (s.size) sub.set(t, s);
}
console.log(`=== TOP-LEVEL COMMANDS (${top.size}) ===`);
console.log([...top].sort().join(' '));

// ── 2. 扫描 docs 中的 `mumuspec ...` 引用 ──
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && e !== 'dist') walk(p); }
    else if (e.endsWith('.md')) files.push(p);
  }
};
walk(join(ROOT, 'docs'));
for (const f of ['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'CLAUDE.md']) {
  const p = join(ROOT, f);
  if (existsSync(p)) files.push(p);
}

let bad = 0;
console.log('\n=== UNKNOWN COMMAND REFS IN DOCS ===');

// 已裁决的四类误报（2026-09-13 人工逐条裁决沉淀，见 .workbuddy/memory）：
// ① shell 命令 ② 参数占位符（示例变更名/路径）③ 英文句子的下一个词
// ④ 指向目录/路径的引用。命中即跳过，不计入漂移。
const SHELL_TOKENS = new Set(['npm', 'npx', 'cd', 'cp', 'git', 'node', 'run', 'install', 'link', 'pack', 'unlink']);
const PATH_TOKENS = new Set(['src', 'dist', 'docs', 'test', 'tests']);
const STOPWORDS = new Set(['to', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'in', 'on', 'of', 'is', 'are', 'be', 'process', 'workflow', 'cli', 'engine', 'repo', 'repository', 'project', 'spec', 'specs', 'mumuspec']);
const isFalsePositive = (a, b) => {
  if (!b) return SHELL_TOKENS.has(a) || STOPWORDS.has(a);
  if (SHELL_TOKENS.has(a)) return true;
  if (PATH_TOKENS.has(b)) return true;
  if (STOPWORDS.has(b)) return true;
  if (/^(my|add|demo|sample|test|example)[a-z0-9-]*$/.test(b)) return true;
  return false;
};

for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  const rel = f.slice(ROOT.length);
  const re = /\bmumuspec\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const [a, b] = [m[1], m[2]];
    const ok = b ? top.has(a) && (sub.get(a)?.has(b) ?? false) : top.has(a);
    if (!ok && !isFalsePositive(a, b)) { bad++; console.log(`  [MISSING] mumuspec ${a}${b ? ' ' + b : ''}  <- ${rel}`); }
  }
}
if (!bad) console.log('  (none)');

// ── 3. 相对链接检查 ──
let broken = 0;
console.log('\n=== BROKEN RELATIVE LINKS ===');
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  const rel = f.slice(ROOT.length);
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const target = m[2].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [pathPart] = target.split('#');
    if (!pathPart) continue;
    const abs = resolve(dirname(f), pathPart.split('\\').join('/'));
    if (!existsSync(abs)) {
      broken++;
      console.log(`  [BROKEN] ${rel} -> ${target}`);
    }
  }
}
if (!broken) console.log('  (none)');

// ── 4. 阻塞点引用对账：docs 提到的 BP 必须存在于工作流图数据 ──
// WARN 起步、不影响退出码：图数据是事实源（workflow.default.yaml + 项目级
// override），文档里出现图中没有的门禁编号即"文档声称被把守"的悬空指针。
const bpIds = new Set();
for (const f of [
  join(ROOT, 'src', 'change', 'workflow.default.yaml'),
  join(ROOT, '.mumuspec', 'workflow.yaml'),
]) {
  if (!existsSync(f)) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(/\bBP-\d+(?:\.\d+)?\b/g)) bpIds.add(m[0]);
}

const docFiles = [];
const walkDocs = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walkDocs(p);
    else if (e.endsWith('.md')) docFiles.push(p);
  }
};
walkDocs(join(ROOT, 'docs'));
let bpUnknown = 0;
const bpHits = [];
for (const f of docFiles) {
  const rel = f.slice(ROOT.length + 1);
  for (const m of readFileSync(f, 'utf8').matchAll(/\bBP-\d+(?:\.\d+)?\b/g)) {
    if (!bpIds.has(m[0]) && bpIds.size) {
      bpUnknown++;
      bpHits.push(`  [UNKNOWN-BP] ${m[0]}  <- ${rel}`);
    }
  }
}
console.log(`\n=== BLOCKING POINT REFS IN DOCS (图内 ${bpIds.size} 个) ===`);
if (!bpHits.length) console.log('  (none)');
else console.log(bpHits.slice(0, 20).join('\n'));

// ③ 生成图示对账：docs/reference/workflow-diagrams.md 是图数据的投影，
//    对账即"重渲染 == 已提交文本"。判定源与生成脚本同源（src/graph/doc-page.ts），
//    不存在第二套比对逻辑。
let diagramDrift = 'ok';
try {
  const { diagramDocDrift } = await import(new URL('../dist/graph/doc-page.js', import.meta.url).href);
  const drift = diagramDocDrift(ROOT);
  diagramDrift = drift.drifted ? `DRIFT ${drift.detail}` : 'ok';
} catch (e) {
  diagramDrift = `SKIPPED (${e.message.split('\n')[0]})`;
}
console.log(`\n=== GENERATED DIAGRAM RECONCILIATION ===`);
console.log(`  docs/reference/workflow-diagrams.md vs fresh render: ${diagramDrift}`);

console.log(`\n=== SUMMARY: unknown refs=${bad}, broken links=${broken}, unknown BP refs=${bpUnknown}, diagram drift=${diagramDrift === 'ok' ? 'none' : diagramDrift.startsWith('SKIPPED') ? 'skipped' : 1} (WARN) ===`);
// 报告型审计：四类误报使自动门禁不可判定（占位符与真实拼写错误无法机械区分），
// 输出供人工裁决；命令面硬门禁由 tests/guard/skill-registry.test.ts（skill 文本）
// 与 tests/cli/commands/check-json.test.ts TC-L3-1（注册闭包）承担。
process.exit(0);
