export interface CompanyIdentity {
  name: string;
  displayTicker: string;
  canonicalTicker: string | null;
  exchange: string | null;
  country: string | null;
  currency: string | null;
  isin: string | null;
}

export interface ProviderCandidates {
  fmp: string[];
  finnhub: string[];
  twelveData: string[];
  eodhd: string[];
}

/**
 * Generates candidate symbols for each symbol-based provider.
 */
export function getProviderCandidates(company: CompanyIdentity): ProviderCandidates {
  const display = company.displayTicker.toUpperCase().trim();
  const canonical = (company.canonicalTicker || display).toUpperCase().trim();
  const country = (company.country || "").trim().toLowerCase();
  const exchange = (company.exchange || "").trim().toUpperCase();

  const isIndia = country === "india" || exchange === "NSE" || exchange === "BSE";

  // FMP Candidates
  const fmp: string[] = [];
  if (isIndia) {
    if (exchange === "BSE") {
      fmp.push(`${display}.BO`);
      fmp.push(canonical);
    } else {
      fmp.push(`${display}.NS`);
      fmp.push(canonical);
      fmp.push(`${display}.BO`);
    }
  } else {
    fmp.push(canonical);
    fmp.push(display);
  }

  // Finnhub Candidates
  const finnhub: string[] = [];
  if (isIndia) {
    if (exchange === "BSE") {
      finnhub.push(`${display}.BO`);
      finnhub.push(canonical);
    } else {
      finnhub.push(`${display}.NS`);
      finnhub.push(canonical);
    }
  } else {
    finnhub.push(canonical);
    finnhub.push(display);
  }

  // Twelve Data Candidates
  const twelveData: string[] = [];
  twelveData.push(display); // Twelve Data matches standard display ticker e.g. RELIANCE, AAPL
  if (isIndia) {
    twelveData.push(`${display}:NSE`);
    twelveData.push(`${display}:BSE`);
  }
  twelveData.push(canonical);

  // EODHD Candidates
  // Uses .US for US equities, .NSE / .BSE for Indian equities
  const eodhd: string[] = [];
  if (isIndia) {
    if (exchange === "BSE") {
      eodhd.push(`${display}.BSE`);
      eodhd.push(`${display}.NSE`);
    } else {
      eodhd.push(`${display}.NSE`);
      eodhd.push(`${display}.BSE`);
    }
    eodhd.push(canonical);
  } else {
    if (country === "us" || country === "united states" || ["nasdaq", "nyse", "amex"].includes(exchange.toLowerCase())) {
      eodhd.push(`${display}.US`);
    }
    eodhd.push(canonical);
    eodhd.push(display);
  }

  // Deduplicate and filter out empty strings
  const cleanList = (list: string[]) =>
    Array.from(new Set(list.map((s) => s.trim().toUpperCase()).filter(Boolean)));

  return {
    fmp: cleanList(fmp),
    finnhub: cleanList(finnhub),
    twelveData: cleanList(twelveData),
    eodhd: cleanList(eodhd),
  };
}
