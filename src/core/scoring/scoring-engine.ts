import { Evidence } from "../evidence/evidence.types";
import { ResearchScores, InvestmentDecision, ScoreCategoryBreakdown } from "./score.types";
import { SCORING_CONFIG } from "@/src/config/scoring.config";

/**
 * Helper to calculate breakdown for a specific category
 */
function calculateCategoryBreakdown(
  category: "business" | "financial" | "valuation" | "news" | "risk",
  evidenceList: readonly Evidence[]
): ScoreCategoryBreakdown {
  const catEvidence = evidenceList.filter((e) => e.category === category);
  
  if (catEvidence.length === 0) {
    return {
      score: 50,
      contributingFactors: ["No evidence available for this category. Defaulted to neutral score of 50."],
      positiveImpacts: [],
      negativeImpacts: [],
      relevantEvidenceIds: [],
    };
  }

  let weightedValSum = 0;
  let weightSum = 0;
  
  const positiveImpacts: string[] = [];
  const negativeImpacts: string[] = [];
  const relevantEvidenceIds: string[] = [];
  const contributingFactors: string[] = [];

  for (const item of catEvidence) {
    const rawVal = item.normalizedValue !== undefined && item.normalizedValue !== null
      ? (typeof item.normalizedValue === "string" ? parseFloat(item.normalizedValue) : Number(item.normalizedValue))
      : NaN;
    
    let val = 50;
    if (!isNaN(rawVal)) {
      if (Math.abs(rawVal) > 1000) {
        val = 50;
      } else {
        const scaled = (rawVal >= -1 && rawVal <= 1) ? 50 + (rawVal * 50) : rawVal;
        val = Math.max(0, Math.min(100, scaled));
      }
    }
    
    const conf = typeof item.confidence === "string" ? parseFloat(item.confidence) : Number(item.confidence);
    const qual = typeof item.sourceQuality === "string" ? parseFloat(item.sourceQuality) : Number(item.sourceQuality);
    const confidence = isNaN(conf) ? 0.8 : conf;
    const sourceQuality = isNaN(qual) ? 0.8 : qual;
    
    const weight = confidence * sourceQuality;
    weightedValSum += val * weight;
    weightSum += weight;

    relevantEvidenceIds.push(item.id);

    const claimDesc = `${item.claim} (Raw Value: ${item.rawValue || "N/A"}, Source: ${item.sourceType})`;
    
    if (val > 55) {
      positiveImpacts.push(claimDesc);
    } else if (val < 45) {
      negativeImpacts.push(claimDesc);
    }
  }

  const score = weightSum > 0 ? weightedValSum / weightSum : 50;
  const roundedScore = Math.round(score * 100) / 100;

  contributingFactors.push(
    `Calculated weighted score of ${roundedScore} using ${catEvidence.length} source(s) (total weight: ${weightSum.toFixed(2)}).`
  );

  return {
    score: roundedScore,
    contributingFactors,
    positiveImpacts,
    negativeImpacts,
    relevantEvidenceIds,
  };
}

/**
 * Helper to calculate evidence quality breakdown
 */
function calculateEvidenceQualityBreakdown(
  evidenceList: readonly Evidence[]
): ScoreCategoryBreakdown {
  if (evidenceList.length === 0) {
    return {
      score: 50,
      contributingFactors: ["No evidence available to assess quality. Defaulted to neutral score of 50."],
      positiveImpacts: [],
      negativeImpacts: [],
      relevantEvidenceIds: [],
    };
  }

  const sum = evidenceList.reduce((acc, e) => {
    const conf = typeof e.confidence === "string" ? parseFloat(e.confidence) : Number(e.confidence);
    const qual = typeof e.sourceQuality === "string" ? parseFloat(e.sourceQuality) : Number(e.sourceQuality);
    const confidence = isNaN(conf) ? 0.8 : conf;
    const sourceQuality = isNaN(qual) ? 0.8 : qual;
    return acc + (confidence * sourceQuality);
  }, 0);
  
  const score = (sum / evidenceList.length) * 100;
  const roundedScore = Math.round(score * 100) / 100;

  const positiveImpacts: string[] = [];
  const negativeImpacts: string[] = [];
  const relevantEvidenceIds: string[] = [];

  for (const e of evidenceList) {
    const conf = typeof e.confidence === "string" ? parseFloat(e.confidence) : Number(e.confidence);
    const qual = typeof e.sourceQuality === "string" ? parseFloat(e.sourceQuality) : Number(e.sourceQuality);
    const confidence = isNaN(conf) ? 0.8 : conf;
    const sourceQuality = isNaN(qual) ? 0.8 : qual;
    const weight = confidence * sourceQuality;

    relevantEvidenceIds.push(e.id);
    
    const desc = `${e.claim} (Confidence: ${confidence}, Quality: ${sourceQuality}, Source: ${e.sourceType})`;
    if (weight >= 0.7) {
      positiveImpacts.push(`High credibility source: ${desc}`);
    } else if (weight < 0.5) {
      negativeImpacts.push(`Lower credibility source: ${desc}`);
    }
  }

  return {
    score: roundedScore,
    contributingFactors: [
      `Overall evidence quality calculated as average of confidence * sourceQuality across all ${evidenceList.length} items.`
    ],
    positiveImpacts,
    negativeImpacts,
    relevantEvidenceIds,
  };
}

