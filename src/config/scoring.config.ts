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
      high: 4,
      medium: 2,
      low: 0,
    },
    /**
     * Global ceiling on the total contradiction penalty applied to any run.
     *
     * Rationale: The score scale is 0..100. A ceiling of 10 means that
     * even if the LLM contradiction detector flags many pairs as "high"
     * severity, the total deduction is bounded at 10% of the scale.
     * This prevents compound or hallucinated contradictions from
     * eliminating a valid partial evidence signal entirely.
     *
     * This value is derived from scale semantics only — it is NOT chosen
     * to improve or repair any specific company's score.
     */
    maxContradictionPenalty: 10,
  },
  sourceQuality: {
    sec: 1.00,
    fmp: 0.85,
    tavily: 0.75,
    alpha_vantage: 0.75,
    llm_inference: 0.35,
  },
  /**
   * Evidence validity: normalizedValue range.
   *
   * Any normalizedValue whose absolute value exceeds this threshold is
   * considered to be a raw metric (e.g. a PE ratio, revenue in billions)
   * rather than a 0-100 score and is excluded from the weighted average.
   *
   * Items excluded on this basis are recorded in the contribution ledger
   * with validityState = "excluded_range". They are NOT silently mapped
   * to the neutral baseline (50).
   */
  normalizedValueMaxRange: 1000,
};

