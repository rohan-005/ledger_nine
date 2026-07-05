export type InvestmentDecision = "INVEST" | "PASS";

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
}
