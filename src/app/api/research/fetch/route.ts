import { NextRequest, NextResponse } from "next/server";
import { runDiagnosticsPipeline } from "@/src/lib/research/fetchAllProviders";
import { CURATED_COMPANIES } from "@/src/data/curatedCompanies";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let company = body.company;

    if (!company && body.ticker) {
      const tickerLower = body.ticker.toLowerCase();
      // Try to find in curated catalog
      const found = CURATED_COMPANIES.find(
        (c) =>
          c.ticker.toLowerCase() === tickerLower ||
          c.canonicalTicker.toLowerCase() === tickerLower
      );

      if (found) {
        company = {
          name: found.name,
          displayTicker: found.ticker,
          canonicalTicker: found.canonicalTicker,
          exchange: found.exchange,
          country: found.country,
          currency: found.country === "India" ? "INR" : "USD",
          isin: null,
        };
      } else {
        // Construct a default identity
        company = {
          name: body.name || body.ticker,
          displayTicker: body.ticker,
          canonicalTicker: body.ticker,
          exchange: body.exchange || null,
          country: body.country || null,
          currency: null,
          isin: null,
        };
      }
    }

    if (!company || !company.displayTicker) {
      return NextResponse.json(
        { error: "Missing company identity object or ticker parameter" },
        { status: 400 }
      );
    }

    // Ensure fields are clean
    const companyIdentity = {
      name: String(company.name || company.displayTicker),
      displayTicker: String(company.displayTicker),
      canonicalTicker: company.canonicalTicker ? String(company.canonicalTicker) : null,
      exchange: company.exchange ? String(company.exchange) : null,
      country: company.country ? String(company.country) : null,
      currency: company.currency ? String(company.currency) : null,
      isin: company.isin ? String(company.isin) : null,
    };

    const diagnostics = await runDiagnosticsPipeline(companyIdentity);

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    logger.error("Fetch API Route: Failed to execute diagnostics", { error: error.message });
    return NextResponse.json({ error: "Failed to run diagnostics: " + error.message }, { status: 500 });
  }
}
