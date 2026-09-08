/**
 * Feedback Manager — 用户反馈与 Session 摘要的收集、关联、查询
 *
 * 核心能力：
 * - submitFeedback(): 用户主动提交反馈，格式化记录 + 自动关联 session
 * - linkFeedbackToSession() / linkFeedbackToChange(): 建立反馈与 session / 变更的双向关联
 * - listChangeFeedbacks() / listAllFeedbacks(): 按变更 / 时间 / 类型查询反馈
 * - getFeedbackContent() / getChangeFeedbackLog(): 读取反馈正文与变更反馈日志
 * - updateFeedbackStatus(): 流转反馈处理状态
 * - createSessionSummary(): 归档 session 摘要并与反馈互链
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { UserFeedback, FeedbackEntry, FeedbackLog, FeedbackStatus } from '../core/types.js';
import { readYaml, writeYaml, readText, writeText, ensureDir, computeHash, now, appendAuditLog, getMumuSpecDir, parseFrontmatter } from '../core/utils.js';
import { getChangeDir } from '../change/paths.js';

// ========== 目录路径 ==========

/** 获取项目 feedback 目录（位于 .mumuspec/feedback/） */
export function getFeedbackDir(projectRoot: string): string {
  return join(getMumuSpecDir(projectRoot), 'feedback');
}

/** 获取用户反馈存储目录 */
export function getUserFeedbackDir(projectRoot: string): string {
  return join(getFeedbackDir(projectRoot), 'user');
}

/** 获取 session 摘要存储目录 */
export function getSessionSummaryDir(projectRoot: string): string {
  return join(getFeedbackDir(projectRoot), 'sessions');
}

/** 获取变更专属的反馈目录 */
export function getChangeFeedbackDir(projectRoot: string, changeName: string): string {
  return join(getChangeDir(projectRoot, changeName), 'feedback');
}

/** 获取反馈索引文件路径 */
export function getFeedbackIndexPath(projectRoot: string): string {
  return join(getFeedbackDir(projectRoot), 'index.yaml');
}

/** 获取 session 索引进出口径 */
export function getSessionIndexPath(projectRoot: string): string {
  return join(getSessionSummaryDir(projectRoot), '.index.yaml');
}

// ========== 提交反馈 ==========

export interface SubmitFeedbackOptions {
  /** 反馈类型 */
  type: 'bug' | 'feature-request' | 'improvement' | 'question' | 'design-review';
  /** 严重程度 */
  severity?: 'critical' | 'major' | 'minor' | 'info';
  /** 提交者 */
  submitter?: string;
  /** 关联的变更名称 */
  changeName?: string;
  /** 关联的 session ID */
  sessionId?: string;
  /** 标题 */
  title: string;
  /** 期望行为 */
  expected?: string;
  /** 实际行为 */
  actual?: string;
  /** 详细说明 */
  detail?: string;
  /** 影响范围 */
  impact?: string;
  /** 改进建议 */
  suggestion?: string;
  /** 关联的设计文档路径 */
  designRef?: string;
}

/**
 * 提交一条用户反馈，以格式化 Markdown 文件存储。
 * 自动与 session 摘要建立关联（如果提供 sessionId）。
 */
