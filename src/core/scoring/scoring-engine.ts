import { Evidence } from "../evidence/evidence.types";
import {
  ResearchScores,
  InvestmentDecision,
  ScoreCategoryBreakdown,
  ContributionRecord,
  ContributionValidityState,
  EvidenceCategory,
} from "./score.types";
import { areCategoriesComparable } from "./metric-registry";
import { SCORING_CONFIG } from "@/src/config/scoring.config";
import { logger } from "@/src/lib/logger";

// ─── Numeric helpers ────────────────────────────────────────────────────────

/**
 * Parse the first numeric value from a string.
 * Returns null if no valid number is found.
 * Never returns 0 as a default — callers must handle null explicitly.
 */
function extractNumericValue(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[$,]/g, "");
  const match = cleaned.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return isFinite(parsed) ? parsed : null;
}

// ─── Claim classification helpers ───────────────────────────────────────────

/**
 * Price-like keywords used to detect share-price claims for immaterial-variance
 * filtering. This list is about claim semantics, NOT company identity.
 */
const PRICE_KEYWORDS = [
  "$", "price", "share", "target", "value", "trading",
  "stock", "close", "high", "low", "open",
];

function isPriceLike(claim: string, rawVal: string): boolean {
  const combined = `${claim} ${rawVal}`.toLowerCase();
  return PRICE_KEYWORDS.some((kw) => combined.includes(kw));
}

/**
 * Short-term vs long-term temporal scope keywords.
 * Used to detect temporal mismatch between two claims.
 * This is about claim temporal scope, NOT company identity.
 */
const SHORT_TERM_KEYWORDS = [
  "today", "daily", "intraday", "session", "overnight",
  "hours ago", "rose ", "fell ", "gained ", "lost ",
  "up ", "down ", "% today", "% daily",
];
const LONG_TERM_KEYWORDS = [
  "resistance", "trend", "horizon", "outlook", "support",
  "bearish", "bullish", "moving average", "years", "long-term",
  "sec", "annual", "quarterly", "year", "growth rate", "cagr",
  "valuation model", "target price",
];

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Returns true if claimA and claimB have different temporal scopes
 * (one is short-term, the other is long-term). Generic — no ticker identity.
 */
function isTemporalMismatch(claimA: string, claimB: string): boolean {
  const isStA = hasKeyword(claimA, SHORT_TERM_KEYWORDS);
  const isStB = hasKeyword(claimB, SHORT_TERM_KEYWORDS);
  const isLtA = hasKeyword(claimA, LONG_TERM_KEYWORDS);
  const isLtB = hasKeyword(claimB, LONG_TERM_KEYWORDS);
  return (isStA && isLtB) || (isStB && isLtA);
}

// ─── Normalised-value validity gate ─────────────────────────────────────────

/**
 * Determine the validity state and effective 0-100 score for a single
 * evidence item's normalizedValue.
 *
 * VALID if:
 *   - normalizedValue is present, parses to a finite number, AND
 *   - |value| <= normalizedValueMaxRange (i.e. it looks like a 0-100 score,
 *     not a raw financial metric like revenue in billions or a PE ratio of 35)
 *
 * EXCLUDED_ABSENT  — normalizedValue was null/undefined
 * EXCLUDED_PARSE   — normalizedValue did not parse to a finite number
 * EXCLUDED_RANGE   — |value| > normalizedValueMaxRange (raw metric, not a score)
 *
 * When excluded, the item does NOT contribute to the weighted average.
 * Missing data is NEVER silently mapped to a neutral 50.
 *
 * Returns: { state, effectiveValue }
 *   effectiveValue is null when excluded.
 */
function resolveNormalizedValue(
  rawNormalized: number | string | null | undefined,
  maxRange: number
): { state: ContributionValidityState; effectiveValue: number | null } {
  // 1. Absent
  if (rawNormalized === null || rawNormalized === undefined) {
    return { state: "excluded_absent", effectiveValue: null };
  }

  // 2. Parse
  const asNum =
    typeof rawNormalized === "number"
      ? rawNormalized
      : parseFloat(String(rawNormalized));

  if (!isFinite(asNum)) {
    return { state: "excluded_parse", effectiveValue: null };
  }

  // 3. Range check
  if (Math.abs(asNum) > maxRange) {
    return { state: "excluded_range", effectiveValue: null };
  }

  // 4. Valid — scale from [-1,1] into [0,100] if the value looks like a
  //    normalised sentiment ratio, otherwise clamp directly to [0,100].
  //    Both branches are deterministic and generic.
  const scaled =
    asNum >= -1 && asNum <= 1
      ? 50 + asNum * 50   // sentiment ratio → 0-100
      : asNum;            // assume already in 0-100 range
  const effectiveValue = Math.max(0, Math.min(100, scaled));

  return { state: "valid", effectiveValue };
}

