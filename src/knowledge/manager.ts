/**
 * Knowledge module — barrel re-export hub.
 * Individual functions are organized by domain:
 * - pages: CRUD operations for knowledge pages
 * - index: PageIndex and reverse-index management
 * - freshness: verification, staleness, supersession
 * - analysis: impact analysis, coverage, chat, onboarding
 * - organize: knowledge audit and auto-fix utilities
 * 
 * All imports from this file remain fully backward compatible.
 */
export {
  getKnowledgeDir,
  listKnowledgePages,
  loadKnowledgePage,
  getKnowledgePage,
  searchKnowledge,
  getKnowledgeContext,
  createKnowledgePage,
} from './pages.js';

export {
  loadPageIndex,
  rebuildPageIndex,
  rebuildReverseIndex,
  updatePageIndex,
  readReverseIndex,
} from './index.js';

export {
  verifyKnowledge,
  listStalePages,
  supersedeKnowledge,
} from './freshness.js';

export {
  analyzeImpact,
  generateOnboardingPath,
  analyzeCoverage,
  answerQuery,
  getDashboardData,
} from './analysis.js';

export {
  organizeKnowledge,
} from './organize.js';
