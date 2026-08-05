/**
 * Git History Scanner — mine knowledge from git commit history.
 * 
 * Extracts lessons, risks, and decisions from:
 * - Revert commits (failure patterns)
 * - Hotspot files (frequently changed = potential design issues)
 * - Commit message patterns (decisions, fixes)
 * - Author distribution (ownership patterns)
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProposedKnowledgePage, GitKnowledgePattern } from '../scan-types.js';

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `KS-GIT-${String(idCounter).padStart(4, '0')}`;
}

/** Git commit entry */
interface GitCommit {
  hash: string;
  date: string;
  author: string;
  message: string;
}

/** File change frequency entry */
interface FileChangeFrequency {
  file: string;
  count: number;
}

/** Commit message patterns that indicate knowledge-worthy events */
const GIT_PATTERNS: GitKnowledgePattern[] = [
  // Revert patterns → lessons
  {
    pattern: /^revert/i,
    type: 'lesson',
    titleTemplate: '回退事件: 设计或实现存在缺陷',
    contentTemplate: 'Git 历史中检测到回退 (Revert) 提交。回退通常意味着：\n1. 实现逻辑有缺陷\n2. 设计了不兼容的接口变更\n3. 缺少足够的测试覆盖\n\n建议回顾回退原因，避免重复同类错误。',
  },
  // Migration patterns → decisions
  {
    pattern: /migration|migrate/i,
    type: 'decision',
    titleTemplate: '数据/结构迁移决策',
    contentTemplate: 'Git 历史中包含迁移相关提交，表明项目经历过数据格式或架构的演进。迁移操作需关注：\n1. 向后兼容性\n2. 回滚策略\n3. 数据一致性验证',
  },
  // Hotfix patterns → risks
  {
    pattern: /hotfix|urgent fix|production fix/i,
    type: 'risk',
    titleTemplate: '生产环境紧急修复风险',
    contentTemplate: 'Git 历史中存在紧急修复 (hotfix) 提交，暗示：\n1. 相关模块可能缺乏充分的上线前测试\n2. 技术债积累导致脆弱性\n3. 监控告警可能不到位\n\n建议评估紧急修复的根因并加强预防措施。',
  },
  // Deprecation patterns → decisions
  {
    pattern: /deprecat/i,
    type: 'decision',
    titleTemplate: '功能/接口废弃决策',
    contentTemplate: 'Git 历史中存在功能废弃 (deprecation) 标记，说明项目有意识地进行 API 演进。废弃操作需关注：\n1. 废弃公告和过渡期\n2. 迁移指南\n3. 彻底清理时间表',
  },
  // Breaking change patterns → risks
  {
    pattern: /breaking.?change|BREAKING/i,
    type: 'risk',
    titleTemplate: '存在破坏性变更风险',
    contentTemplate: 'Git 历史中提到破坏性变更，意味着 API 或接口签名发生了不兼容的修改。这会：\n1. 要求下游同步更新\n2. 需要版本号遵循 semver 规范\n3. 需要更充分的迁移沟通',
  },
];

/** Execute git command safely */
function gitExec(projectRoot: string, args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/** Check if project has git history */
function hasGitHistory(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.git'));
}

/** Get recent commit messages */
function getRecentCommits(projectRoot: string, limit: number = 50): GitCommit[] {
  const output = gitExec(projectRoot, `log --max-count=${limit} --format="%h|%aI|%an|%s"`);
  if (!output) return [];

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] ?? '',
        date: parts[1] ?? '',
        author: parts[2] ?? '',
        message: parts[3] ?? '',
      };
    });
}

/** Get frequently changed files (hotspots) */
function getHotspotFiles(projectRoot: string, limit: number = 10): FileChangeFrequency[] {
  const output = gitExec(projectRoot, `log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -${limit}`);
  if (!output) return [];

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) return null;
      return { file: match[2]!, count: parseInt(match[1]!, 10) };
    })
    .filter((x): x is FileChangeFrequency => x !== null && x.file !== '');
}

