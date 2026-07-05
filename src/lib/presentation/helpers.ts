export interface ScoreBandInfo {
  label: string;
  color: string;
  bg: string;
  border: string;
  desc: string;
}

export function getScoreBand(score: number): ScoreBandInfo {
  if (score >= 85) {
    return {
      label: "Excellent",
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      desc: "Outstanding metrics with negligible signs of weakness.",
    };
  }
  if (score >= 70) {
    return {
      label: "Strong",
      color: "text-emerald-600",
      bg: "bg-emerald-50/50",
      border: "border-emerald-100/50",
      desc: "Solid fundamentals and positive outlook with manageable risks.",
    };
  }
  if (score >= 55) {
    return {
      label: "Mixed",
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-100",
      desc: "Average performance, balanced risk/reward trade-offs.",
    };
  }
  if (score >= 40) {
    return {
      label: "Weak",
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-100",
      desc: "Underperforming indicators or notable structural risks.",
    };
  }
  return {
    label: "Poor",
    color: "text-red-800 font-extrabold",
    bg: "bg-red-50",
    border: "border-red-200",
    desc: "Severe financial distress, high valuations, or major news concerns.",
  };
}

export interface VerdictInfo {
  label: string;
  color: string;
  bg: string;
  border: string;
  desc: string;
}

export function getFriendlyVerdict(
  decision: "INVEST" | "PASS",
  score: number,
  evidenceQuality: number
): VerdictInfo {
  if (decision === "INVEST") {
    if (score >= 75 && evidenceQuality >= 70) {
      return {
        label: "Worth a closer look",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
        desc: "Strong performance scores and high evidence confidence support a compelling investment thesis.",
      };
    }
    return {
      label: "Promising, but review the risks",
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-100",
      desc: "The metrics lean positive, but key risk factors or contradictions demand careful review.",
    };
  } else {
    if (score >= 55) {
      return {
        label: "Proceed with caution",
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-100",
        desc: "Score is close to our minimum threshold, but risks or valuation flags suggest holding off.",
      };
    }
    return {
      label: "Not compelling right now",
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-100",
      desc: "The evidence highlights weak financial metrics, high risk profiles, or insufficient evidence quality.",
    };
  }
}

export function getFriendlySourceName(type: string): string {
  const mapping: Record<string, string> = {
    sec: "Company filing (SEC)",
    fmp: "Financial data (FMP)",
    tavily: "News & web research (Tavily)",
    alpha_vantage: "Supplemental pricing & macro (Alpha Vantage)",
    llm_inference: "Synthesis engine",
  };
  return mapping[type.toLowerCase()] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export function getFriendlyNodeName(nodeName: string): string {
  const mapping: Record<string, string> = {
    specialists: "Extracting facts across 5 specialized domains",
    contradictions: "Auditing claims for conflicting details",
    scoring: "Calculating final deterministic scores",
    committee: "Drafting plain-English thesis synthesis",
  };
  return mapping[nodeName.toLowerCase()] ?? nodeName;
}
