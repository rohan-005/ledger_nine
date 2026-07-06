import "server-only";
import { DetailedScores } from "./scoring";
import { SCORING_CONFIG } from "@/src/config/scoring.config";

export interface DecisionOutput {
  detailedScores: DetailedScores;
  finalScore: number | null;
  verdict: "INVEST" | "WATCH" | "PASS" | null;
  totalPenalty: number;
}

const CATEGORY_WEIGHTS: Record<keyof DetailedScores, number> = {
  financialQuality: 0.20,
  growthQuality: 0.15,
  valuation: 0.15,
  businessQuality: 0.15,
  competitivePosition: 0.10,
  risk: 0.10,
  managementGovernance: 0.08,
  earningsQuality: 0.07,
};

export function evaluateVerdict(
  scores: DetailedScores,
  contradictionPenalty: number,
  sufficiencyPassed: boolean = true
): DecisionOutput {
  if (!sufficiencyPassed) {
    return {
      detailedScores: scores,
      finalScore: null,
      verdict: null,
      totalPenalty: 0,
    };
  }

  let weightedSum = 0;
  let weightSum = 0;

  for (const key of Object.keys(CATEGORY_WEIGHTS) as Array<keyof DetailedScores>) {
    const val = scores[key];
    if (val !== null && val !== undefined && !isNaN(val)) {
      weightedSum += val * CATEGORY_WEIGHTS[key];
      weightSum += CATEGORY_WEIGHTS[key];
    }
  }

  let finalScore: number | null = null;
  let verdict: "INVEST" | "WATCH" | "PASS" | null = null;

  if (weightSum > 0) {
    const rawScore = weightedSum / weightSum;
    // Apply contradiction penalty (capped by configuration)
    const cap = SCORING_CONFIG.penalties.maxContradictionPenalty;
    const appliedPenalty = Math.min(contradictionPenalty, cap);
    finalScore = Math.max(0, Math.min(100, rawScore - appliedPenalty));

    // Map final score to 3-tier verdict
    // >= 65: INVEST
    // >= 50 and < 65: WATCH
    // < 50: PASS
    if (finalScore >= 65) {
      verdict = "INVEST";
    } else if (finalScore >= 50) {
      verdict = "WATCH";
    } else {
      verdict = "PASS";
    }
  }

  return {
    detailedScores: scores,
    finalScore: finalScore !== null ? Math.round(finalScore) : null,
    verdict,
    totalPenalty: contradictionPenalty,
  };
}
