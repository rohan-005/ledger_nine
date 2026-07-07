import { NextRequest, NextResponse } from "next/server";
import { CURATED_COMPANIES, CompanyCatalogItem } from "@/src/data/curatedCompanies";
import { fmpProvider } from "@/src/lib/providers/fmp";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    if (!q) {
      // Return top curated suggestions
      return NextResponse.json(CURATED_COMPANIES.slice(0, 15));
    }

    const lowerQuery = q.toLowerCase();

    // 1. Filter local curated list
    const localMatches = CURATED_COMPANIES.filter(
      (c) =>
        c.ticker.toLowerCase().includes(lowerQuery) ||
        c.canonicalTicker.toLowerCase().includes(lowerQuery) ||
        c.name.toLowerCase().includes(lowerQuery) ||
        c.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery))
    );

    // 2. Perform dynamic FMP search
    let providerMatches: CompanyCatalogItem[] = [];
    try {
      const searchResult = await fmpProvider.search(q);
      if (searchResult.ok && Array.isArray(searchResult.response.data)) {
        providerMatches = searchResult.response.data.map((item: any) => {
          const symbol = String(item.symbol || "").toUpperCase();
          const name = String(item.name || symbol);
          const rawExchange = String(item.exchange || "").toUpperCase();

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
          const ticker = hasNsBo ? symbol.substring(0, symbol.length - 3) : symbol;

          return {
            name,
            ticker,
            canonicalTicker: symbol,
            exchange,
            country,
            aliases: [name, ticker],
          };
        });
      }
    } catch (err) {
      logger.warn("Search Route: Dynamic provider search failed", { q, err });
    }

    // 3. Merge and deduplicate by canonicalTicker
    const mergedMap = new Map<string, CompanyCatalogItem>();

    // Add local matches first to prioritize their curated metadata
    localMatches.forEach((c) => {
      mergedMap.set(c.canonicalTicker.toUpperCase(), c);
    });

    // Add provider matches (will not overwrite local matches)
    providerMatches.forEach((c) => {
      const key = c.canonicalTicker.toUpperCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, c);
      }
    });

    const finalResults = Array.from(mergedMap.values()).slice(0, 15);

    return NextResponse.json(finalResults);
  } catch (error: any) {
    logger.error("Search Route: Failed to execute search", { error: error.message });
    return NextResponse.json({ error: "Failed to search companies" }, { status: 500 });
  }
}
