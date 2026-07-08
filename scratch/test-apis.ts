import fs from "fs";
import path from "path";

// 1. Manually load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, "").trim();
      process.env[key] = val;
    }
  }
}

// Imports using relative paths
import { finnhubProvider } from "../src/lib/providers/finnhub";
import { twelveDataProvider } from "../src/lib/providers/twelveData";
import { secProvider } from "../src/lib/providers/sec";
import { fmpProvider } from "../src/lib/providers/fmp";
import { alphaVantageProvider } from "../src/lib/providers/alphavantage";
import { newsApiProvider } from "../src/lib/providers/newsapi";
import { runGroqAnalysis } from "../src/lib/providers/groq";

async function testAll() {
  console.log("=== STARTING API DIAGNOSTICS TESTS ===");

  // --- FINNHUB ---
  console.log("\n--- Testing Finnhub ---");
  const fhUS = await finnhubProvider.getProfile("AAPL");
  console.log(`AAPL Profile status: ${fhUS.status}, OK: ${fhUS.ok}`);
  if (fhUS.ok) console.log("AAPL Profile Name:", (fhUS.response.data as any)?.name);

  // Reliance NSE candidate
  const fhIndCandidates = ["RELIANCE.NS", "RELIANCE.NS"];
  for (const cand of fhIndCandidates) {
    const fhInd = await finnhubProvider.getProfile(cand);
    console.log(`Reliance (${cand}) Profile status: ${fhInd.status}, OK: ${fhInd.ok}`);
    if (fhInd.ok) console.log(`Reliance (${cand}) Name:`, (fhInd.response.data as any)?.name);
  }

  // --- TWELVE DATA ---
  console.log("\n--- Testing Twelve Data ---");
  const tdUS = await twelveDataProvider.getQuote("AAPL");
  console.log(`AAPL Quote status: ${tdUS.status}, OK: ${tdUS.ok}`);
  if (tdUS.ok) console.log("AAPL Quote Price:", (tdUS.response.data as any)?.price);

  const tdIndCandidates = ["RELIANCE", "RELIANCE:NSE"];
  for (const cand of tdIndCandidates) {
    const tdInd = await twelveDataProvider.getQuote(cand);
    console.log(`Reliance (${cand}) Quote status: ${tdInd.status}, OK: ${tdInd.ok}`);
    if (tdInd.ok) console.log(`Reliance (${cand}) Quote Price:`, (tdInd.response.data as any)?.price);
  }

  // --- SEC EDGAR ---
  console.log("\n--- Testing SEC EDGAR ---");
  const secCik = await secProvider.getCikFromTicker("AAPL");
  console.log("AAPL CIK:", secCik);
  if (secCik) {
    const secFacts = await secProvider.getCompanyFacts("AAPL");
    console.log(`AAPL facts status: ${secFacts.status}, OK: ${secFacts.ok}`);
    if (secFacts.ok) console.log("AAPL Facts Entity Name:", (secFacts.response.data as any)?.entityName);
  }
  const secInd = await secProvider.getCikFromTicker("RELIANCE");
  console.log("Reliance CIK (Should be null):", secInd);

  // --- FINANCIAL MODELING PREP (FMP) ---
  console.log("\n--- Testing FMP ---");
  const fmpUS = await fmpProvider.getProfile("AAPL");
  console.log(`AAPL Profile status: ${fmpUS.status}, OK: ${fmpUS.ok}`);
  if (fmpUS.ok) console.log("AAPL FMP Name:", (fmpUS.response.data as any)?.name);

  const fmpInd = await fmpProvider.getProfile("RELIANCE.NS");
  console.log(`Reliance (RELIANCE.NS) Profile status: ${fmpInd.status}, OK: ${fmpInd.ok}`);
  if (fmpInd.ok) console.log("Reliance FMP Name:", (fmpInd.response.data as any)?.name);

  // --- ALPHA VANTAGE ---
  console.log("\n--- Testing Alpha Vantage ---");
  const avUS = await alphaVantageProvider.getQuote("AAPL");
  console.log(`AAPL Quote status: ${avUS.status}, OK: ${avUS.ok}`);
  if (avUS.ok) console.log("AAPL AV Price:", (avUS.response.data as any)?.price);

  const avInd = await alphaVantageProvider.getQuote("RELIANCE.NSE");
  console.log(`Reliance (RELIANCE.NSE) Quote status: ${avInd.status}, OK: ${avInd.ok}`);
  if (avInd.ok) console.log("Reliance AV Price:", (avInd.response.data as any)?.price);

  // --- NEWSAPI ---
  console.log("\n--- Testing NewsAPI ---");
  const newsUS = await newsApiProvider.getRecentArticles("Apple");
  console.log(`Apple news status: ${newsUS.status}, OK: ${newsUS.ok}`);
  if (newsUS.ok) console.log("Apple News Count:", newsUS.response.recordCount);

  // --- GROQ ---
  console.log("\n--- Testing Groq ---");
  // Call Groq with minimal parameters
  const dummyBundle: any = {
    company: { name: "Apple Inc.", ticker: "AAPL", exchange: "NASDAQ", country: "US" },
    providerHealth: {},
    companyProfiles: [],
    quotes: [],
    financialStatements: [],
    metrics: [],
    ratios: [],
    historicalPrices: [],
    news: [],
    webResearch: [],
    providerFailures: [],
    evidenceIndex: {}
  };
  const dummySnapshot: any = {
    company: { name: "Apple Inc.", ticker: "AAPL", exchange: "NASDAQ", country: "US", sector: null, industry: null, description: null, currency: "USD" },
    market: { price: 150, change: 0, changePercent: 0, high: 150, low: 150, previousClose: 150, volume: 1000, marketCap: 2000000000000, sharesOutstanding: 10000000, pe: null, pb: null, eps: null },
    history: { return30dPercent: null, historyLength: 0 },
    financials: [],
    news: [],
    web: { answer: null, results: [] },
    providers: [],
    categoryAssessments: {
      priceHistory: { status: "sufficient", daysCount: 600, reason: "Good history" },
      financialCapacity: { status: "strong", reason: "Good financials" },
      cashFlow: { status: "positive", reason: "Good cash flow" },
      news: { status: "positive", reason: "Positive sentiment" },
      marketValue: { status: "valued", marketCap: 2000000000000, reason: "Valued market cap" },
    }
  };

  const groqRes = await runGroqAnalysis(dummyBundle, dummySnapshot, dummySnapshot.categoryAssessments);
  console.log(`Groq analysis status: ${groqRes.status}`);
  if (groqRes.status === "success" && groqRes.data) {
    console.log("Groq verdict:", groqRes.data.verdict);
    console.log("Groq overall summary:", groqRes.data.overallSummary);
  } else {
    console.log("Groq failure message:", groqRes.message);
  }

  console.log("\n=== DIAGNOSTICS COMPLETE ===");
}

testAll().catch(err => {
  console.error("Diagnostic execution error:", err);
});
