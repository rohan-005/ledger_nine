import { Evidence } from "../evidence/evidence.types";
import { ResearchScores, InvestmentDecision } from "./score.types";
import { SCORING_CONFIG } from "@/src/config/scoring.config";

/**
 * Deterministic Scoring Engine.
 * Conventions:
 * 1. Category scores: 0..100.
 * 2. Risk score: 0..100. Higher score means better risk profile (lower/well-mitigated risk).
 * 3. Evidence quality score: average of confidence * sourceQuality across all evidence.
 * 4. Contradiction penalty: subtracted directly from the final score.
 * 5. Guardrails:
 *    - Force PASS if evidence quality < SCORING_CONFIG.thresholds.criticalEvidenceQuality (40).
 *    - Apply extra penalty if no primary financial evidence (FMP/SEC) is present.
 */
export function calculateScores(
  evidenceList: readonly Evidence[],
  contradictionsList: { severity: string }[]
): ResearchScores {
  const categories = ["business", "financial", "valuation", "news", "risk"] as const;
  const scores: Record<string, number> = {};

  // 1. Calculate score for each category using confidence * quality weighted average
  for (const cat of categories) {
    const catEvidence = evidenceList.filter((e) => e.category === cat);
    if (catEvidence.length === 0) {
      // Default to neutral/degraded score when no evidence exists
      scores[cat] = 50;
      continue;
    }

    let weightedValSum = 0;
    let weightSum = 0;

    for (const item of catEvidence) {
      const rawVal = item.normalizedValue !== undefined && item.normalizedValue !== null
        ? (typeof item.normalizedValue === "string" ? parseFloat(item.normalizedValue) : Number(item.normalizedValue))
        : NaN;
      
      let val = 50;
      if (!isNaN(rawVal)) {
        if (Math.abs(rawVal) > 1000) {
          // Massive raw financial values (like market cap, net income) shouldn't be used as scores directly
          val = 50;
        } else {
          // Scale fractional values (e.g. 0.12 revenue growth -> 12, or -0.05 -> -5)
          // If it is between -1 and 1, we can map it to 0-100 with 50 as neutral: 50 + (rawVal * 50)
          const scaled = (rawVal >= -1 && rawVal <= 1) ? 50 + (rawVal * 50) : rawVal;
          // Clamp to 0..100 range
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
    }

    scores[cat] = weightSum > 0 ? weightedValSum / weightSum : 50;
  }

  // 2. Calculate evidence quality score (0..100)
  let evidenceQuality = 50;
  if (evidenceList.length > 0) {
    const sum = evidenceList.reduce((acc, e) => {
      const conf = typeof e.confidence === "string" ? parseFloat(e.confidence) : Number(e.confidence);
      const qual = typeof e.sourceQuality === "string" ? parseFloat(e.sourceQuality) : Number(e.sourceQuality);
      const confidence = isNaN(conf) ? 0.8 : conf;
      const sourceQuality = isNaN(qual) ? 0.8 : qual;
      return acc + (confidence * sourceQuality);
    }, 0);
    evidenceQuality = (sum / evidenceList.length) * 100;
  }

  // 3. Calculate contradiction penalty
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

  // 4. Compute weighted score
  const { weights, thresholds } = SCORING_CONFIG;
  const weightedScore =
    scores.business * weights.business +
    scores.financial * weights.financial +
    scores.valuation * weights.valuation +
    scores.news * weights.news +
    scores.risk * weights.risk +
    evidenceQuality * weights.evidenceQuality;

  let finalScore = Math.max(0, Math.min(100, weightedScore - contradictionPenalty));

  // 5. Apply guardrails
  // Guardrail A: If essential financial evidence from primary sources (SEC/FMP) is missing, penalize
  const hasFinancialPrimary = evidenceList.some(
    (e) => e.category === "financial" && (e.sourceType === "fmp" || e.sourceType === "sec")
  );
  if (!hasFinancialPrimary) {
    finalScore = Math.max(0, finalScore - 10);
  }

  // Guardrail B: If evidence quality is critically low, force PASS
  const isEvidenceQualityCritical = evidenceQuality < thresholds.criticalEvidenceQuality;
  
  let decision: InvestmentDecision = "PASS";
  if (finalScore >= thresholds.decision && !isEvidenceQualityCritical) {
    decision = "INVEST";
  }

  return {
    business: Math.round(scores.business * 100) / 100,
    financial: Math.round(scores.financial * 100) / 100,
    valuation: Math.round(scores.valuation * 100) / 100,
    news: Math.round(scores.news * 100) / 100,
    risk: Math.round(scores.risk * 100) / 100,
    evidenceQuality: Math.round(evidenceQuality * 100) / 100,
    contradictionPenalty,
    final: Math.round(finalScore * 100) / 100,
    decision,
  };
}