export function submitFeedback(
  projectRoot: string,
  options: SubmitFeedbackOptions,
): { feedbackId: string; filePath: string } {
  const feedbackDir = getUserFeedbackDir(projectRoot);
  ensureDir(feedbackDir);

  // 生成反馈 ID: FB-YYYYMMDD-<hash>
  const date = now().split('T')[0].replace(/-/g, '');
  const hashInput = `${options.title}${now()}`;
  const hash = computeHash(hashInput).substring(0, 8);
  const feedbackId = `FB-${date}-${hash}`;

  const filename = `${now().split('T')[0]}-${slugify(options.title)}.md`;
  const filePath = join(feedbackDir, filename);

  // 构建 Markdown 内容
  const frontmatter: Record<string, unknown> = {
    feedback_id: feedbackId,
    date: now().split('T')[0],
    submitter: options.submitter || 'anonymous',
    type: options.type,
    severity: options.severity || 'minor',
    title: options.title,
  };

  if (options.changeName) {
    frontmatter.change_name = options.changeName;
  }
  if (options.sessionId) {
    frontmatter.session_id = options.sessionId;
  }
  if (options.designRef) {
    frontmatter.design_ref = options.designRef;
  }

  const content = buildFeedbackMarkdown(frontmatter, options);
  writeText(filePath, content);

  // 更新反馈索引
  appendFeedbackToIndex(projectRoot, {
    id: feedbackId,
    date: frontmatter.date as string,
    title: options.title,
    type: options.type,
    severity: frontmatter.severity as string,
    submitter: frontmatter.submitter as string,
    changeName: options.changeName,
    sessionId: options.sessionId,
    file: relative(projectRoot, filePath),
    status: 'open',
  });

  // 如果关联更新，建立双向链接
  if (options.changeName) {
    linkFeedbackToChange(projectRoot, options.changeName, feedbackId, filename);
  }
  if (options.sessionId) {
    linkFeedbackToSession(projectRoot, options.sessionId, feedbackId, filename);
  }

  // Audit log
  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: options.submitter || 'anonymous',
    action: 'feedback.submit',
    feedback: feedbackId,
    result: 'success',
    change: options.changeName,
    session: options.sessionId,
  });

  return { feedbackId, filePath };
}

// ========== Session 关联 ==========

/**
 * 在 session 摘要中追加关联的用户反馈引用。
 */
export function linkFeedbackToSession(
  projectRoot: string,
  sessionId: string,
  feedbackId: string,
  feedbackFile: string,
): void {
  const sessionsDir = getSessionSummaryDir(projectRoot);
  if (!existsSync(sessionsDir)) return;

  // 查找匹配的 session 摘要文件
  const files = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = join(sessionsDir, file);
    const content = readText(filePath);
    if (!content) continue;

    // 检查 frontmatter 中是否包含该 session_id
    if (content.includes(`session_id: ${sessionId}`) || content.includes(`session_id: "${sessionId}"`)) {
      // 在文件末尾追加反馈关联引用
      const linkSection = `\n\n<!-- feedback-link: ${feedbackId} -->\n> 📎 **用户反馈关联**: [${feedbackId}](${feedbackFile})\n> 提交时间: ${now().split('T')[0]}\n`;
      if (!content.includes(`feedback-link: ${feedbackId}`)) {
        writeText(filePath, content + linkSection);
      }
      break;
    }
  }
}

/**
 * 在变更的 feedback_log 中追加反馈引用。
 */
export function linkFeedbackToChange(
  projectRoot: string,
  changeName: string,
  feedbackId: string,
  feedbackFile: string,
): void {
  const changeDir = getChangeFeedbackDir(projectRoot, changeName);
  ensureDir(changeDir);

  // 写入变更专属的反馈引用文件
  const linkPath = join(changeDir, `${feedbackId}.yaml`);
  writeYaml(linkPath, {
    feedback_id: feedbackId,
    linked_at: now(),
    file: feedbackFile,
    acknowledged: false,
  });
}

/**
 * 创建 Session 摘要（简化版 CLI 辅助工具）。
 */
export interface CreateSessionSummaryOptions {
  sessionId: string;
  agent: string;
  agentVersion?: string;
  projectType?: string;
  changeType: string;
  durationMinutes?: number;
  outcome: 'success' | 'partial' | 'failure' | 'abandoned';
  title: string;
  changeName?: string;
  /** 关联的用户反馈 IDs */
  feedbackIds?: string[];
  /** 生成的关键工件摘要 */
  artifactSummary?: string;
  /** 观察到的主要模式/问题 */
  patternsObserved?: string[];
}

/**
 * 创建 session 摘要文件。
 */
