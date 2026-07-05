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
  normalizedValue?: number; // Clamped rating/metrics value if applicable
  confidence: number; // 0..1
  sourceQuality: number; // 0..1
  agentId: string;
  observedAt?: string;
  createdAt: string;
}
