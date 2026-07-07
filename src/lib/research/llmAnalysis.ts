import "server-only";
import { EvidenceBundle, EvidenceItem } from "./buildEvidenceBundle";
import { runGeminiAnalysis, LLMAnalysisResult, AnalysisOutput } from "../providers/gemini";
import { runGroqAnalysis } from "../providers/groq";
import { CompanyMarketSnapshot, SignalsBreakdown } from "../../types/snapshot";

export interface AnalysisRunResult {
  activeProvider: "gemini" | "groq" | "deterministic";
  gemini: LLMAnalysisResult;
  groq: LLMAnalysisResult;
  analysis: AnalysisOutput;
}

/**
 * Generates a rule-based deterministic summary from the evidence bundle when both LLMs fail.
 */
export function generateDeterministicSummary(bundle: EvidenceBundle, signals: SignalsBreakdown): AnalysisOutput {
  const citedEvidenceIds: string[] = [];

  // Helper to find data by endpoint category
  const findQuotePrice = (): { price: string; changePercent: string; provider: string } | null => {
    for (const q of bundle.quotes) {
      citedEvidenceIds.push(q.id);
      const d = q.data as Record<string, any>;
      if (d) {
        const price = d.price || d.price_avg || d.close || "";
        const pct = d.changePercent || d.change_percent || d.percent_change || "";
        if (price) {
          return { price: String(price), changePercent: String(pct), provider: q.provider };
        }
      }
    }
    return null;
  };

  const findRevenueAndIncome = (): { revenue: string; netIncome: string; provider: string } | null => {
    for (const stmt of bundle.financialStatements) {
      citedEvidenceIds.push(stmt.id);
      const list = Array.isArray(stmt.data) ? stmt.data : [stmt.data];
      if (list.length > 0 && list[0]) {
        const item = list[0] as Record<string, any>;
        const rev = item.revenue || item.totalRevenue || item.sales || "";
        const inc = item.netIncome || item.net_income || "";
        if (rev || inc) {
          return { revenue: String(rev), netIncome: String(inc), provider: stmt.provider };
        }
      }
    }
    return null;
  };

  const quoteInfo = findQuotePrice();
  const finInfo = findRevenueAndIncome();

  // News summary
  const newsProviders = Array.from(new Set(bundle.news.map(n => n.provider)));
  for (const n of bundle.news) citedEvidenceIds.push(n.id);
  const newsCount = bundle.news.reduce((acc, n) => {
    const list = Array.isArray(n.data) ? n.data : [n.data];
    return acc + list.length;
  }, 0);

  // Web research summary
  const webProviders = Array.from(new Set(bundle.webResearch.map(w => w.provider)));
  for (const w of bundle.webResearch) citedEvidenceIds.push(w.id);

  // Provider health summary
  const healthList = Object.entries(bundle.providerHealth)
    .map(([p, status]) => `${p}: ${status.toUpperCase()}`)
    .join(", ");

  // Strengths
  const strengths: string[] = ["Rule-based data extraction completed."];
  if (quoteInfo) {
    strengths.push(`Latest stock price retrieved: ${quoteInfo.price} via ${quoteInfo.provider}.`);
    if (parseFloat(quoteInfo.changePercent) > 0) {
      strengths.push(`Daily change is positive: +${quoteInfo.changePercent}%.`);
    }
  }
  if (finInfo) {
    strengths.push(`Financial reports successfully collected via ${finInfo.provider}.`);
  }

  // Concerns
  const concerns: string[] = [
    "Primary (Gemini) and fallback (Groq) AI analysis failed or returned invalid schemas.",
    "This summary is generated deterministically and lacks qualitative reasoning.",
  ];
  if (bundle.providerFailures.length > 0) {
    concerns.push(`${bundle.providerFailures.length} provider endpoints failed during retrieval.`);
  }

  // Conflicts
  const conflicts: string[] = [];
  if (bundle.quotes.length > 1) {
    const prices = bundle.quotes.map(q => {
      const d = q.data as Record<string, any>;
      return { provider: q.provider, price: d?.price || d?.price_avg || d?.close };
    }).filter(p => p.price !== undefined);
    
    if (prices.length > 1) {
      const diffs = prices.filter(p => String(p.price) !== String(prices[0].price));
      if (diffs.length > 0) {
        conflicts.push(`Price discrepancy: ${prices.map(p => `${p.provider}=${p.price}`).join(", ")}`);
      }
    }
  }

  return {
    companySummary: `Deterministic fallback analysis for ${bundle.company.name} (${bundle.company.ticker}). Exchange: ${bundle.company.exchange || "N/A"}. Country: ${bundle.company.country || "N/A"}.`,
    financialInterpretation: finInfo
      ? `Factual revenue of ${finInfo.revenue} and net income of ${finInfo.netIncome} extracted from ${finInfo.provider} statements.`
      : "Financial statements are unavailable or could not be normalized.",
    marketInterpretation: quoteInfo
      ? `Stock Quote: Price ${quoteInfo.price} (Daily Change %: ${quoteInfo.changePercent}%) via ${quoteInfo.provider}.`
      : "Stock quote details are unavailable or could not be normalized.",
    newsInterpretation: newsCount > 0
      ? `Retrieved ${newsCount} news articles from ${newsProviders.join(", ")}.`
      : "No news articles found for this company.",
    webResearchInterpretation: bundle.webResearch.length > 0
      ? `Web search insights obtained via ${webProviders.join(", ")} across ${bundle.webResearch.length} search runs.`
      : "Web search was not executed or returned empty results.",
    strengths,
    concerns,
    conflicts,
    evidenceGaps: ["Qualitative LLM synthesis is missing due to API limits or schema validation errors.", "Provider health status: " + healthList],
    overallSummary: "This is a deterministic, rule-based summary generated because both Gemini and Groq specialists failed or returned invalid schemas.",
    citedEvidenceIds: Array.from(new Set(citedEvidenceIds)),
    verdict: signals.deterministicVerdict,
    finalScore: signals.finalDeterministicScore,
  };
}

/**
 * Runs the LLM fallback chain: Gemini -> Groq -> Deterministic Fallback.
 */
export async function runCompanyAnalysis(
  bundle: EvidenceBundle,
  snapshot: CompanyMarketSnapshot,
  signals: SignalsBreakdown,
  simulate?: {
    gemini?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error";
    groq?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error";
  }
): Promise<AnalysisRunResult> {
  // 1. Try Gemini
  const geminiResult = await runGeminiAnalysis(bundle, snapshot, signals, simulate?.gemini);

  if (geminiResult.status === "success" && geminiResult.data) {
    return {
      activeProvider: "gemini",
      gemini: geminiResult,
      groq: {
        provider: "groq",
        status: "not_called",
        durationMs: 0,
        model: "llama-3.3-70b-versatile",
        data: null,
        message: "Gemini succeeded, Groq not called",
      },
      analysis: geminiResult.data,
    };
  }

  // 2. Try Groq (on Gemini failure)
  const groqResult = await runGroqAnalysis(bundle, snapshot, signals, simulate?.groq);

  if (groqResult.status === "success" && groqResult.data) {
    return {
      activeProvider: "groq",
      gemini: geminiResult,
      groq: groqResult,
      analysis: groqResult.data,
    };
  }

  // 3. Fallback to Deterministic Summary
  const deterministicAnalysis = generateDeterministicSummary(bundle, signals);

  return {
    activeProvider: "deterministic",
    gemini: geminiResult,
    groq: groqResult,
    analysis: deterministicAnalysis,
  };
}
