/**
 * Generic Metric Registry
 *
 * Defines semantic properties for well-known financial and operational metrics.
 * This registry contains NO company names, ticker symbols, report IDs, or
 * company-specific thresholds. The same definitions apply to every company.
 *
 * PURPOSE:
 * - Contradiction comparability gating: two claims are comparable only if they
 *   share the same metricFamily (or are explicitly related by an inverse).
 * - Validity hints: expected value ranges for the normalizedValue field.
 * - Directional context: whether a higher value is generally favorable.
 *
 * RULES FOR ADDITIONS:
 * - Add a metric by its canonical semantic name, not by company association.
 * - "higherIsBetter" may be true, false, or "context-dependent" when the
 *   direction depends on magnitude or sector (e.g. PE ratio).
 * - Do NOT add metrics because they appear in a specific fixture.
 * - If a metric's semantics are genuinely unknown, do not add it — the engine
 *   treats unknown metrics as family "unknown" and still scores them.
 */

export type MetricDirection = "higher-is-better" | "lower-is-better" | "context-dependent";

export type MetricFamily =
  | "growth"
  | "profitability"
  | "liquidity"
  | "leverage"
  | "efficiency"
  | "valuation_multiple"
  | "market_price"
  | "market_sentiment"
  | "risk_exposure"
  | "regulatory"
  | "macroeconomic"
  | "unknown";

export interface MetricDefinition {
  /** Canonical metric identifier (snake_case) */
  metricId: string;
  /** Human-readable label for ledger display */
  label: string;
  /** Semantic family — determines contradiction comparability */
  family: MetricFamily;
  /** General directional interpretation. Not company-specific. */
  direction: MetricDirection;
  /**
   * Evidence categories where this metric is typically found.
   * Used as a hint — not a hard enforcement rule.
   */
  compatibleCategories: string[];
}

/**
 * Canonical metric definitions.
 * Every entry applies universally to all companies.
 */
