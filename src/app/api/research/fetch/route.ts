import { NextRequest, NextResponse } from "next/server";
import { runDiagnosticsPipeline } from "@/src/lib/research/fetchAllProviders";
import { buildEvidenceBundle } from "@/src/lib/research/buildEvidenceBundle";
import { buildSnapshot } from "@/src/lib/research/snapshotEngine";
import { runCompanyAnalysis } from "@/src/lib/research/llmAnalysis";
import { runAllProviderHealthChecks } from "@/src/lib/providers/healthCheck";
import { CURATED_COMPANIES } from "@/src/data/curatedCompanies";
import { logger } from "@/src/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let company = body.company;
    const simulate = body.simulate; // { gemini?: string, groq?: string }

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

    // 1. Run multi-provider diagnostics pipeline
    const diagnostics = await runDiagnosticsPipeline(companyIdentity);

    // 2. Fetch or load cached provider health status mapping
    const health = await runAllProviderHealthChecks(false);

    // 3. Build structured evidence bundle
    const evidenceBundle = buildEvidenceBundle(companyIdentity, diagnostics.allEndpoints, health.statusMap);

    // 4. Compile CompanyMarketSnapshot resolving conflicts
    const snapshot = buildSnapshot(evidenceBundle);

    // 5. Run LLM Analysis fallback chain (Groq only)
    const analysisRunResult = await runCompanyAnalysis(evidenceBundle, snapshot, snapshot.categoryAssessments, simulate);

    // Combine everything into a single diagnostic response contract
    const responsePayload = {
      ...diagnostics,
      evidenceBundle,
      snapshot,
      signals: null,
      analysisRunResult,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    logger.error("Fetch API Route: Failed to execute diagnostics", { error: error.message });
    return NextResponse.json({ error: "Failed to run diagnostics: " + error.message }, { status: 500 });
  }
}
