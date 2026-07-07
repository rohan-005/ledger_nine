import "server-only";
import { EvidenceBundle, EvidenceItem } from "./buildEvidenceBundle";

export interface CompactedEvidence {
  company: {
    name: string;
    ticker: string;
    exchange: string | null;
    country: string | null;
  };
  providerHealth: Record<string, string>;
  quotes: {
    id: string;
    provider: string;
    price: number | null;
    changePercent: number | null;
    volume: number | null;
    marketCap: number | null;
    pe: number | null;
    pb: number | null;
  }[];
  companyProfiles: {
    id: string;
    provider: string;
    sector: string | null;
    industry: string | null;
    description: string | null;
  }[];
  financialStatements: {
    id: string;
    provider: string;
    year: number | null;
    revenue: number | null;
    netIncome: number | null;
    operatingCashFlow: number | null;
    freeCashFlow: number | null;
  }[];
  metrics: {
    id: string;
    provider: string;
    pe: number | null;
    pb: number | null;
    eps: number | null;
  }[];
  ratios: {
    id: string;
    provider: string;
    debtToEquity: number | null;
    roe: number | null;
  }[];
  historicalPricesSummary: {
    id: string;
    provider: string;
    candleCount: number;
    startPrice: number | null;
    endPrice: number | null;
    high: number | null;
    low: number | null;
  }[];
  news: {
    id: string;
    provider: string;
    title: string;
    date: string | null;
    summary: string | null;
  }[];
  webResearch: {
    id: string;
    provider: string;
    results: { title: string; content: string }[];
  }[];
  providerFailures: {
    provider: string;
    endpoint: string;
    status: string;
    error: string;
  }[];
}

export function compactEvidenceBundle(bundle: EvidenceBundle): CompactedEvidence {
  // 1. Quotes Compacting
  const quotes = bundle.quotes.map((q) => {
    const d = (q.data || {}) as Record<string, any>;
    return {
      id: q.id,
      provider: q.provider,
      price: d.price ?? d.close ?? d.price_avg ?? null,
      changePercent: d.changePercent ?? d.change_percent ?? d.percent_change ?? null,
      volume: d.volume ?? null,
      marketCap: d.marketCap ?? d.market_cap ?? null,
      pe: d.pe ?? d.peRatio ?? null,
      pb: d.pb ?? d.pbRatio ?? null,
    };
  });

  // 2. Profiles Compacting
  const companyProfiles = bundle.companyProfiles.map((p) => {
    const d = (p.data || {}) as Record<string, any>;
    // Limit description size
    let description: string | null = d.description || d.businessSummary || null;
    if (description && description.length > 300) {
      description = description.slice(0, 300) + "...";
    }
    return {
      id: p.id,
      provider: p.provider,
      sector: d.sector ?? null,
      industry: d.industry ?? null,
      description,
    };
  });

  // 3. Financial Statements Compacting
  const financialStatements = bundle.financialStatements.flatMap((stmt) => {
    const list = Array.isArray(stmt.data) ? stmt.data : [stmt.data];
    return list.map((item: any) => {
      const d = (item || {}) as Record<string, any>;
      // Extract year
      let year: number | null = null;
      if (d.calendarYear) year = parseInt(d.calendarYear);
      else if (d.year) year = parseInt(d.year);
      else if (d.date) year = new Date(d.date).getFullYear();

      return {
        id: stmt.id,
        provider: stmt.provider,
        year,
        revenue: d.revenue ?? d.totalRevenue ?? d.sales ?? null,
        netIncome: d.netIncome ?? d.net_income ?? null,
        operatingCashFlow: d.operatingCashFlow ?? d.operating_cash_flow ?? d.cashFlowFromOperations ?? null,
        freeCashFlow: d.freeCashFlow ?? d.free_cash_flow ?? null,
      };
    });
  });

  // 4. Metrics Compacting
  const metrics = bundle.metrics.flatMap((m) => {
    const list = Array.isArray(m.data) ? m.data : [m.data];
    return list.map((item: any) => {
      const d = (item || {}) as Record<string, any>;
      return {
        id: m.id,
        provider: m.provider,
        pe: d.peRatio ?? d.pe ?? null,
        pb: d.pbRatio ?? d.pb ?? null,
        eps: d.eps ?? d.eps_actual ?? null,
      };
    });
  });

  // 5. Ratios Compacting
  const ratios = bundle.ratios.flatMap((r) => {
    const list = Array.isArray(r.data) ? r.data : [r.data];
    return list.map((item: any) => {
      const d = (item || {}) as Record<string, any>;
      return {
        id: r.id,
        provider: r.provider,
        debtToEquity: d.debtToEquity ?? d.debt_to_equity ?? null,
        roe: d.roe ?? d.returnOnEquity ?? null,
      };
    });
  });

  // 6. Historical Prices Compacting
  const historicalPricesSummary = bundle.historicalPrices.map((h) => {
    const list = Array.isArray(h.data) ? h.data : [];
    if (list.length === 0) {
      return {
        id: h.id,
        provider: h.provider,
        candleCount: 0,
        startPrice: null,
        endPrice: null,
        high: null,
        low: null,
      };
    }

    const prices = list.map((candle: any) => candle.close ?? candle.price ?? 0).filter(Boolean);
    const startPrice = list[list.length - 1]?.close ?? list[list.length - 1]?.price ?? null;
    const endPrice = list[0]?.close ?? list[0]?.price ?? null;
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    return {
      id: h.id,
      provider: h.provider,
      candleCount: list.length,
      startPrice,
      endPrice,
      high: high === -Infinity ? null : high,
      low: low === Infinity ? null : low,
    };
  });

  // 7. News Compacting (Limit to top 5 articles)
  const news = bundle.news.flatMap((n) => {
    const list = Array.isArray(n.data) ? n.data : [n.data];
    return list.map((item: any) => {
      const d = (item || {}) as Record<string, any>;
      let summary = d.summary || d.description || d.text || null;
      if (summary && summary.length > 200) {
        summary = summary.slice(0, 200) + "...";
      }
      return {
        id: n.id,
        provider: n.provider,
        title: d.title || "",
        date: d.date || d.publishedAt || d.time || null,
        summary,
      };
    });
  }).slice(0, 5); // Take top 5 news articles overall

  // 8. Web Research Compacting (Limit to top 3 search runs)
  const webResearch = bundle.webResearch.map((w) => {
    const d = (w.data || {}) as Record<string, any>;
    const results = Array.isArray(d.results) ? d.results : [];
    const slicedResults = results.slice(0, 3).map((r: any) => {
      let content = r.content || r.snippet || "";
      if (content.length > 250) {
        content = content.slice(0, 250) + "...";
      }
      return {
        title: r.title || "",
        content,
      };
    });

    return {
      id: w.id,
      provider: w.provider,
      results: slicedResults,
    };
  }).slice(0, 3); // Take top 3 web research runs

  return {
    company: bundle.company,
    providerHealth: bundle.providerHealth,
    quotes,
    companyProfiles,
    financialStatements,
    metrics,
    ratios,
    historicalPricesSummary,
    news,
    webResearch,
    providerFailures: bundle.providerFailures,
  };
}