export function createSessionSummary(
  projectRoot: string,
  options: CreateSessionSummaryOptions,
): { sessionId: string; filePath: string } {
  const sessionsDir = getSessionSummaryDir(projectRoot);
  ensureDir(sessionsDir);

  const filename = `${now().split('T')[0]}-${slugify(options.title)}.md`;
  const filePath = join(sessionsDir, filename);

  const frontmatter: Record<string, unknown> = {
    date: now().split('T')[0],
    session_id: options.sessionId,
    agent: options.agent,
    agent_version: options.agentVersion || 'unknown',
    mumuspec_version: '0.12.1-alpha.0',
    project_type: options.projectType || 'brownfield',
    change_type: options.changeType,
    duration_minutes: options.durationMinutes || 0,
    outcome: options.outcome,
    title: options.title,
  };

  if (options.changeName) {
    frontmatter.change_name = options.changeName;
  }
  if (options.feedbackIds && options.feedbackIds.length > 0) {
    frontmatter.feedback_ids = options.feedbackIds;
  }

  const content = buildSessionSummaryMarkdown(frontmatter, options);
  writeText(filePath, content);

  // 更新 session 索引
  appendSessionToIndex(projectRoot, {
    session_id: options.sessionId,
    date: frontmatter.date as string,
    title: options.title,
    changeName: options.changeName,
    outcome: options.outcome,
    file: relative(projectRoot, filePath),
  });

  return { sessionId: options.sessionId, filePath };
}

// ========== 查询 ==========

/** 列出与特定变更关联的所有反馈 */
export function listChangeFeedbacks(projectRoot: string, changeName: string): FeedbackEntry[] {
  const changeFeedbackDir = getChangeFeedbackDir(projectRoot, changeName);
  if (!existsSync(changeFeedbackDir)) return [];

  const results: FeedbackEntry[] = [];
  const entries = readdirSync(changeFeedbackDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.yaml')) {
      const data = readYaml<{
        feedback_id: string;
        linked_at: string;
        file: string;
        acknowledged: boolean;
      }>(join(changeFeedbackDir, entry.name));
      if (data) {
        results.push({
          id: data.feedback_id,
          date: data.linked_at.split('T')[0],
          title: '',  // 需要从完整反馈文件中读取
          type: 'improvement',
          severity: 'minor',
          submitter: '',
          changeName,
          file: data.file,
          status: data.acknowledged ? 'acknowledged' : 'open',
        });
      }
    }
  }

  // 补充完整标题（从用户反馈文件中读取）
  for (const entry of results) {
    const fullPath = join(projectRoot, entry.file);
    const content = readText(fullPath);
    if (content) {
      const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);
      if (titleMatch) entry.title = titleMatch[1];
      const typeMatch = content.match(/type:\s*(\w[\w-]*)/);
      if (typeMatch) entry.type = typeMatch[1] as FeedbackEntry['type'];
    }
  }

  return results;
}

/** 列出所有反馈（按时间倒序） */
export function listAllFeedbacks(projectRoot: string, options?: {
  status?: string;
  type?: string;
  changeName?: string;
}): FeedbackEntry[] {
  const index = loadFeedbackIndex(projectRoot);
  let feedbacks = index.entries || [];

  if (options?.status) {
    feedbacks = feedbacks.filter(f => f.status === options.status);
  }
  if (options?.type) {
    feedbacks = feedbacks.filter(f => f.type === options.type);
  }
  if (options?.changeName) {
    feedbacks = feedbacks.filter(f => f.changeName === options.changeName);
  }

  // 按日期倒序
  return feedbacks.sort((a, b) => b.date.localeCompare(a.date));
}

/** 获取反馈的完整内容 */
export function getFeedbackContent(projectRoot: string, feedbackId: string): UserFeedback | undefined {
  const feedbackDir = getUserFeedbackDir(projectRoot);
  if (!existsSync(feedbackDir)) return undefined;

  const files = readdirSync(feedbackDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = join(feedbackDir, file);
    const content = readText(filePath);
    if (!content) continue;

    if (content.includes(`feedback_id: ${feedbackId}`)) {
      const { frontmatter, body } = parseFeedbackContent(content);
      const fm = frontmatter || {};
      return {
        id: feedbackId,
        date: (fm.date as string) || '',
        submitter: (fm.submitter as string) || '',
        type: (fm.type as UserFeedback['type']) || 'question',
        severity: (fm.severity as UserFeedback['severity']) || 'minor',
        title: (fm.title as string) || '',
        changeName: fm.change_name as string | undefined,
        sessionId: fm.session_id as string | undefined,
        designRef: fm.design_ref as string | undefined,
        filePath: relative(projectRoot, filePath),
        body,
        expected: fm.expected as string | undefined,
        actual: fm.actual as string | undefined,
        impact: fm.impact as string | undefined,
        suggestion: fm.suggestion as string | undefined,
        status: (fm.status as FeedbackStatus) || 'open',
      };
    }
  }
  return undefined;
}

