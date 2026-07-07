import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { resolveSymbol } from "../src/lib/market/symbolResolver";
import { fmpClient } from "../src/integrations/fmp/fmp.client";
import { tavilyClient } from "../src/integrations/tavily/tavily.client";
import { alphaVantageClient } from "../src/integrations/alpha-vantage/alpha-vantage.client";
import { finnhubClient } from "../src/lib/services/finnhub";
import { newsapiClient } from "../src/lib/services/newsapi";

async function testCompany(query: string) {
  console.log(`\n==================================================`);
  console.log(`🔍 DIAGNOSING: "${query}"`);
  console.log(`==================================================`);

  // 1. Symbol Resolution
  const resolved = await resolveSymbol(query);
  if (!resolved) {
    console.log("❌ Failed to resolve symbol.");
    return;
  }
  console.log("1. RESOLUTION METADATA:");
  console.log(`   - Selected name: ${resolved.companyName}`);
  console.log(`   - displayTicker: ${resolved.displayTicker}`);
  console.log(`   - canonicalTicker: ${resolved.canonicalTicker}`);
  console.log(`   - exchange: ${resolved.exchange}`);
  console.log(`   - country: ${resolved.country}`);
  console.log(`   - Finnhub symbol sent: ${resolved.providerSymbols.finnhub}`);
  console.log(`   - FMP symbol sent: ${resolved.providerSymbols.fmp}`);
  console.log(`   - NewsAPI query: ${resolved.providerSymbols.newsapi}`);
  console.log(`   - Tavily query: ${resolved.providerSymbols.tavily}`);

  // 2. FMP Calls
  console.log("\n2. FMP CALLS:");
  try {
    const profile = await fmpClient.getCompanyProfile(resolved.providerSymbols.fmp);
    console.log(`   ✅ Profile fetched successfully: ${profile.companyName} (${profile.exchangeShortName})`);
  } catch (err: any) {
    console.log(`   ❌ Profile fetch failed: ${err.message}`);
  }

  try {
    const quote = await fmpClient.getQuote(resolved.providerSymbols.fmp);
    console.log(`   ✅ Quote fetched successfully: Price = ${quote.price}`);
  } catch (err: any) {
    console.log(`   ❌ Quote fetch failed: ${err.message}`);
  }

  try {
    const financials = await fmpClient.getIncomeStatements(resolved.providerSymbols.fmp, 3);
    console.log(`   ✅ Financial statements fetched successfully: count = ${financials.length}`);
    if (financials.length > 0) {
      console.log(`      First period: ${JSON.stringify(financials[0]).substring(0, 100)}...`);
    }
  } catch (err: any) {
    console.log(`   ❌ Financial statements fetch failed: ${err.message}`);
  }

  // 3. Finnhub Calls
  console.log("\n3. FINNHUB CALLS:");
  try {
    const profile = await finnhubClient.getCompanyProfile(resolved.providerSymbols.finnhub);
    console.log(`   - Profile: ${profile ? "Available" : "Unavailable (null)"}`);
  } catch (err: any) {
    console.log(`   ❌ Finnhub Profile failed: ${err.message}`);
  }

  try {
    const quote = await finnhubClient.getQuote(resolved.providerSymbols.finnhub);
    console.log(`   - Quote: ${quote ? JSON.stringify(quote) : "Unavailable (null)"}`);
  } catch (err: any) {
    console.log(`   ❌ Finnhub Quote failed: ${err.message}`);
  }

  // 4. NewsAPI Calls
  console.log("\n4. NEWSAPI:");
  try {
    const news = await newsapiClient.searchEverything(resolved.providerSymbols.newsapi, 3);
    console.log(`   - News: ${news ? "Articles count: " + (news as any).articles?.length : "Unavailable (null)"}`);
  } catch (err: any) {
    console.log(`   ❌ NewsAPI failed: ${err.message}`);
  }

  // 5. Tavily Calls
  console.log("\n5. TAVILY:");
  try {
    const tavilyRes = await tavilyClient.search(`${resolved.providerSymbols.tavily} investment analysis ${resolved.displayTicker}`, resolved.displayTicker) as any;
    console.log(`   ✅ Tavily fetched successfully. Results: ${tavilyRes?.results?.length || 0}`);
  } catch (err: any) {
    console.log(`   ❌ Tavily failed: ${err.message}`);
  }

  // 6. Alpha Vantage Calls
  console.log("\n6. ALPHA VANTAGE:");
  try {
    const av = await alphaVantageClient.getEarnings(resolved.displayTicker);
    console.log(`   ✅ Alpha Vantage fetched successfully. Symbol: ${av ? (av as any).symbol : "None"}`);
  } catch (err: any) {
    console.log(`   ❌ Alpha Vantage failed: ${err.message}`);
  }
}

async function main() {
  const targets = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "AAPL"];
  for (const t of targets) {
    await testCompany(t);
  }
}

main().catch((err) => console.error("Fatal error:", err));