/** Get overall git stats */
function getGitStats(projectRoot: string): {
  totalCommits: number;
  totalAuthors: number;
  ageInDays: number;
} {
  const totalOutput = gitExec(projectRoot, 'rev-list --count HEAD');
  const totalCommits = parseInt(totalOutput, 10) || 0;

  const authorsOutput = gitExec(projectRoot, 'log --format="%an" | sort -u');
  const totalAuthors = authorsOutput ? authorsOutput.split('\n').filter(Boolean).length : 0;

  const firstCommitOutput = gitExec(projectRoot, 'log --reverse --format="%aI" | head -1');
  let ageInDays = 0;
  if (firstCommitOutput) {
    const firstDate = new Date(firstCommitOutput);
    const now = new Date();
    ageInDays = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return { totalCommits, totalAuthors, ageInDays };
}

/** Scan git history and propose knowledge */
export function scanGitHistory(projectRoot: string): ProposedKnowledgePage[] {
  idCounter = 0;
  const proposed: ProposedKnowledgePage[] = [];

  if (!hasGitHistory(projectRoot)) return proposed;

  // Get recent commits
  const commits = getRecentCommits(projectRoot, 50);

  // Pattern matching commits
  const matchedPatterns = new Set<string>();
  for (const commit of commits) {
    for (const pattern of GIT_PATTERNS) {
      if (pattern.pattern.test(commit.message)) {
        const key = pattern.titleTemplate;
        if (!matchedPatterns.has(key)) {
          matchedPatterns.add(key);
          proposed.push({
            id: generateId(),
            title: pattern.titleTemplate,
            type: pattern.type,
            scope: '.',
            content: `${pattern.contentTemplate}\n\n相关提交示例：\n- ${commit.hash}: ${commit.message}`,
            tags: ['git-history', pattern.type],
            graph_bindings: [],
            confidence: 'medium',
            source: 'git',
            evidence: `匹配提交: ${commit.hash} - ${commit.message}`,
          });
        }
      }
    }
  }

  // Detect hotspot files
  const hotspots = getHotspotFiles(projectRoot, 5);
  if (hotspots.length > 0) {
    const highFrequency = hotspots.filter((h) => h.count >= 5);
    if (highFrequency.length > 0) {
      const hotfileList = highFrequency.map((h) => `  - ${h.file} (${h.count}次变更)`).join('\n');
      proposed.push({
        id: generateId(),
        title: `文件变更热点：${highFrequency.length} 个高频修改文件`,
        type: 'risk',
        scope: '.',
        content: `以下文件在近期被频繁修改，可能表明：\n1. 接口设计仍在演进中\n2. 模块职责可能不够清晰\n3. 可能存在设计缺陷\n\n高频变更文件：\n${hotfileList}\n\n建议评估这些文件的稳定性，必要时进行重构或接口冻结。`,
        tags: ['git-history', 'hotspot', 'risk', 'refactoring'],
        graph_bindings: highFrequency.map((h) => h.file),
        confidence: 'medium',
        source: 'git',
        evidence: `变更频率最高: ${hotspots[0]?.file} (${hotspots[0]?.count}次)`,
      });
    }
  }

  // Detect project maturity signals
  const stats = getGitStats(projectRoot);
  if (stats.totalCommits > 100 && stats.totalAuthors === 1) {
    proposed.push({
      id: generateId(),
      title: '项目当前只有单一维护者，存在知识单点风险',
      type: 'risk',
      scope: '.',
      content: `Git 历史显示项目由单一作者维护 (${stats.totalCommits} 个提交)。这存在风险：\n1. 设计决策和隐性知识集中在个人\n2. 人员变动可能导致项目不可维护\n3. 缺乏 Code Review 的多视角校验\n\n建议：加强文档记录、鼓励贡献者参与、关键决策写入知识库。`,
      tags: ['git-history', 'risk', 'maintenance', 'knowledge-silo'],
      graph_bindings: [],
      confidence: 'medium',
      source: 'git',
      evidence: `提交数: ${stats.totalCommits}, 作者数: ${stats.totalAuthors}`,
    });
  }

  return proposed;
}
