export type InvestmentDecision = "INVEST" | "PASS";

export interface ScoreCategoryBreakdown {
  score: number;
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
  business: number;      // 0..100
  financial: number;     // 0..100
  valuation: number;     // 0..100
  news: number;          // 0..100
  risk: number;          // 0..100 (high score means lower/better risk profile)
  evidenceQuality: number; // 0..100
  contradictionPenalty: number; // deducted after weighted score
  final: number;         // 0..100
  decision: InvestmentDecision;
  breakdown?: ScoreBreakdown;
}
