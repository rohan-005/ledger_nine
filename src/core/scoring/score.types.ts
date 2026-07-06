import { EvidenceCategory } from "../evidence/evidence.types";

export type { EvidenceCategory };

export type InvestmentDecision = "INVEST" | "PASS";

/**
 * Records why and how each evidence item contributed to (or was excluded from)
 * the weighted score. The ledger is company-agnostic: the same computation
 * paths apply regardless of ticker or company name.
 */
export type ContributionValidityState =
  | "valid"           // item scored normally
  | "excluded_absent" // normalizedValue was null/undefined/NaN — excluded from weight
  | "excluded_range"  // |normalizedValue| > normalizedValueMaxRange — likely a raw metric, not a 0-100 score
  | "excluded_parse"; // normalizedValue could not be parsed to a finite number

export interface ContributionRecord {
  evidenceId: string;
  pillar: EvidenceCategory;
  validityState: ContributionValidityState;
  /**
   * The raw normalizedValue as supplied by the agent, before any
   * transformation. null when the field was absent.
   */
  rawNormalizedValue: number | null;
  /**
   * The effective value (0-100) used in the weighted average.
   * null when validityState !== "valid".
   */
  effectiveValue: number | null;
  /** confidence * sourceQuality weight used for this item */
  weight: number;
  /** effectiveValue * weight, or 0 when excluded */
  finalContribution: number;
}

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
  /**
   * Deterministic ledger recording the disposition of every evidence item.
   * Allows full auditability of score contributions without company identity.
   */
  contributionLedger: ContributionRecord[];
}

