// ─── Primitives ──────────────────────────────────────────────────────────────

export type ResearchStatus = "queued" | "running" | "completed" | "failed";
export type RiskTolerance = "low" | "moderate" | "high";
export type DecisionType = "INVEST" | "PASS";
export type EvidenceCategory = "business" | "financial" | "valuation" | "news" | "risk";
export type EvidenceSourceType = "sec" | "fmp" | "tavily" | "alpha_vantage" | "llm_inference";
export type ContradictionSeverity = "low" | "medium" | "high";
export type AgentRunStatus = "started" | "completed" | "failed";

// ─── API Envelopes ────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: unknown;
}

// ─── Research Run ─────────────────────────────────────────────────────────────

export interface ResearchRun {
  id: string;
  ticker: string;
  companyName: string | null;
  investmentHorizon: string;
  riskTolerance: RiskTolerance;
  status: ResearchStatus;
  currentNode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

// Subset returned by /api/research/[id]/status
export interface ResearchStatusResponse {
  id: string;
  ticker: string;
  companyName: string | null;
  status: ResearchStatus;
  currentNode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// ─── Score Breakdown ──────────────────────────────────────────────────────────

// Matches ScoreCategoryBreakdown in src/core/scoring/score.types.ts
export interface ScoreCategoryBreakdown {
  score: number;
  contributingFactors: string[];
  positiveImpacts: string[];
  negativeImpacts: string[];
  relevantEvidenceIds: string[];
}

// Matches ScoreBreakdown in score.types.ts — stored as JSON text in DB
export interface ScoreBreakdown {
  business?: ScoreCategoryBreakdown;
  financial?: ScoreCategoryBreakdown;
  valuation?: ScoreCategoryBreakdown;
  news?: ScoreCategoryBreakdown;
  risk?: ScoreCategoryBreakdown;
  evidenceQuality?: ScoreCategoryBreakdown;
}

// ─── Scores ───────────────────────────────────────────────────────────────────

// Drizzle returns numeric columns as strings from postgres driver
export interface ResearchScores {
  id: string;
  researchId: string;
  business: string;
  financial: string;
  valuation: string;
  news: string;
  risk: string;
  evidenceQuality: string;
  contradictionPenalty: string;
  finalScore: string;
  decision: DecisionType;
  scoreBreakdown: ScoreBreakdown | null;
  createdAt: string;
}

// Helper to safely parse a score string to a number
export function parseScore(v: string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ─── Committee Report ─────────────────────────────────────────────────────────

export interface CommitteeReport {
  id: string;
  researchId: string;
  thesis: string;
  bullCase: string[];
  bearCase: string[];
  keyRisks: string[];
  summary: string;
  createdAt: string;
}

// ─── Research Summary (GET /api/research/[id]) ────────────────────────────────

export interface ResearchSummary {
  run: ResearchRun;
  score: ResearchScores | null;
  report: CommitteeReport | null;
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  id: string;
  researchId: string;
  claim: string;
  category: EvidenceCategory | string;
  sourceType: EvidenceSourceType | string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: string;
  sourceQuality: string;
  agentId: string;
  observedAt: string | null;
  createdAt: string;
}

// ─── Contradictions ───────────────────────────────────────────────────────────

export interface Contradiction {
  id: string;
  researchId: string;
  evidenceIdA: string;
  evidenceIdB: string;
  description: string;
  severity: ContradictionSeverity | string;
  confidence: string;
  createdAt: string;
}

// ─── Agent Runs ───────────────────────────────────────────────────────────────

export interface AgentRun {
  id: string;
  researchId: string;
  agentId: string;
  provider: string | null;
  model: string | null;
  status: AgentRunStatus | string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  latencyMs: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

// ─── API Request ──────────────────────────────────────────────────────────────

export interface ResearchRequest {
  ticker: string;
  investmentHorizon: string;
  riskTolerance: RiskTolerance;
}

export interface CreateResearchResponse {
  researchId: string;
  status: string;
}
