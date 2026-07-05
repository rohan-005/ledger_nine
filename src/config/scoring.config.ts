export const SCORING_CONFIG = {
  weights: {
    business: 0.20,
    financial: 0.25,
    valuation: 0.20,
    news: 0.10,
    risk: 0.15,
    evidenceQuality: 0.10,
  },
  thresholds: {
    decision: 65, // score >= 65 is INVEST
    criticalEvidenceQuality: 40, // if quality < 40, force PASS
  },
  penalties: {
    contradiction: {
      high: 15,
      medium: 7,
      low: 2,
    },
  },
  sourceQuality: {
    sec: 1.00,
    fmp: 0.85,
    tavily: 0.75,
    alpha_vantage: 0.75,
    llm_inference: 0.35,
  },
};
