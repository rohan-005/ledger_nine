import { NextRequest, NextResponse } from "next/server";
import { researchGraph } from "@/src/lib/research/researchGraph";
import { CURATED_COMPANIES } from "@/src/data/curatedCompanies";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let company = body.company;
    const simulate = body.simulate; // { groq?: string }

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

    // Invoke the LangGraph workflow
    const resultState = await researchGraph.invoke({
      ticker: companyIdentity.displayTicker,
      companyIdentity,
      simulate,
    });

    if (resultState.status === "unavailable" && !resultState.diagnostics) {
      return NextResponse.json(
        { error: "Research pipeline was unavailable: " + resultState.errors.join("; ") },
        { status: 500 }
      );
    }

    // Combine everything into the single diagnostic response contract expected by the frontend
    const responsePayload = {
      ...resultState.diagnostics,
      evidenceBundle: resultState.evidenceBundle,
      snapshot: resultState.snapshot,
      signals: null,
      analysisRunResult: resultState.analysisRunResult,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    logger.error("Fetch API Route: Failed to execute diagnostics via LangGraph", { error: error.message });
    return NextResponse.json({ error: "Failed to run diagnostics: " + error.message }, { status: 500 });
  }
}