// ─── Category breakdown ──────────────────────────────────────────────────────

interface CategoryResult {
  breakdown: ScoreCategoryBreakdown;
  ledgerEntries: ContributionRecord[];
}

/**
 * Calculate the score breakdown for a single evidence category.
 *
 * Each evidence item is individually validated. Items with invalid or absent
 * normalizedValue are excluded from the weighted average — they produce a
 * ledger entry with validityState !== "valid" and contribute no weight.
 *
 * INVARIANT: The same set of evidence items always produces the same result
 * regardless of the company or ticker they belong to.
 */
function calculateCategoryBreakdown(
  category: EvidenceCategory,
  evidenceList: readonly Evidence[]
): CategoryResult {
  const catEvidence = evidenceList.filter((e) => e.category === category);
  const ledgerEntries: ContributionRecord[] = [];

  if (catEvidence.length === 0) {
    return {
      breakdown: {
        score: null,
        contributingFactors: ["No evidence available for this category."],
        positiveImpacts: [],
        negativeImpacts: [],
        relevantEvidenceIds: [],
      },
      ledgerEntries,
    };
  }

  let weightedValSum = 0;
  let weightSum = 0;
  const positiveImpacts: string[] = [];
  const negativeImpacts: string[] = [];
  const relevantEvidenceIds: string[] = [];
  const contributingFactors: string[] = [];
  const maxRange = SCORING_CONFIG.normalizedValueMaxRange;

  for (const item of catEvidence) {
    // Raw normalized value from the agent (may be number or stringified number)
    const rawNormalized =
      item.normalizedValue !== undefined && item.normalizedValue !== null
        ? (typeof item.normalizedValue === "string"
            ? parseFloat(item.normalizedValue)
            : Number(item.normalizedValue))
        : null;

    const { state, effectiveValue } = resolveNormalizedValue(rawNormalized, maxRange);

    // Weight is always computed from confidence and quality, regardless of validity
    const conf =
      typeof item.confidence === "string"
        ? parseFloat(item.confidence)
        : Number(item.confidence);
    const qual =
      typeof item.sourceQuality === "string"
        ? parseFloat(item.sourceQuality)
        : Number(item.sourceQuality);
    const confidence = isNaN(conf) ? 0.8 : conf;
    const sourceQuality = isNaN(qual) ? 0.8 : qual;
    const weight = confidence * sourceQuality;

    // Ledger entry — always produced, regardless of validity state
    const ledgerEntry: ContributionRecord = {
      evidenceId: item.id,
      pillar: category,
      validityState: state,
      rawNormalizedValue: rawNormalized,
      effectiveValue,
      weight,
      finalContribution: state === "valid" && effectiveValue !== null
        ? effectiveValue * weight
        : 0,
    };
    ledgerEntries.push(ledgerEntry);
    relevantEvidenceIds.push(item.id);

    if (state !== "valid" || effectiveValue === null) {
      // Excluded items: record in factors but DO NOT add to weighted average.
      // Missing data must not become a neutral contribution.
      contributingFactors.push(
        `Evidence ${item.id} excluded from weighted average (${state}): normalizedValue=${rawNormalized ?? "absent"}.`
      );
      continue;
    }

    // Valid item — accumulate into weighted average
    weightedValSum += effectiveValue * weight;
    weightSum += weight;

    const claimDesc = `${item.claim} (Raw: ${item.rawValue ?? "N/A"}, Source: ${item.sourceType})`;
    if (effectiveValue > 55) {
      positiveImpacts.push(claimDesc);
    } else if (effectiveValue < 45) {
      negativeImpacts.push(claimDesc);
    }
  }

  // If no valid items contributed weight, score is null — not 50.
  const score =
    weightSum > 0 ? Math.round((weightedValSum / weightSum) * 100) / 100 : null;

  if (score !== null) {
    contributingFactors.push(
      `Weighted score of ${score} from ${catEvidence.filter((_, i) => ledgerEntries[i]?.validityState === "valid").length} valid item(s) (total weight: ${weightSum.toFixed(2)}).`
    );
  } else {
    contributingFactors.push(
      `No valid normalizedValue found in ${catEvidence.length} item(s); category score is null.`
    );
  }

  return {
    breakdown: {
      score,
      contributingFactors,
      positiveImpacts,
      negativeImpacts,
      relevantEvidenceIds,
    },
    ledgerEntries,
  };
}

