# Boundary: src/meta-evolution

## 对外接口

```typescript
// — scoring.ts —
export function computeScore(passRate: number, falsePositiveRate: number, penaltyWeight?: number): number;
export function computeEffectivenessScores(records: CheckRecord[], config?, constraintIds?, excludeIds?): EffectivenessScore[];
export function generateReport(records: CheckRecord[], config?, excludeIds?): EvolutionReport;

// — knowledge-evolution.ts —
export function analyzeFreshness(page: PageRefInfo, thresholds?): KnowledgeEvolutionAction | null;
export function analyzeAllFreshness(pages: PageRefInfo[], thresholds?): KnowledgeEvolutionAction[];
export function refreshPageIndex(pageId: string): KnowledgeEvolutionAction;

// — skill-recommender.ts —
export function recommendSkills(scopes: string[], limit?, skillRegistry?): SkillRecommendResult;
export function recordRecommendationOutcome(skillId: string, adopted: boolean): void;
export function getRecommendationAccuracy(skillId: string): number | undefined;
export function clearTracking(): void;

// — impact-analysis.ts —
export const PRESERVATION_ANCHORS: string[];
export function analyzeImpact(report: EvolutionReport, knowledgeActions?): ImpactAnalysis;
export function formatImpactAnalysis(analysis: ImpactAnalysis): string;

// — stats.ts —
export function getStatsFilePath(projectRoot: string): string;
export function recordCheck(projectRoot: string, record: Omit<CheckRecord, 'timestamp'>): Promise<void>;
export function readCheckRecords(projectRoot: string): Promise<CheckRecord[]>;
export function rotateStatsIfNeeded(projectRoot: string): Promise<void>;
export function clearStats(projectRoot: string): Promise<void>;
```

## CLI 命令
- `mumuspec meta-evolve --analyze` — 输出 effectiveness score 报告
- `mumuspec meta-evolve --propose` — 生成优化提案 markdown
- `mumuspec meta-evolve --apply --confirm` — 安全应用（含 Goal Preservation）

## 依赖声明
| 依赖 | 类型 |
|------|------|
| node:fs/promises | 平台 |
| node:fs | 平台 |
| node:path | 平台 |
| ../core/utils.js | 内部（readText, writeText） |
| ../core/config.js | 内部（MumuSpecConfig，knowledge-evolution 可选） |

## 数据契约
- **输入**：CheckRecord（timestamp, constraintId, passed, falsePositive）
- **输出**：EvolutionReport（scores[], lowPerformingIds[], recommendations[]）
- **持久化**：`.mumuspec/evolution/stats.jsonl`（append-only JSONL）
- **配置**：DEFAULT_SCORING_CONFIG（lowScoreThreshold=0.3, penaltyWeight=1.5, minSampleSize=5, windowSize=20）

## Goal Preservation（不可修改锚点）
- E-GUARD-003（SHALL NOT violation）
- E-CHANGE-007（decisions.md hash）
- E-CHANGE-006（Phase transition）

## 变更日志

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026-08-09 | 初始实现 | R-0005 全部子模块 + CLI 命令 |
