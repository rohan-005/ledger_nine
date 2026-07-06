import "server-only";

export interface AnnualData {
  calendarYear: string;
  revenue: number;
  netIncome: number;
  grossProfit?: number;
  operatingIncome?: number;
  totalDebt?: number;
  totalEquity?: number;
  operatingCashFlow?: number;
  capitalExpenditure?: number;
  interestExpense?: number;
  ebitda?: number;
}

export interface MetricTrends {
  revenueCAGR: number | null;
  revenueYoY: number[];
  netIncomeYoY: number[];
  margins: {
    gross: number[];
    operating: number[];
    net: number[];
  };
  debtToEquity: number[];
  interestCoverage: number[];
  fcfTrend: number[];
}

export function calculateCAGR(start: number, end: number, periods: number): number | null {
  if (start <= 0 || end <= 0 || periods <= 0) return null;
  try {
    const cagr = Math.pow(end / start, 1 / periods) - 1;
    return isFinite(cagr) ? cagr : null;
  } catch {
    return null;
  }
}

export function calculateYoY(current: number, prev: number): number | null {
  if (prev === 0 || !isFinite(prev)) return null;
  const growth = (current - prev) / Math.abs(prev);
  return isFinite(growth) ? growth : null;
}

export function extractNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

export function calculateFinancialTrends(statements: AnnualData[]): MetricTrends {
  // Sort statements chronologically (oldest to newest)
  const sorted = [...statements].sort((a, b) => Number(a.calendarYear) - Number(b.calendarYear));
  const n = sorted.length;

  const revenueYoY: number[] = [];
  const netIncomeYoY: number[] = [];
  const grossMargins: number[] = [];
  const operatingMargins: number[] = [];
  const netMargins: number[] = [];
  const debtToEquity: number[] = [];
  const interestCoverage: number[] = [];
  const fcfTrend: number[] = [];

  for (let i = 0; i < n; i++) {
    const curr = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;

    // YoY growth
    if (prev) {
      const revYoY = calculateYoY(curr.revenue, prev.revenue);
      if (revYoY !== null) revenueYoY.push(revYoY);

      const netYoY = calculateYoY(curr.netIncome, prev.netIncome);
      if (netYoY !== null) netIncomeYoY.push(netYoY);
    }

    // Margins
    const grossMargin = curr.revenue > 0 ? extractNumeric(curr.grossProfit) / curr.revenue : 0;
    grossMargins.push(grossMargin);

    const opMargin = curr.revenue > 0 ? extractNumeric(curr.operatingIncome) / curr.revenue : 0;
    operatingMargins.push(opMargin);

    const netMargin = curr.revenue > 0 ? curr.netIncome / curr.revenue : 0;
    netMargins.push(netMargin);

    // Debt ratios
    const totalDebt = extractNumeric(curr.totalDebt);
    const totalEquity = extractNumeric(curr.totalEquity);
    const dToE = totalEquity > 0 ? totalDebt / totalEquity : 0;
    debtToEquity.push(dToE);

    // Interest coverage
    const ebit = extractNumeric(curr.operatingIncome);
    const interest = Math.abs(extractNumeric(curr.interestExpense));
    const coverage = interest > 0 ? ebit / interest : 0;
    interestCoverage.push(coverage);

    // Free Cash Flow
    const ocf = extractNumeric(curr.operatingCashFlow);
    const capex = Math.abs(extractNumeric(curr.capitalExpenditure));
    fcfTrend.push(ocf - capex);
  }

  // CAGR over the entire period (usually 3 years of growth for 4 years of statements)
  let revenueCAGR: number | null = null;
  if (n > 1) {
    const startRev = sorted[0].revenue;
    const endRev = sorted[n - 1].revenue;
    revenueCAGR = calculateCAGR(startRev, endRev, n - 1);
  }

  return {
    revenueCAGR,
    revenueYoY,
    netIncomeYoY,
    margins: {
      gross: grossMargins,
      operating: operatingMargins,
      net: netMargins,
    },
    debtToEquity,
    interestCoverage,
    fcfTrend,
  };
}
