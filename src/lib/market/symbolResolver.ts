import "server-only";
import { CURATED_COMPANIES, CompanyCatalogItem } from "@/src/data/curatedCompanies";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
import { logger } from "@/src/lib/logger";

export interface CanonicalSymbol {
  companyName: string;
  displayTicker: string;
  canonicalTicker: string;
  exchange: string;
  country: string;
  providerSymbols: {
    finnhub: string;
    fmp: string;
    newsapi: string;
    tavily: string;
  };
}

/**
 * Resolves a user-typed query (symbol, company name, or alias) into a CanonicalSymbol.
 */
export async function resolveSymbol(query: string): Promise<CanonicalSymbol | null> {
  const cleanQuery = query.trim().toUpperCase();
  if (!cleanQuery) return null;

  logger.info("Resolver: Resolving symbol", { query });

  // 1. Search in local curated catalog first
  const localMatch = findLocalCuratedCompany(cleanQuery);
  if (localMatch) {
    logger.info("Resolver: Local catalog match found", { localMatch });
    return mapCatalogItemToCanonical(localMatch);
  }

  // 2. Check suffix for exchange qualification (.NS, .BO)
  if (cleanQuery.endsWith(".NS") || cleanQuery.endsWith(".BO")) {
    const isNse = cleanQuery.endsWith(".NS");
    const exchange = isNse ? "NSE" : "BSE";
    const baseTicker = cleanQuery.substring(0, cleanQuery.length - 3);

    logger.info("Resolver: Inferred exchange from suffix", { cleanQuery, exchange });
    return {
      companyName: baseTicker, // Default to baseTicker as name, will be updated if dynamic profile succeeds
      displayTicker: baseTicker,
      canonicalTicker: cleanQuery,
      exchange,
      country: "India",
      providerSymbols: {
        finnhub: cleanQuery,
        fmp: cleanQuery,
        newsapi: baseTicker,
        tavily: baseTicker,
      },
    };
  }

  // 3. Dynamic provider search fallback
  logger.info("Resolver: No local match. Performing dynamic provider search.", { cleanQuery });
  try {
    const searchResults = await fmpClient.search(cleanQuery, 5);
    if (searchResults && searchResults.length > 0) {
      // Find the first result matching cleanQuery as symbol or name prefix
      const match = searchResults[0];
      const symbol = String(match.symbol).toUpperCase();
      const name = String(match.name || symbol);
      const rawExchange = String(match.exchangeShortName || "").toUpperCase();

      let exchange = "UNKNOWN";
      let country = "UNKNOWN";
      
      if (rawExchange === "NSE" || symbol.endsWith(".NS")) {
        exchange = "NSE";
        country = "India";
      } else if (rawExchange === "BSE" || symbol.endsWith(".BO")) {
        exchange = "BSE";
        country = "India";
      } else if (["NASDAQ", "NYSE", "AMEX", "BATS"].includes(rawExchange)) {
        exchange = rawExchange;
        country = "US";
      } else {
        exchange = rawExchange || "UNKNOWN";
      }

      const hasNsBo = symbol.endsWith(".NS") || symbol.endsWith(".BO");
      const displayTicker = hasNsBo ? symbol.substring(0, symbol.length - 3) : symbol;

      logger.info("Resolver: Dynamic search match found", { symbol, name, exchange, country });

      return {
        companyName: name,
        displayTicker,
        canonicalTicker: symbol,
        exchange,
        country,
        providerSymbols: {
          finnhub: symbol,
          fmp: symbol,
          newsapi: name,
          tavily: name,
        },
      };
    }
  } catch (err) {
    logger.warn("Resolver: Dynamic search failed", { query: cleanQuery, err });
  }

  // 4. Ultimate fallback (heuristic-based)
  // If all fails, treat it as a standard US or plain symbol
  logger.info("Resolver: Falling back to plain symbol structure", { cleanQuery });
  return {
    companyName: cleanQuery,
    displayTicker: cleanQuery,
    canonicalTicker: cleanQuery,
    exchange: "UNKNOWN",
    country: "UNKNOWN",
    providerSymbols: {
      finnhub: cleanQuery,
      fmp: cleanQuery,
      newsapi: cleanQuery,
      tavily: cleanQuery,
    },
  };
}

/**
 * Searches the local curated catalog for a match.
 */
function findLocalCuratedCompany(query: string): CompanyCatalogItem | null {
  const lower = query.toLowerCase();

  // Try exact ticker match
  let match = CURATED_COMPANIES.find(
    (c) => c.ticker.toLowerCase() === lower || c.canonicalTicker.toLowerCase() === lower
  );
  if (match) return match;

  // Try exact name match
  match = CURATED_COMPANIES.find((c) => c.name.toLowerCase() === lower);
  if (match) return match;

  // Try alias match
  match = CURATED_COMPANIES.find((c) =>
    c.aliases.some((alias) => alias.toLowerCase() === lower)
  );
  if (match) return match;

  // Try partial name/alias match
  match = CURATED_COMPANIES.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      c.aliases.some((alias) => alias.toLowerCase().includes(lower))
  );
  return match || null;
}

/**
 * Maps a catalog item to a CanonicalSymbol structure.
 */
function mapCatalogItemToCanonical(item: CompanyCatalogItem): CanonicalSymbol {
  return {
    companyName: item.name,
    displayTicker: item.ticker,
    canonicalTicker: item.canonicalTicker,
    exchange: item.exchange,
    country: item.country,
    providerSymbols: {
      finnhub: item.canonicalTicker,
      fmp: item.canonicalTicker,
      newsapi: item.name,
      tavily: item.name,
    },
  };
}