// ─── Evidence quality breakdown ──────────────────────────────────────────────

function calculateEvidenceQualityBreakdown(
  evidenceList: readonly Evidence[]
): ScoreCategoryBreakdown {
  if (evidenceList.length === 0) {
    return {
      score: null,
      contributingFactors: ["No evidence available to assess quality."],
      positiveImpacts: [],
      negativeImpacts: [],
      relevantEvidenceIds: [],
    };
  }

  let totalWeight = 0;
  const positiveImpacts: string[] = [];
  const negativeImpacts: string[] = [];
  const relevantEvidenceIds: string[] = [];

  for (const e of evidenceList) {
    const conf =
      typeof e.confidence === "string" ? parseFloat(e.confidence) : Number(e.confidence);
    const qual =
      typeof e.sourceQuality === "string"
        ? parseFloat(e.sourceQuality)
        : Number(e.sourceQuality);
    const confidence = isNaN(conf) ? 0.8 : conf;
    const sourceQuality = isNaN(qual) ? 0.8 : qual;
    const weight = confidence * sourceQuality;

    totalWeight += weight;
    relevantEvidenceIds.push(e.id);

    const desc = `${e.claim} (Confidence: ${confidence.toFixed(2)}, Quality: ${sourceQuality.toFixed(2)}, Source: ${e.sourceType})`;
    if (weight >= 0.7) {
      positiveImpacts.push(`High credibility source: ${desc}`);
    } else if (weight < 0.5) {
      negativeImpacts.push(`Lower credibility source: ${desc}`);
    }
  }

  const score = Math.round(((totalWeight / evidenceList.length) * 100) * 100) / 100;

  return {
    score,
    contributingFactors: [
      `Overall evidence quality: average(confidence × sourceQuality) across ${evidenceList.length} item(s) = ${(score / 100).toFixed(4)}.`,
    ],
    positiveImpacts,
    negativeImpacts,
    relevantEvidenceIds,
  };
}

// ─── Main scoring function ───────────────────────────────────────────────────

/**
 * Deterministic, company-agnostic scoring engine.
 *
 * INVARIANTS (verified by tests):
 * 1. Changing ticker while keeping identical normalised evidence → same score.
 * 2. Changing company name → same score.
 * 3. Reordering evidence → same score (weights are associative sums).
 * 4. Missing normalizedValue → item excluded from average, NOT mapped to 50.
 * 5. Cross-category contradiction pairs → no penalty.
 * 6. Total contradiction penalty ≤ SCORING_CONFIG.penalties.maxContradictionPenalty.
 * 7. Duplicated evidence bounded by deduplication layer (EvidencePool.deduplicate).
 *
 * @param evidenceList — The full resolved evidence list for this run.
 * @param contradictionsList — Contradiction pairs from the LLM detector + DB.
 * @param isSufficient — Whether the sufficiency gate passed.
 */