/** 更新反馈状态 */
export function updateFeedbackStatus(
  projectRoot: string,
  feedbackId: string,
  status: 'open' | 'acknowledged' | 'in-progress' | 'resolved' | 'declined',
  reason?: string,
): void {
  const feedbackDir = getUserFeedbackDir(projectRoot);
  if (!existsSync(feedbackDir)) return;

  const files = readdirSync(feedbackDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = join(feedbackDir, file);
    let content = readText(filePath);
    if (!content) continue;

    if (content.includes(`feedback_id: ${feedbackId}`)) {
      // 更新 frontmatter 状态
      content = content.replace(
        /status:\s*\w+/,
        `status: ${status}`,
      );
      if (reason) {
        content += `\n\n---\n\n**状态变更 (${now().split('T')[0]})**: ${status}\n原因: ${reason}\n`;
      }
      writeText(filePath, content);
      break;
    }
  }

  // 更新索引
  const index = loadFeedbackIndex(projectRoot);
  const entry = index.entries?.find(e => e.id === feedbackId);
  if (entry) {
    entry.status = status;
    saveFeedbackIndex(projectRoot, index);
  }
}

/** 加载变更的 feedback_log */
export function getChangeFeedbackLog(projectRoot: string, changeName: string): FeedbackLog {
  const changeDir = getChangeFeedbackDir(projectRoot, changeName);
  const logPath = join(changeDir, 'feedback-log.yaml');

  if (!existsSync(logPath)) {
    return {
      entries: [],
      session_links: [],
      last_updated: now(),
    };
  }

  return readYaml<FeedbackLog>(logPath) || {
    entries: [],
    session_links: [],
    last_updated: now(),
  };
}

// ========== 索引管理 ==========

interface FeedbackIndex {
  version: string;
  last_updated: string;
  entries: Array<{
    id: string;
    date: string;
    title: string;
    type: string;
    severity: string;
    submitter: string;
    changeName?: string;
    sessionId?: string;
    file: string;
    status: string;
  }>;
}

function loadFeedbackIndex(projectRoot: string): FeedbackIndex {
  const indexPath = getFeedbackIndexPath(projectRoot);
  if (!existsSync(indexPath)) {
    return { version: '1.0', last_updated: now(), entries: [] };
  }
  return readYaml<FeedbackIndex>(indexPath) || { version: '1.0', last_updated: now(), entries: [] };
}

function saveFeedbackIndex(projectRoot: string, index: FeedbackIndex): void {
  index.last_updated = now();
  const indexPath = getFeedbackIndexPath(projectRoot);
  writeYaml(indexPath, index);
}

function appendFeedbackToIndex(projectRoot: string, entry: FeedbackIndex['entries'][0]): void {
  const index = loadFeedbackIndex(projectRoot);
  index.entries.push(entry);
  saveFeedbackIndex(projectRoot, index);
}

interface SessionIndex {
  version: string;
  last_updated: string;
  sessions: Array<{
    session_id: string;
    date: string;
    title: string;
    changeName?: string;
    outcome: string;
    file: string;
  }>;
}

function loadSessionIndex(projectRoot: string): SessionIndex {
  const indexPath = getSessionIndexPath(projectRoot);
  if (!existsSync(indexPath)) {
    return { version: '1.0', last_updated: now(), sessions: [] };
  }
  return readYaml<SessionIndex>(indexPath) || { version: '1.0', last_updated: now(), sessions: [] };
}

function saveSessionIndex(projectRoot: string, index: SessionIndex): void {
  index.last_updated = now();
  const indexPath = getSessionIndexPath(projectRoot);
  writeYaml(indexPath, index);
}

function appendSessionToIndex(projectRoot: string, entry: SessionIndex['sessions'][0]): void {
  const index = loadSessionIndex(projectRoot);
  index.sessions.push(entry);
  saveSessionIndex(projectRoot, index);
}

// ========== Markdown 构建 ==========

