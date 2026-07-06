import "server-only";
import { MetricTrends } from "./metrics";

export interface QualitativeAssessments {
  businessQualityMoat: "wide" | "narrow" | "none" | "unknown";
  competitivePosition: "leader" | "strong" | "neutral" | "weak" | "unknown";
  managementGovernance: "excellent" | "good" | "mixed" | "poor" | "unknown";
  riskExposure: "low" | "medium" | "high" | "critical" | "unknown";
}

export interface DetailedScores {
  financialQuality: number;
  growthQuality: number;
  valuation: number;
  businessQuality: number;
  competitivePosition: number;
  risk: number;
  managementGovernance: number;
  earningsQuality: number;
}

export function computeDeterministicScores(
  trends: MetricTrends,
  multiples: { peRatio?: number; evEbitda?: number; pegRatio?: number },
  qualitative: QualitativeAssessments
): DetailedScores {
  // 1. Financial Quality
  // Leverage: D/E < 0.5 (100), 0.5 to 1.5 (70 to 90), > 1.5 (down to 40)
  const lastDE = trends.debtToEquity.length > 0 ? trends.debtToEquity[trends.debtToEquity.length - 1] : 1.0;
  let finLeverageScore = 70;
  if (lastDE < 0.5) finLeverageScore = 95;
  else if (lastDE <= 1.5) finLeverageScore = 90 - (lastDE - 0.5) * 20;
  else finLeverageScore = Math.max(30, 70 - (lastDE - 1.5) * 15);

  // Interest coverage: > 5 (100), 1.5 to 5 (70 to 90), < 1.5 (low)
  const lastIC = trends.interestCoverage.length > 0 ? trends.interestCoverage[trends.interestCoverage.length - 1] : 3.0;
  let finCoverageScore = 70;
  if (lastIC > 5) finCoverageScore = 95;
  else if (lastIC >= 1.5) finCoverageScore = 70 + (lastIC - 1.5) * 7;
  else finCoverageScore = Math.max(20, lastIC * 30);

  const financialQuality = Math.round((finLeverageScore + finCoverageScore) / 2);

  // 2. Growth Quality
  // Revenue CAGR: > 15% (95), 5% to 15% (75 to 95), < 5% (50 to 75), negative (30)
  const cagr = trends.revenueCAGR !== null ? trends.revenueCAGR : 0.08;
  let cagrScore = 50;
  if (cagr > 0.15) cagrScore = 95;
  else if (cagr >= 0.05) cagrScore = 75 + (cagr - 0.05) * 200;
  else if (cagr >= 0) cagrScore = 50 + cagr * 500;
  else cagrScore = Math.max(10, 50 + cagr * 200);

  // YoY growth stability (check if revenue growth was consistently positive)
  let yoyConsistency = 70;
  if (trends.revenueYoY.length > 0) {
    const positiveYears = trends.revenueYoY.filter(y => y > 0).length;
    yoyConsistency = (positiveYears / trends.revenueYoY.length) * 100;
  }
  const growthQuality = Math.round((cagrScore * 0.7) + (yoyConsistency * 0.3));

  // 3. Valuation
  // PE: < 15 (95), 15 to 25 (75), 25 to 35 (55), > 35 (35)
  const pe = multiples.peRatio !== undefined ? multiples.peRatio : 20;
  let peScore = 70;
  if (pe <= 0) peScore = 30; // negative PE indicates loss-making
  else if (pe < 15) peScore = 95 - (pe - 5) * 2;
  else if (pe <= 25) peScore = 85 - (pe - 15) * 2;
  else if (pe <= 35) peScore = 65 - (pe - 25) * 2;
  else peScore = Math.max(10, 45 - (pe - 35) * 1);

  // EV/EBITDA: < 10 (90), 10 to 18 (70), > 18 (40)
  const evEbitda = multiples.evEbitda !== undefined ? multiples.evEbitda : 12;
  let evScore = 70;
  if (evEbitda <= 0) evScore = 30;
  else if (evEbitda < 10) evScore = 90;
  else if (evEbitda <= 18) evScore = 70;
  else evScore = Math.max(20, 50 - (evEbitda - 18) * 2);

  const valuation = Math.round((peScore + evScore) / 2);

  // 4. Business Quality
  // Gross Margins: > 50% (95), 20% to 50% (75), < 20% (50)
  const lastGross = trends.margins.gross.length > 0 ? trends.margins.gross[trends.margins.gross.length - 1] : 0.4;
  let marginScore = 70;
  if (lastGross > 0.5) marginScore = 95;
  else if (lastGross >= 0.2) marginScore = 70 + (lastGross - 0.2) * 83.3;
  else marginScore = Math.max(10, lastGross * 250);

  let qualBusiness = 50;
  switch (qualitative.businessQualityMoat) {
    case "wide": qualBusiness = 90; break;
    case "narrow": qualBusiness = 70; break;
    case "none": qualBusiness = 40; break;
    case "unknown": qualBusiness = 50; break;
  }

  const businessQuality = Math.round((marginScore * 0.4) + (qualBusiness * 0.6));

  // 5. Competitive Position
  let competitivePosition = 50;
  switch (qualitative.competitivePosition) {
    case "leader": competitivePosition = 95; break;
    case "strong": competitivePosition = 80; break;
    case "neutral": competitivePosition = 60; break;
    case "weak": competitivePosition = 30; break;
    case "unknown": competitivePosition = 50; break;
  }

  // 6. Risk (High score = low risk)
  let risk = 50;
  switch (qualitative.riskExposure) {
    case "low": risk = 85; break;
    case "medium": risk = 65; break;
    case "high": risk = 45; break;
    case "critical": risk = 20; break;
    case "unknown": risk = 50; break;
  }

  // 7. Management / Governance
  let managementGovernance = 50;
  switch (qualitative.managementGovernance) {
    case "excellent": managementGovernance = 95; break;
    case "good": managementGovernance = 80; break;
    case "mixed": managementGovernance = 60; break;
    case "poor": managementGovernance = 30; break;
    case "unknown": managementGovernance = 50; break;
  }

  // 8. Earnings Quality
  // FCF / Net Income: FCF >= Net Income (95), 0 to 1 (70 to 90), negative FCF (30)
  const lastFCF = trends.fcfTrend.length > 0 ? trends.fcfTrend[trends.fcfTrend.length - 1] : 100;
  const lastNet = trends.netIncomeYoY.length > 0 ? trends.netIncomeYoY[trends.netIncomeYoY.length - 1] : 100;
  let eqScore = 70;
  if (lastFCF >= lastNet && lastNet > 0) {
    eqScore = 95;
  } else if (lastNet > 0 && lastFCF > 0) {
    eqScore = 70 + (lastFCF / lastNet) * 20;
  } else if (lastFCF < 0) {
    eqScore = 35;
  }

  const earningsQuality = Math.round(eqScore);

  return {
    financialQuality,
    growthQuality,
    valuation,
    businessQuality,
    competitivePosition,
    risk,
    managementGovernance,
    earningsQuality,
  };
}