export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  // ── Growth ───────────────────────────────────────────────────────────────
  { metricId: "revenue_growth",     label: "Revenue Growth",          family: "growth",            direction: "context-dependent", compatibleCategories: ["financial"] },
  { metricId: "net_income_growth",  label: "Net Income Growth",       family: "growth",            direction: "context-dependent", compatibleCategories: ["financial"] },
  { metricId: "eps_growth",         label: "EPS Growth",              family: "growth",            direction: "context-dependent", compatibleCategories: ["financial"] },
  { metricId: "fcf_growth",         label: "Free Cash Flow Growth",   family: "growth",            direction: "context-dependent", compatibleCategories: ["financial"] },

  // ── Profitability ─────────────────────────────────────────────────────────
  { metricId: "revenue",            label: "Revenue",                 family: "profitability",     direction: "context-dependent", compatibleCategories: ["financial"] },
  { metricId: "net_income",         label: "Net Income",              family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "gross_margin",       label: "Gross Margin",            family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "operating_margin",   label: "Operating Margin",        family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "net_margin",         label: "Net Margin",              family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "roe",                label: "Return on Equity",        family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "roa",                label: "Return on Assets",        family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "free_cash_flow",     label: "Free Cash Flow",          family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "eps",                label: "Earnings Per Share",      family: "profitability",     direction: "higher-is-better",  compatibleCategories: ["financial"] },

  // ── Liquidity ─────────────────────────────────────────────────────────────
  { metricId: "current_ratio",      label: "Current Ratio",           family: "liquidity",         direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "quick_ratio",        label: "Quick Ratio",             family: "liquidity",         direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "cash_ratio",         label: "Cash Ratio",              family: "liquidity",         direction: "higher-is-better",  compatibleCategories: ["financial"] },

  // ── Leverage ──────────────────────────────────────────────────────────────
  { metricId: "debt_to_equity",     label: "Debt-to-Equity",          family: "leverage",          direction: "lower-is-better",   compatibleCategories: ["financial"] },
  { metricId: "debt_to_ebitda",     label: "Debt-to-EBITDA",          family: "leverage",          direction: "lower-is-better",   compatibleCategories: ["financial"] },
  { metricId: "interest_coverage",  label: "Interest Coverage Ratio", family: "leverage",          direction: "higher-is-better",  compatibleCategories: ["financial"] },

  // ── Efficiency ────────────────────────────────────────────────────────────
  { metricId: "asset_turnover",          label: "Asset Turnover",            family: "efficiency", direction: "higher-is-better",  compatibleCategories: ["financial"] },
  { metricId: "inventory_turnover",      label: "Inventory Turnover",        family: "efficiency", direction: "context-dependent", compatibleCategories: ["financial"] },
  { metricId: "cash_conversion_cycle",   label: "Cash Conversion Cycle",     family: "efficiency", direction: "lower-is-better",   compatibleCategories: ["financial"] },

  // ── Valuation Multiples ───────────────────────────────────────────────────
  { metricId: "pe_ratio",           label: "Price-to-Earnings Ratio", family: "valuation_multiple", direction: "context-dependent", compatibleCategories: ["valuation"] },
  { metricId: "ps_ratio",           label: "Price-to-Sales Ratio",    family: "valuation_multiple", direction: "context-dependent", compatibleCategories: ["valuation"] },
  { metricId: "pb_ratio",           label: "Price-to-Book Ratio",     family: "valuation_multiple", direction: "context-dependent", compatibleCategories: ["valuation"] },
  { metricId: "ev_ebitda",          label: "EV/EBITDA",               family: "valuation_multiple", direction: "context-dependent", compatibleCategories: ["valuation"] },
  { metricId: "peg_ratio",          label: "PEG Ratio",               family: "valuation_multiple", direction: "lower-is-better",   compatibleCategories: ["valuation"] },

  // ── Market Price ──────────────────────────────────────────────────────────
  { metricId: "price",              label: "Share Price",             family: "market_price",      direction: "context-dependent", compatibleCategories: ["valuation", "news"] },
  { metricId: "target_price",       label: "Analyst Target Price",    family: "market_price",      direction: "context-dependent", compatibleCategories: ["valuation"] },
  { metricId: "price_return_1y",    label: "1-Year Price Return",     family: "market_price",      direction: "context-dependent", compatibleCategories: ["valuation", "news"] },
  { metricId: "beta",               label: "Beta",                    family: "market_price",      direction: "context-dependent", compatibleCategories: ["risk", "valuation"] },

  // ── Market Sentiment ──────────────────────────────────────────────────────
  { metricId: "analyst_rating",     label: "Analyst Rating",          family: "market_sentiment",  direction: "higher-is-better",  compatibleCategories: ["news", "valuation"] },
  { metricId: "news_sentiment",     label: "News Sentiment Score",    family: "market_sentiment",  direction: "higher-is-better",  compatibleCategories: ["news"] },

  // ── Risk ──────────────────────────────────────────────────────────────────
  { metricId: "regulatory_risk",    label: "Regulatory Risk Level",   family: "risk_exposure",     direction: "lower-is-better",   compatibleCategories: ["risk"] },
  { metricId: "operational_risk",   label: "Operational Risk Level",  family: "risk_exposure",     direction: "lower-is-better",   compatibleCategories: ["risk"] },
  { metricId: "geopolitical_risk",  label: "Geopolitical Risk",       family: "risk_exposure",     direction: "lower-is-better",   compatibleCategories: ["risk"] },
];

/** Lookup by metricId, returns undefined for unknown metrics. */
const registryIndex = new Map<string, MetricDefinition>(
  METRIC_REGISTRY.map((m) => [m.metricId, m])
);

export function lookupMetric(metricId: string): MetricDefinition | undefined {
  return registryIndex.get(metricId);
}

/**
 * Determine the metric family of an evidence category when no explicit metricId
 * is known. Falls back to "unknown" — which is a valid, scoreable state.
 *
 * This function NEVER inspects ticker or company identity.
 */
export function categoryToDefaultFamily(category: string): MetricFamily {
  const map: Record<string, MetricFamily> = {
    financial: "profitability",
    valuation: "valuation_multiple",
    business: "unknown",
    news: "market_sentiment",
    risk: "risk_exposure",
  };
  return map[category] ?? "unknown";
}

/**
 * Two evidence items are considered potentially comparable (eligible for
 * contradiction penalty) only if they share the same evidence category.
 * Items in different categories measure different dimensions and cannot
 * be direct contradictions.
 *
 * This is a necessary (not sufficient) condition for comparability.
 * The scoring engine applies additional numeric and temporal filters.
 *
 * This function is purely semantic — it does not inspect ticker or company name.
 */
export function areCategoriesComparable(categoryA: string, categoryB: string): boolean {
  return categoryA === categoryB;
}
