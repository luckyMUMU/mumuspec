/**
 * Proposal parsing — `## User Decisions` section (lightweight-freeze-gate).
 *
 * Proposal 可在 `## User Decisions` 段声明影响可见结果的用户决策；`- [blocking]`
 * 前缀条目为阻塞性决策，进入 build 前须经 decisions.md 逐项签收。纯函数，无 IO。
 */

/** A user decision declared in the proposal's `## User Decisions` section. */
export interface UserDecision {
  /** Decision text (bullet body, whitespace-trimmed). */
  text: string;
  /** Whether the item was marked `[blocking]` — requires signoff before build. */
  blocking: boolean;
}

const USER_DECISIONS_RE = /^##\s+User\s+Decisions\s*$/m;
const NEXT_HEADING_RE = /^##\s+/m;
const BLOCKING_BULLET_RE = /^-\s+\[blocking\]\s+(.+)$/;
const PLAIN_BULLET_RE = /^-\s+(.+)$/;

/** Whitespace-normalize text for signoff matching（换行/缩进不影响判定）. */
function normalize(s: string): string {
  return (s ?? '').replace(/\s+/g, '').trim();
}

/**
 * Parse the `## User Decisions` section of a proposal.
 *
 * Bullets until the next `## ` heading; `- [blocking] <text>` → blocking,
 * `- <text>` → non-blocking. Absent section → `[]`（无声明即无门禁）。
 */
export function parseUserDecisions(proposalMarkdown: string): UserDecision[] {
  const body = proposalMarkdown ?? '';
  const sectionStart = body.search(USER_DECISIONS_RE);
  if (sectionStart === -1) return [];

  const headEnd = body.indexOf('\n', sectionStart);
  if (headEnd === -1) return [];

  let sectionBody = body.slice(headEnd + 1);
  const nextHeading = sectionBody.search(NEXT_HEADING_RE);
  if (nextHeading !== -1) sectionBody = sectionBody.slice(0, nextHeading);

  const decisions: UserDecision[] = [];
  for (const rawLine of sectionBody.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const blockingMatch = line.match(BLOCKING_BULLET_RE);
    if (blockingMatch) {
      decisions.push({ text: blockingMatch[1].trim(), blocking: true });
      continue;
    }
    const plainMatch = line.match(PLAIN_BULLET_RE);
    if (plainMatch) {
      decisions.push({ text: plainMatch[1].trim(), blocking: false });
    }
  }
  return decisions;
}

/**
 * Blocking decisions with no signoff in decisions.md.
 *
 * Signoff = the (whitespace-normalized) item text appears in the decisions
 * content — human appends a decision referencing the item via
 * `mumuspec decisions append`. Substring matching keeps long human sentences
 * from false-failing (whitespace/tone variants still match).
 */
export function unsignedBlockingDecisions(
  decisionsContent: string,
  blocking: UserDecision[],
): UserDecision[] {
  const haystack = normalize(decisionsContent);
  if (!haystack) return blocking;
  return blocking.filter((d) => !haystack.includes(normalize(d.text)));
}