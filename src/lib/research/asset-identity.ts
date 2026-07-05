import "server-only";

export interface AssetIdentity {
  symbol: string;
  companyName: string | null;
  exchange: string | null;
  country: string | null;
  market: string | null;
  currency: string | null;
  cik: string | null;
  resolved: boolean;
}

/**
 * Parses raw profile payload from Financial Modeling Prep (FMP) or any other source
 * and converts it into a canonical, sanitized AssetIdentity object.
 */
export function parseAssetProfile(ticker: string, profile: Record<string, any> | null | undefined): AssetIdentity {
  if (!profile || !profile.symbol) {
    return {
      symbol: ticker.toUpperCase().trim(),
      companyName: null,
      exchange: null,
      country: null,
      market: null,
      currency: null,
      cik: null,
      resolved: false,
    };
  }

  const symbol = String(profile.symbol).toUpperCase().trim();
  const companyName = profile.companyName ? String(profile.companyName).trim() : null;
  const exchange = profile.exchange ? String(profile.exchange).trim() : null;
  const country = profile.country ? String(profile.country).trim() : null;
  const market = profile.exchangeShortName ? String(profile.exchangeShortName).trim() : null;
  const currency = profile.currency ? String(profile.currency).trim() : null;
  const cik = profile.cik ? String(profile.cik).trim() : null;

  // The asset is resolved if we get a valid company name from the data source
  const resolved = typeof companyName === "string" && companyName.length > 0;

  return {
    symbol,
    companyName,
    exchange,
    country,
    market,
    currency,
    cik,
    resolved,
  };
}
