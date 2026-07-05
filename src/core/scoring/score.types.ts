export type InvestmentDecision = "INVEST" | "PASS";

export interface ScoreCategoryBreakdown {
  score: number | null;
  contributingFactors: string[];
  positiveImpacts: string[];
  negativeImpacts: string[];
  relevantEvidenceIds: string[];
}

export interface ScoreBreakdown {
  business: ScoreCategoryBreakdown;
  financial: ScoreCategoryBreakdown;
  valuation: ScoreCategoryBreakdown;
  news: ScoreCategoryBreakdown;
  risk: ScoreCategoryBreakdown;
  evidenceQuality: ScoreCategoryBreakdown;
}

export interface ResearchScores {
  business: number | null;      // 0..100
  financial: number | null;     // 0..100
  valuation: number | null;     // 0..100
  news: number | null;          // 0..100
  risk: number | null;          // 0..100 (high score means lower/better risk profile)
  evidenceQuality: number | null; // 0..100
  contradictionPenalty: number | null; // deducted after weighted score
  final: number | null;         // 0..100
  decision: InvestmentDecision | null;
  breakdown?: ScoreBreakdown;
}