/**
 * Deterministic Scoring Engine.
 */
export function calculateScores(
  evidenceList: readonly Evidence[],
  contradictionsList: { severity: string }[]
): ResearchScores {
  // 1. Calculate breakdowns for category scores
  const businessBreakdown = calculateCategoryBreakdown("business", evidenceList);
  const financialBreakdown = calculateCategoryBreakdown("financial", evidenceList);
  const valuationBreakdown = calculateCategoryBreakdown("valuation", evidenceList);
  const newsBreakdown = calculateCategoryBreakdown("news", evidenceList);
  const riskBreakdown = calculateCategoryBreakdown("risk", evidenceList);
  const evidenceQualityBreakdown = calculateEvidenceQualityBreakdown(evidenceList);

  // 2. Calculate contradiction penalty
  let contradictionPenalty = 0;
  for (const c of contradictionsList) {
    const sev = c.severity.toLowerCase();
    if (sev === "high") {
      contradictionPenalty += SCORING_CONFIG.penalties.contradiction.high;
    } else if (sev === "medium") {
      contradictionPenalty += SCORING_CONFIG.penalties.contradiction.medium;
    } else if (sev === "low") {
      contradictionPenalty += SCORING_CONFIG.penalties.contradiction.low;
    }
  }

  if (contradictionsList.length > 0) {
    riskBreakdown.negativeImpacts.push(
      `Detected ${contradictionsList.length} contradiction(s) in evidence, resulting in a -${contradictionPenalty} final score penalty.`
    );
    riskBreakdown.contributingFactors.push(
      `Applied contradiction penalty of -${contradictionPenalty} due to conflicts.`
    );
  }

  // 3. Compute weighted score
  const { weights, thresholds } = SCORING_CONFIG;
  const weightedScore =
    businessBreakdown.score * weights.business +
    financialBreakdown.score * weights.financial +
    valuationBreakdown.score * weights.valuation +
    newsBreakdown.score * weights.news +
    riskBreakdown.score * weights.risk +
    evidenceQualityBreakdown.score * weights.evidenceQuality;

  let finalScore = Math.max(0, Math.min(100, weightedScore - contradictionPenalty));

  // 4. Apply guardrails
  // Guardrail A: If essential financial evidence from primary sources (SEC/FMP) is missing, penalize
  const hasFinancialPrimary = evidenceList.some(
    (e) => e.category === "financial" && (e.sourceType === "fmp" || e.sourceType === "sec")
  );
  if (!hasFinancialPrimary) {
    finalScore = Math.max(0, finalScore - 10);
    financialBreakdown.negativeImpacts.push(
      "Missing essential financial evidence from primary sources (SEC/FMP). Applied a -10.00 final score penalty."
    );
    financialBreakdown.contributingFactors.push(
      "Financial data quality penalty of -10.00 applied to final score due to lack of SEC/FMP sources."
    );
  }

  // Guardrail B: If evidence quality is critically low, force PASS
  const isEvidenceQualityCritical = evidenceQualityBreakdown.score < thresholds.criticalEvidenceQuality;
  if (isEvidenceQualityCritical) {
    evidenceQualityBreakdown.negativeImpacts.push(
      `Critical evidence quality score (${evidenceQualityBreakdown.score.toFixed(2)}) is below the threshold of ${thresholds.criticalEvidenceQuality}. PASS decision forced.`
    );
    evidenceQualityBreakdown.contributingFactors.push(
      `Forced PASS decision due to critical evidence quality.`
    );
  }
  
  let decision: InvestmentDecision = "PASS";
  if (finalScore >= thresholds.decision && !isEvidenceQualityCritical) {
    decision = "INVEST";
  }

  const roundedFinalScore = Math.round(finalScore * 100) / 100;

  return {
    business: businessBreakdown.score,
    financial: financialBreakdown.score,
    valuation: valuationBreakdown.score,
    news: newsBreakdown.score,
    risk: riskBreakdown.score,
    evidenceQuality: evidenceQualityBreakdown.score,
    contradictionPenalty,
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
  };
}