function buildFeedbackMarkdown(
  frontmatter: Record<string, unknown>,
  options: SubmitFeedbackOptions,
): string {
  const fm: Record<string, unknown> = { ...frontmatter };
  if (options.expected) fm.expected_summary = options.expected.substring(0, 100);
  if (options.actual) fm.actual_summary = options.actual.substring(0, 100);

  const yamlStr = Object.entries(fm)
    .map(([k, v]) => `${k}: ${typeof v === 'string' && v.includes(':') ? `"${v}"` : v}`)
    .join('\n');

  const lines: string[] = [
    '---',
    yamlStr,
    '---',
    '',
    `# ${options.title}`,
    '',
    `> **反馈 ID**: \`${frontmatter.feedback_id}\``,
    `> **类型**: ${options.type} | **严重程度**: ${options.severity || 'minor'}`,
    '',
  ];

  if (options.changeName) {
    lines.push(`**关联变更**: ${options.changeName}`);
  }
  if (options.sessionId) {
    lines.push(`**关联 Session**: ${options.sessionId}`);
  }
  if (options.designRef) {
    lines.push(`**关联设计**: ${options.designRef}`);
  }
  lines.push('');

  if (options.expected) {
    lines.push('## 期望行为', '', options.expected, '');
  }
  if (options.actual) {
    lines.push('## 实际行为', '', options.actual, '');
  }
  if (options.detail) {
    lines.push('## 详细说明', '', options.detail, '');
  }
  if (options.impact) {
    lines.push('## 影响范围', '', options.impact, '');
  }
  if (options.suggestion) {
    lines.push('## 改进建议', '', options.suggestion, '');
  }

  // 关联信息区块
  lines.push('---', '', '## 关联信息', '');
  if (options.changeName) {
    lines.push(`- **变更**: \`.mumuspec/changes/${options.changeName}/\``);
  }
  if (options.sessionId) {
    lines.push(`- **Session 摘要**: `);
  }
  lines.push('');

  return lines.join('\n');
}

function buildSessionSummaryMarkdown(
  frontmatter: Record<string, unknown>,
  options: CreateSessionSummaryOptions,
): string {
  const yamlStr = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map(item => `  - ${item}`).join('\n')}`;
      }
      return `${k}: ${typeof v === 'string' && v.includes(':') ? `"${v}"` : v}`;
    })
    .join('\n');

  const lines: string[] = [
    '---',
    yamlStr,
    '---',
    '',
    `# ${options.title}`,
    '',
    '## 会话摘要',
    '',
    options.artifactSummary || '(无摘要)',
    '',
  ];

  if (options.patternsObserved && options.patternsObserved.length > 0) {
    lines.push('## 观察到的模式', '');
    for (const pattern of options.patternsObserved) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  if (options.feedbackIds && options.feedbackIds.length > 0) {
    lines.push('## 关联用户反馈', '');
    for (const fid of options.feedbackIds) {
      lines.push(`- ${fid}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function parseFeedbackContent(content: string): { frontmatter: Record<string, unknown> | undefined; body: string } {
  return parseFrontmatter<Record<string, unknown>>(content);
}

// ========== 工具函数 ==========

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40)
    .replace(/-+$/, '');
}

// ========== Re-exports (兼容现有 feedback/ 目录结构) ==========

/**
 * 确保项目 .mumuspec/feedback/ 目录结构完整。
 * 在 init 时调用，也适用于首次使用 feedback 命令时自动创建。
 */
export function ensureFeedbackStructure(projectRoot: string): void {
  const baseDir = getFeedbackDir(projectRoot);
  ensureDir(join(baseDir, 'user'));
  ensureDir(join(baseDir, 'sessions'));
  ensureDir(join(baseDir, 'monthly'));

  // 初始化索引文件
  const indexPath = getFeedbackIndexPath(projectRoot);
  if (!existsSync(indexPath)) {
    writeYaml(indexPath, {
      version: '1.0',
      last_updated: now(),
      entries: [],
    });
  }

  const sessionIndexPath = getSessionIndexPath(projectRoot);
  if (!existsSync(sessionIndexPath)) {
    writeYaml(sessionIndexPath, {
      version: '1.0',
      last_updated: now(),
      sessions: [],
    });
  }
}