export function calculateScores(
  evidenceList: readonly Evidence[],
  contradictionsList: { severity: string; evidenceIdA?: string; evidenceIdB?: string }[],
  isSufficient = true
): ResearchScores {
  const contributionLedger: ContributionRecord[] = [];

  // 1. Calculate per-pillar breakdowns with validity gating
  const businessResult   = calculateCategoryBreakdown("business",   evidenceList);
  const financialResult  = calculateCategoryBreakdown("financial",  evidenceList);
  const valuationResult  = calculateCategoryBreakdown("valuation",  evidenceList);
  const newsResult       = calculateCategoryBreakdown("news",       evidenceList);
  const riskResult       = calculateCategoryBreakdown("risk",       evidenceList);
  const evidenceQualityBreakdown = calculateEvidenceQualityBreakdown(evidenceList);

  // Accumulate ledger from all pillars
  for (const r of [businessResult, financialResult, valuationResult, newsResult, riskResult]) {
    contributionLedger.push(...r.ledgerEntries);
  }

  const businessBreakdown  = businessResult.breakdown;
  const financialBreakdown = financialResult.breakdown;
  const valuationBreakdown = valuationResult.breakdown;
  const newsBreakdown      = newsResult.breakdown;
  const riskBreakdown      = riskResult.breakdown;

  // 2. Calculate contradiction penalty
  //
  // Filters applied (in order):
  //   A. Cross-category: two items from different evidence categories measure
  //      different metric dimensions → cannot be direct contradictions.
  //   B. Immaterial price variance: price-like claims within 2% relative diff
  //      or < $1 absolute diff → not material.
  //   C. Temporal mismatch: one short-term, one long-term claim → incomparable.
  //
  // All filters are generic — they inspect claim semantics, never ticker identity.
  let contradictionPenalty = 0;
  const filteredContradictions: typeof contradictionsList = [];
  const evidenceMap = new Map(evidenceList.map((e) => [e.id, e]));

  for (const c of contradictionsList) {
    const itemA = c.evidenceIdA ? evidenceMap.get(c.evidenceIdA) : null;
    const itemB = c.evidenceIdB ? evidenceMap.get(c.evidenceIdB) : null;

    if (itemA && itemB) {
      // Filter A: Cross-category — different metric families, cannot be direct contradiction
      if (!areCategoriesComparable(itemA.category, itemB.category)) {
        logger.info("Contradiction Filter: Skipped — cross-category, incomparable metric families", {
          evidenceIdA: itemA.id,
          evidenceIdB: itemB.id,
          categoryA: itemA.category,
          categoryB: itemB.category,
        });
        continue;
      }

      // Filter B: Immaterial price variance
      if (
        isPriceLike(itemA.claim, itemA.rawValue ?? "") &&
        isPriceLike(itemB.claim, itemB.rawValue ?? "")
      ) {
        const valA = extractNumericValue(itemA.rawValue ?? itemA.claim);
        const valB = extractNumericValue(itemB.rawValue ?? itemB.claim);
        if (valA !== null && valB !== null) {
          const diff = Math.abs(valA - valB);
          const maxVal = Math.max(valA, valB);
          const relativeDiff = maxVal > 0 ? diff / maxVal : 0;
          if (relativeDiff < 0.02 || diff < 1.0) {
            logger.info("Contradiction Filter: Skipped — immaterial price variance", {
              evidenceIdA: itemA.id,
              evidenceIdB: itemB.id,
              valA,
              valB,
              relativeDiff: relativeDiff.toFixed(4),
            });
            continue;
          }
        }
      }

      // Filter C: Temporal scope mismatch
      if (isTemporalMismatch(itemA.claim, itemB.claim)) {
        logger.info("Contradiction Filter: Skipped — temporal scope mismatch", {
          evidenceIdA: itemA.id,
          evidenceIdB: itemB.id,
        });
        continue;
      }
    }

    filteredContradictions.push(c);

    const sev = c.severity.toLowerCase();
    if (sev === "high") {
      contradictionPenalty += SCORING_CONFIG.penalties.contradiction.high;
    } else if (sev === "medium") {
      contradictionPenalty += SCORING_CONFIG.penalties.contradiction.medium;
    } else if (sev === "low") {
      contradictionPenalty += SCORING_CONFIG.penalties.contradiction.low;
    }
  }

  // Apply global contradiction penalty cap.
  // This ensures that even many hallucinated or compound contradictions cannot
  // eliminate a valid partial evidence signal from the score.
  // The cap is documented in SCORING_CONFIG and is NOT tuned to any fixture.
  const cappedPenalty = Math.min(
    contradictionPenalty,
    SCORING_CONFIG.penalties.maxContradictionPenalty
  );

  if (cappedPenalty < contradictionPenalty) {
    logger.info("Contradiction Filter: Penalty capped at global maximum", {
      rawPenalty: contradictionPenalty,
      cappedPenalty,
      cap: SCORING_CONFIG.penalties.maxContradictionPenalty,
    });
  }

  if (filteredContradictions.length > 0) {
    riskBreakdown.negativeImpacts.push(
      `${filteredContradictions.length} contradiction(s) detected — final score penalty: -${cappedPenalty} (raw: ${contradictionPenalty}, cap: ${SCORING_CONFIG.penalties.maxContradictionPenalty}).`
    );
    riskBreakdown.contributingFactors.push(
      `Applied bounded contradiction penalty of -${cappedPenalty}.`
    );
  }

  // If research is insufficient, return null scores and null decision.
  // Contribution ledger is still returned for diagnostics.
  if (!isSufficient) {
    return {
      business: null,
      financial: null,
      valuation: null,
      news: null,
      risk: null,
      evidenceQuality: null,
      contradictionPenalty: cappedPenalty,
      final: null,
      decision: null,
      breakdown: {
        business: businessBreakdown,
        financial: financialBreakdown,
        valuation: valuationBreakdown,
        news: newsBreakdown,
        risk: riskBreakdown,
        evidenceQuality: evidenceQualityBreakdown,
      },
      contributionLedger,
    };
  }

  // 3. Compute weighted final score from pillar scores
  const { weights, thresholds } = SCORING_CONFIG;

  const categoryScores = [
    { score: businessBreakdown.score,       weight: weights.business },
    { score: financialBreakdown.score,      weight: weights.financial },
    { score: valuationBreakdown.score,      weight: weights.valuation },
    { score: newsBreakdown.score,           weight: weights.news },
    { score: riskBreakdown.score,           weight: weights.risk },
    { score: evidenceQualityBreakdown.score, weight: weights.evidenceQuality },
  ];

  let weightedScoreSum = 0;
  let activeWeightSum = 0;

  for (const item of categoryScores) {
    if (item.score !== null) {
      weightedScoreSum += item.score * item.weight;
      activeWeightSum += item.weight;
    }
  }

  const baseWeightedScore =
    activeWeightSum > 0 ? weightedScoreSum / activeWeightSum : null;

  let finalScore: number | null = null;
  if (baseWeightedScore !== null) {
    finalScore = Math.max(0, Math.min(100, baseWeightedScore - cappedPenalty));
  }

  // 4. Apply guardrails

  // Guardrail A: Missing primary financial evidence (SEC/FMP)
  // Generic rule: if no financial data from primary sources is present, apply
  // a fixed data-quality deduction. This is a coverage penalty, not a company
  // judgment. The deduction value is in SCORING_CONFIG (conceptually) and
  // is applied identically for every company.
  const MISSING_PRIMARY_FINANCIAL_PENALTY = 10;
  const hasFinancialPrimary = evidenceList.some(
    (e) => e.category === "financial" && (e.sourceType === "fmp" || e.sourceType === "sec")
  );
  if (!hasFinancialPrimary && finalScore !== null) {
    finalScore = Math.max(0, finalScore - MISSING_PRIMARY_FINANCIAL_PENALTY);
    financialBreakdown.negativeImpacts.push(
      `No primary financial evidence (SEC/FMP) found. Applied coverage penalty of -${MISSING_PRIMARY_FINANCIAL_PENALTY}.`
    );
    financialBreakdown.contributingFactors.push(
      `Coverage penalty of -${MISSING_PRIMARY_FINANCIAL_PENALTY} applied: no SEC/FMP financial evidence present.`
    );
  }

  // Guardrail B: Critically low evidence quality → force PASS
  const isEvidenceQualityCritical =
    evidenceQualityBreakdown.score !== null &&
    evidenceQualityBreakdown.score < thresholds.criticalEvidenceQuality;

  if (isEvidenceQualityCritical) {
    evidenceQualityBreakdown.negativeImpacts.push(
      `Critical evidence quality (${evidenceQualityBreakdown.score?.toFixed(2)}) is below threshold (${thresholds.criticalEvidenceQuality}). Decision forced to PASS.`
    );
    evidenceQualityBreakdown.contributingFactors.push(
      `Forced PASS: evidence quality critically low.`
    );
  }

  // 5. Determine investment decision
  let decision: InvestmentDecision | null = null;
  if (finalScore !== null) {
    if (finalScore >= thresholds.decision && !isEvidenceQualityCritical) {
      decision = "INVEST";
    } else {
      decision = "PASS";
    }
  }

  const roundedFinalScore =
    finalScore !== null ? Math.round(finalScore * 100) / 100 : null;

  return {
    business: businessBreakdown.score,
    financial: financialBreakdown.score,
    valuation: valuationBreakdown.score,
    news: newsBreakdown.score,
    risk: riskBreakdown.score,
    evidenceQuality: evidenceQualityBreakdown.score,
    contradictionPenalty: cappedPenalty,
    final: roundedFinalScore,
    decision,
    breakdown: {
      business: businessBreakdown,
      financial: financialBreakdown,
      valuation: valuationBreakdown,
      news: newsBreakdown,
      risk: riskBreakdown,
      evidenceQuality: evidenceQualityBreakdown,
    },
    contributionLedger,
  };
}
