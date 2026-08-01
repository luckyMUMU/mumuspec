/**
 * MumuSpec 综合验证脚本
 * 验证 CLI 所有命令 + MCP Server 协议 + 工具调用
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawn } from 'node:child_process';

const CLI = join(process.cwd(), 'dist', 'cli.js');
const MCP = join(process.cwd(), 'dist', 'mcp-server.js');

let passed = 0;
let failed = 0;
const results: { name: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    results.push({ name, status: 'FAIL', detail });
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function run(args: string, cwd: string, options: { expectError?: boolean } = {}): string {
  try {
    return execSync(`node "${CLI}" ${args}`, { encoding: 'utf8', cwd, stdio: 'pipe' });
  } catch (e: any) {
    if (options.expectError) return e.stdout || e.stderr || '';
    throw e;
  }
}

// ============================================================
// CLI 验证
// ============================================================
console.log('\n═══════════════════════════════════════════');
console.log('  CLI 功能完整验证');
console.log('═══════════════════════════════════════════\n');

const projectDir = mkdtempSync(join(tmpdir(), 'mumuspec-verify-'));

try {
  // 1. Version
  console.log('▶ 版本与帮助');
  const ver = run('--version', projectDir);
  check('mumuspec --version 输出 0.10.0', ver.trim() === '0.10.0', `got: ${ver.trim()}`);

  const help = run('--help', projectDir);
  check('mumuspec --help 包含所有核心命令', 
    help.includes('init') && help.includes('context') && help.includes('validate') && 
    help.includes('check') && help.includes('new') && help.includes('status') && 
    help.includes('list') && help.includes('archive') && help.includes('discard') && 
    help.includes('guard') && help.includes('doctor') && help.includes('search') &&
    help.includes('state') && help.includes('test-cases') && help.includes('knowledge'));

  // 2. Init
  console.log('\n▶ init 初始化项目');
  const initOut = run(`init "${projectDir}" --name verify-project --language typescript`, projectDir);
  check('init 输出成功消息', initOut.includes('MumuSpec initialized'));
  check('init 创建 .mumuspec/config.yaml', existsSync(join(projectDir, '.mumuspec', 'config.yaml')));
  check('init 创建 .mumuspec/spec.md', existsSync(join(projectDir, '.mumuspec', 'spec.md')));
  check('init 创建 .mumuspec/design.md', existsSync(join(projectDir, '.mumuspec', 'design.md')));
  check('init 创建 .mumuspec/prohibitions.md', existsSync(join(projectDir, '.mumuspec', 'prohibitions.md')));
  check('init 创建 .mumuspec/index.yaml', existsSync(join(projectDir, '.mumuspec', 'index.yaml')));
  check('init 创建 .mumuspec/changes/ 目录', existsSync(join(projectDir, '.mumuspec', 'changes')));
  check('init 创建 .mumuspec/knowledge/ 目录', existsSync(join(projectDir, '.mumuspec', 'knowledge')));
  check('init 生成 CLAUDE.md', existsSync(join(projectDir, 'CLAUDE.md')));
  check('init 生成 .cursorrules', existsSync(join(projectDir, '.cursorrules')));
  check('init 生成 AGENTS.md', existsSync(join(projectDir, 'AGENTS.md')));

  // Check Ponytail injected into spec.md
  const specContent = readFileSync(join(projectDir, '.mumuspec', 'spec.md'), 'utf8');
  check('init 注入 Ponytail 约束到 spec.md', specContent.includes('Ponytail'));
  check('spec.md 包含 SHALL NOT', specContent.includes('SHALL NOT'));
  check('spec.md 包含 YAGNI', specContent.includes('YAGNI'));

  // Check CLAUDE.md content
  const claudeMd = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8');
  check('CLAUDE.md 包含 Ponytail 阶梯', claudeMd.includes('7-Level Priority Ladder'));
  check('CLAUDE.md 包含优先级体系', claudeMd.includes('Priority System'));
  check('CLAUDE.md 包含 MCP Server 配置', claudeMd.includes('MCP Server'));
  check('CLAUDE.md 包含 Knowledge Layer', claudeMd.includes('Knowledge Layer'));

  // 3. Doctor
  console.log('\n▶ doctor 环境诊断');
  const docOut = run('doctor', projectDir);
  check('doctor 输出标题', docOut.includes('MumuSpec Doctor'));
  check('doctor 显示 Node.js 版本', docOut.includes('Node.js'));
  check('doctor 显示 Project root: ✓', docOut.includes('Project root: ') && docOut.includes('✓'));
  check('doctor 显示 Config: ✓', docOut.includes('Config: ✓'));
  check('doctor 显示 Root spec: ✓', docOut.includes('Root spec: ✓'));
  check('doctor 显示 Rules 文件状态', docOut.includes('CLAUDE.md') && docOut.includes('✓'));

  // 4. Context
  console.log('\n▶ context 渐进式披露');
  const ctxOut = run('context .', projectDir);
  check('context 输出 Spec Context 标题', ctxOut.includes('Spec Context'));
  check('context 显示 Level 0', ctxOut.includes('Level 0'));
  check('context 显示 SHALL', ctxOut.includes('SHALL'));

  const ctxJson = run('context . --json', projectDir);
  check('context --json 输出有效 JSON', (() => { try { JSON.parse(ctxJson); return true; } catch { return false; } })());

  // 5. Search
  console.log('\n▶ search 规范搜索');
  const searchOut = run('search "Ponytail"', projectDir);
  check('search 找到 Ponytail 结果', searchOut.includes('Ponytail'));
  check('search 显示结果数量', searchOut.includes('result'));

  // 6. Validate
  console.log('\n▶ validate 规范校验');
  const valOut = run('validate', projectDir);
  check('validate 执行成功', valOut !== undefined);
  const valJson = run('validate --json', projectDir);
  check('validate --json 输出有效 JSON', (() => { try { JSON.parse(valJson); return true; } catch { return false; } })());

  // 7. Check
  console.log('\n▶ check 合规检查');
  const checkOut = run('check', projectDir);
  check('check 执行成功', checkOut !== undefined);
  const checkJson = run('check --json', projectDir);
  check('check --json 输出有效 JSON', (() => { try { JSON.parse(checkJson); return true; } catch { return false; } })());

  const checkShallNot = run('check --shall-not', projectDir);
  check('check --shall-not 执行成功', checkShallNot !== undefined);

  const checkPonytail = run('check --ponytail', projectDir);
  check('check --ponytail 执行成功', checkPonytail !== undefined);

  // 8. Drift
  console.log('\n▶ drift 漂移检测');
  const driftOut = run('drift', projectDir);
  check('drift 执行成功', driftOut.includes('drift') || driftOut.includes('No drift'));
  const driftJson = run('drift --json', projectDir);
  check('drift --json 输出有效 JSON', (() => { try { JSON.parse(driftJson); return true; } catch { return false; } })());

  // 9. New / Status / List / State
  console.log('\n▶ 变更生命周期 (new/status/list/state)');
  const newOut = run('new feature-x --workflow full --scope src/api', projectDir);
  check('new 创建变更成功', newOut.includes('Change "feature-x" created'));
  check('new 显示 Workflow: full', newOut.includes('Workflow: full'));
  check('new 显示 Phase: open', newOut.includes('Phase: open'));
  check('new 创建变更目录', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x')));
  check('new 创建 proposal.md', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'proposal.md')));
  check('new 创建 delta-specs/ 目录', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'delta-specs')));
  check('new 创建 constraints/ 目录', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'constraints')));
  check('new 创建 test-cases/ 目录', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'test-cases')));
  check('new 创建 decisions.md', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'decisions.md')));
  check('new 创建 .mumuspec.yaml', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', '.mumuspec.yaml')));

  // Status
  const statusOut = run('status feature-x', projectDir);
  check('status 显示变更名', statusOut.includes('feature-x'));
  check('status 显示 Phase: open', statusOut.includes('Phase: open'));
  check('status 显示 Workflow: full', statusOut.includes('Workflow: full'));
  check('status 显示下一步', statusOut.includes('下一步'));

  // Status (active change auto-detect)
  const statusAuto = run('status', projectDir);
  check('status (无参数) 自动检测活跃变更', statusAuto.includes('feature-x'));

  // List
  const listOut = run('list', projectDir);
  check('list 显示活跃变更', listOut.includes('feature-x'));
  check('list 显示 phase', listOut.includes('open'));

  // State graph
  const graphOut = run('state graph feature-x', projectDir);
  check('state graph 显示当前状态', graphOut.includes('Current: open'));
  check('state graph 显示有效转换', graphOut.includes('Valid transitions'));

  // State next
  const nextOut = run('state next feature-x', projectDir);
  check('state next 建议下一阶段', nextOut.includes('design'));

  // State transition (requires --confirm for blocking point BP-3)
  const transOut = run('state transition feature-x design --confirm', projectDir);
  check('state transition open→design 成功', transOut.includes('open → design'));
  check('state transition 显示 BP-3 阻塞点通过', transOut.includes('BP-3'));

  // Verify transition
  const statusAfter = run('status feature-x', projectDir);
  check('transition 后 phase 为 design', statusAfter.includes('Phase: design'));

  // 10. Test cases
  console.log('\n▶ test-cases 测试用例管理');
  run('test-cases init feature-x --layers 0,1', projectDir);
  check('test-cases init 创建 layer-0-cases.md', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'test-cases', 'layer-0-cases.md')));
  check('test-cases init 创建 layer-1-cases.md', existsSync(join(projectDir, '.mumuspec', 'changes', 'feature-x', 'test-cases', 'layer-1-cases.md')));

  const lockOut = run('test-cases lock feature-x', projectDir);
  check('test-cases lock 成功', lockOut.includes('locked'));
  check('test-cases lock 显示 hash', lockOut.includes('Hash:'));

  const verifyOut = run('test-cases verify feature-x', projectDir);
  check('test-cases verify 成功', verifyOut.includes('verified'));

  // 11. Guard
  console.log('\n▶ guard Phase Guard');
  const guardOut = run('guard feature-x build', projectDir, { expectError: true });
  check('guard 执行并返回结果', guardOut !== undefined);

  // 12. add-spec
  console.log('\n▶ add-spec 添加规范');
  const addSpecOut = run('add-spec src/api --type shall --requirement "API Security" --text "必须使用HTTPS"', projectDir);
  check('add-spec 执行成功', addSpecOut.includes('Added'));
  check('add-spec 创建子层 .mumuspec', existsSync(join(projectDir, 'src', 'api', '.mumuspec', 'spec.md')));

  // 13. Hotfix workflow
  console.log('\n▶ hotfix 预设路径');
  run('discard feature-x --reason "testing hotfix"', projectDir);
  const hotfixOut = run('new hotfix-1 --workflow hotfix', projectDir);
  check('new --workflow hotfix 创建成功', hotfixOut.includes('Change "hotfix-1" created'));
  check('hotfix 显示 Workflow: hotfix', hotfixOut.includes('Workflow: hotfix'));

  const hotfixStatus = run('status hotfix-1', projectDir);
  check('hotfix 跳过 Design (建议直接 build)', hotfixStatus.includes('build'));

  // 14. Single active change constraint
  console.log('\n▶ 单活跃变更约束');
  let blocked = false;
  try {
    run('new blocked-change --workflow full', projectDir);
  } catch {
    blocked = true;
  }
  check('已有活跃变更时阻止创建新变更', blocked);

  // 15. Discard
  console.log('\n▶ discard 废弃变更');
  const discardOut = run('discard hotfix-1 --reason "test complete"', projectDir);
  check('discard 成功', discardOut.includes('discarded'));
  const listAfter = run('list', projectDir);
  check('discard 后无活跃变更', listAfter.includes('No active changes'));

  // 16. Knowledge
  console.log('\n▶ knowledge 知识管理');
  const kListOut = run('knowledge list', projectDir);
  check('knowledge list (空) 执行成功', kListOut.includes('No knowledge pages'));

  const kVerifyOut = run('knowledge verify --all', projectDir);
  check('knowledge verify --all 执行成功', kVerifyOut !== undefined);

  const kStaleOut = run('knowledge stale', projectDir);
  check('knowledge stale 执行成功', kStaleOut !== undefined);

} finally {
  rmSync(projectDir, { recursive: true, force: true });
}

// ============================================================
// MCP Server 验证
// ============================================================
console.log('\n═══════════════════════════════════════════');
console.log('  MCP Server 协议 + 工具调用验证');
console.log('═══════════════════════════════════════════\n');

const mcpProjectDir = mkdtempSync(join(tmpdir(), 'mumuspec-mcp-'));
run(`init "${mcpProjectDir}" --name mcp-test`, mcpProjectDir);
run('new test-change --workflow full', mcpProjectDir);

const server = spawn('node', [MCP], {
  env: { ...process.env, MUMUSPEC_ROOT: mcpProjectDir },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let mcpOutput = '';
server.stdout.on('data', (data) => { mcpOutput += data.toString(); });
server.stderr.on('data', () => {});

function sendMCP(msg: object) {
  server.stdin.write(JSON.stringify(msg) + '\n');
}

// 1. Initialize
sendMCP({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'verify', version: '1.0' } },
});

// 2. List tools
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
}, 300);

// 3. Call get_spec_context
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_spec_context', arguments: { path: '.' } } });
}, 600);

// 4. Call search_specs
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_specs', arguments: { keyword: 'Ponytail' } } });
}, 900);

// 5. Call get_prohibitions
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_prohibitions', arguments: { path: '.' } } });
}, 1200);

// 6. Call list_changes
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_changes', arguments: {} } });
}, 1500);

// 7. Call get_change_status
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'get_change_status', arguments: { name: 'test-change' } } });
}, 1800);

// 8. Call validate_specs
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'validate_specs', arguments: {} } });
}, 2100);

// 9. Call detect_drift
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'detect_drift', arguments: {} } });
}, 2400);

// 10. Call check_compliance
setTimeout(() => {
  sendMCP({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'check_compliance', arguments: { shallNot: true } } });
}, 2700);

// Collect and verify
setTimeout(() => {
  server.kill();
  rmSync(mcpProjectDir, { recursive: true, force: true });

  const lines = mcpOutput.split('\n').filter(l => l.trim());
  const responses = new Map<number, any>();
  
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.id) responses.set(msg.id, msg);
    } catch {}
  }

  console.log('▶ MCP 协议握手');
  const initResp = responses.get(1);
  check('initialize 返回 serverInfo', !!initResp?.result?.serverInfo);
  check('serverInfo.name = mumuspec', initResp?.result?.serverInfo?.name === 'mumuspec');
  check('serverInfo.version = 0.10.0', initResp?.result?.serverInfo?.version === '0.10.0');

  console.log('\n▶ tools/list 工具列表');
  const toolsResp = responses.get(2);
  const tools = toolsResp?.result?.tools || [];
  check('工具数量 = 14', tools.length === 14, `got ${tools.length}`);
  
  const toolNames = tools.map((t: any) => t.name);
  const expectedTools = [
    'get_spec_context', 'search_specs', 'get_prohibitions', 'get_design_context',
    'check_compliance', 'detect_drift', 'guard_check',
    'get_change_status', 'list_changes',
    'get_knowledge_context', 'search_knowledge', 'get_knowledge_page', 'verify_knowledge',
    'validate_specs',
  ];
  for (const t of expectedTools) {
    check(`工具 ${t} 存在`, toolNames.includes(t));
  }

  console.log('\n▶ tools/call 工具调用');
  
  const ctxResp = responses.get(3);
  check('get_spec_context 返回结果', !ctxResp?.error && !!ctxResp?.result);
  const ctxText = ctxResp?.result?.content?.[0]?.text || '';
  check('get_spec_context 包含 layers', ctxText.includes('layers'));

  const searchResp = responses.get(4);
  check('search_specs 返回结果', !searchResp?.error);
  const searchText = searchResp?.result?.content?.[0]?.text || '';
  check('search_specs 包含 Ponytail', searchText.includes('Ponytail'));

  const prohResp = responses.get(5);
  check('get_prohibitions 返回结果', !prohResp?.error);
  const prohText = prohResp?.result?.content?.[0]?.text || '';
  check('get_prohibitions 包含 prohibitions', prohText.includes('prohibitions') || prohText.includes('禁止'));

  const listResp = responses.get(6);
  check('list_changes 返回结果', !listResp?.error);
  const listText = listResp?.result?.content?.[0]?.text || '';
  check('list_changes 包含 test-change', listText.includes('test-change'));

  const changeResp = responses.get(7);
  check('get_change_status 返回结果', !changeResp?.error);
  const changeText = changeResp?.result?.content?.[0]?.text || '';
  check('get_change_status 包含 phase: open', changeText.includes('open'));

  const valResp = responses.get(8);
  check('validate_specs 返回结果', !valResp?.error);

  const driftResp = responses.get(9);
  check('detect_drift 返回结果', !driftResp?.error);

  const compResp = responses.get(10);
  check('check_compliance 返回结果', !compResp?.error);

  // ============================================================
  // 最终报告
  // ============================================================
  console.log('\n═══════════════════════════════════════════');
  console.log('  验证总结');
  console.log('═══════════════════════════════════════════');
  console.log(`  通过: ${passed}`);
  console.log(`  失败: ${failed}`);
  console.log(`  总计: ${passed + failed}`);
  console.log(`  通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n  失败项:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ✗ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════\n');
  
  process.exit(failed > 0 ? 1 : 0);
}, 3500);
