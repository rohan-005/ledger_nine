import "server-only";
import { CompanyIdentity } from "../company/symbolCandidates";
import { EndpointResult } from "../providers/shared/types";

export interface EvidenceItem {
  id: string;
  provider: string;
  endpoint: string;
  observedAt: string;
  data: unknown;
}

export interface EvidenceBundle {
  company: {
    name: string;
    ticker: string;
    exchange: string | null;
    country: string | null;
  };
  providerHealth: Record<string, string>;
  companyProfiles: EvidenceItem[];
  quotes: EvidenceItem[];
  financialStatements: EvidenceItem[];
  metrics: EvidenceItem[];
  ratios: EvidenceItem[];
  historicalPrices: EvidenceItem[];
  news: EvidenceItem[];
  webResearch: EvidenceItem[];
  providerFailures: {
    provider: string;
    endpoint: string;
    status: string;
    error: string;
  }[];
  evidenceIndex: Record<string, EvidenceItem>;
}

/**
 * Categorizes and bundles successful endpoint results into a compact factual evidence package.
 */
export function buildEvidenceBundle(
  company: CompanyIdentity,
  results: EndpointResult[],
  providerHealth: Record<string, string>
): EvidenceBundle {
  const companyProfiles: EvidenceItem[] = [];
  const quotes: EvidenceItem[] = [];
  const financialStatements: EvidenceItem[] = [];
  const metrics: EvidenceItem[] = [];
  const ratios: EvidenceItem[] = [];
  const historicalPrices: EvidenceItem[] = [];
  const news: EvidenceItem[] = [];
  const webResearch: EvidenceItem[] = [];
  
  const providerFailures: EvidenceBundle["providerFailures"] = [];
  const evidenceIndex: Record<string, EvidenceItem> = {};
  
  let evidenceCounter = 1;
  const nextId = () => `ev_${evidenceCounter++}`;

  for (const res of results) {
    if (!res.ok) {
      providerFailures.push({
        provider: res.provider,
        endpoint: res.endpointName,
        status: res.status,
        error: res.error?.message || "Endpoint error",
      });
      continue;
    }

    const item: EvidenceItem = {
      id: nextId(),
      provider: res.provider,
      endpoint: res.endpointName,
      observedAt: res.completedAt,
      data: res.response.data || res.response.raw, // Prefer normalized data
    };

    evidenceIndex[item.id] = item;

    const endpointLower = res.endpointName.toLowerCase();
    const providerLower = res.provider.toLowerCase();

    if (endpointLower.includes("profile")) {
      companyProfiles.push(item);
    } else if (endpointLower.includes("quote")) {
      quotes.push(item);
    } else if (
      endpointLower.includes("statement") ||
      endpointLower.includes("balance sheet") ||
      endpointLower.includes("income") ||
      endpointLower.includes("cash flow") ||
      endpointLower.includes("submissions") ||
      endpointLower.includes("company facts")
    ) {
      financialStatements.push(item);
    } else if (endpointLower.includes("metrics") || endpointLower.includes("basic financials")) {
      metrics.push(item);
    } else if (endpointLower.includes("ratios")) {
      ratios.push(item);
    } else if (
      endpointLower.includes("historical") ||
      endpointLower.includes("time series") ||
      endpointLower.includes("chart")
    ) {
      historicalPrices.push(item);
    } else if (endpointLower.includes("news") || endpointLower.includes("articles")) {
      news.push(item);
    } else if (providerLower === "tavily" || endpointLower.includes("search")) {
      webResearch.push(item);
    } else {
      // Default fallback grouping
      webResearch.push(item);
    }
  }

  return {
    company: {
      name: company.name,
      ticker: company.displayTicker,
      exchange: company.exchange,
      country: company.country,
    },
    providerHealth,
    companyProfiles,
    quotes,
    financialStatements,
    metrics,
    ratios,
    historicalPrices,
    news,
    webResearch,
    providerFailures,
    evidenceIndex,
  };
}
