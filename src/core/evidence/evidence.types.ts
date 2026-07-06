export type EvidenceCategory = "business" | "financial" | "valuation" | "news" | "risk";
export type EvidenceSourceType = "sec" | "fmp" | "tavily" | "alpha_vantage" | "llm_inference";

export interface Evidence {
  id: string;
  researchId: string;
  claim: string;
  category: EvidenceCategory;
  sourceType: EvidenceSourceType;
  sourceUrl?: string;
  sourceTitle?: string;
  rawValue?: string; // Stored as stringified JSON or plain text
  /**
   * A normalised score in the range [0, 100] representing the sentiment or
   * quality of this evidence item for scoring purposes.
   *
   * CONTRACT:
   * - 0 = very negative / very bad for investment case
   * - 50 = neutral / unknown direction
   * - 100 = very positive / very good for investment case
   * - ABSENT (null/undefined) = the agent did not produce a scoreable value.
   *   Absent does NOT mean zero — it means the item contributes no weight to
   *   the weighted average. The scoring engine excludes absent items.
   * - OUT-OF-RANGE (|value| > SCORING_CONFIG.normalizedValueMaxRange) = the
   *   agent returned a raw financial metric (e.g., revenue in billions, PE
   *   ratio). The scoring engine will exclude this item from the pillar score
   *   and record it in the contribution ledger as "excluded_range".
   *
   * Agents may also return values in [-1, 1] (sentiment ratios), which the
   * scoring engine scales to [0, 100] automatically.
   */
  normalizedValue?: number;
  confidence: number; // 0..1
  sourceQuality: number; // 0..1
  agentId: string;
  observedAt?: string;
  createdAt: string;
}
