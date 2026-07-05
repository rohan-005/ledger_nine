import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getDb } from "../src/db";
import { sql } from "drizzle-orm";
import { fmpClient } from "../src/integrations/fmp/fmp.client";
import { secClient } from "../src/integrations/sec/sec.client";
import { tavilyClient } from "../src/integrations/tavily/tavily.client";
import { alphaVantageClient } from "../src/integrations/alpha-vantage/alpha-vantage.client";
import { GeminiProvider } from "../src/core/llm/providers/gemini.provider";
import { GroqProvider } from "../src/core/llm/providers/groq.provider";
import { LLMRouter } from "../src/core/llm/llm-router";
import { LLMProvider, LLMResponse } from "../src/core/llm/llm.types";

async function main() {
  console.log("==================================================");
  console.log("🚀 STARTING PROVIDER SMOKE TESTS");
  console.log("==================================================");

  let allPassed = true;

  // 1. DATABASE VALIDATION
  try {
    console.log("\n📦 1. Database Connection and Schema Validation...");
    const db = getDb();
    
    // Test simple query
    await db.execute(sql`SELECT 1`);
    console.log("  ✅ DATABASE_URL connection works");

    // Check table rows count or presence of required tables
    const tables = [
      "research_runs",
      "agent_runs",
      "evidence",
      "contradictions",
      "research_scores",
      "research_reports",
      "api_cache"
    ];

    for (const table of tables) {
      try {
        await db.execute(sql`SELECT count(*) FROM ${sql.identifier(table)}`);
        console.log(`  ✅ Table '${table}' exists and is queryable`);
      } catch (err: any) {
        console.error(`  ❌ Table '${table}' check failed: ${err.message}`);
        allPassed = false;
      }
    }
  } catch (err: any) {
    console.error("  ❌ Database connection check failed:", err.message);
    allPassed = false;
  }

  // 2. FMP VALIDATION
  try {
    console.log("\n📈 2. FMP (Financial Modeling Prep) API Validation...");
    console.log("  Calling profile endpoint for AAPL...");
    const profile = await fmpClient.getCompanyProfile("AAPL");
    console.log("  ✅ Profile response metadata successfully fetched:", {
      symbol: (profile as any).symbol,
      companyName: (profile as any).companyName,
      cik: (profile as any).cik,
    });
  } catch (err: any) {
    console.error("  ❌ FMP API failed:", err.message);
    allPassed = false;
  }

  // 3. SEC EDGAR VALIDATION
  try {
    console.log("\n🏢 3. SEC EDGAR API Validation...");
    console.log("  Fetching submissions for AAPL CIK (0000320193)...");
    const submissions = await secClient.getSubmissions("0000320193");
    const hasKeys = submissions && typeof submissions === "object" && "cik" in submissions;
    console.log(`  ✅ SEC Submissions fetched successfully (has CIK key: ${hasKeys})`);
    
    console.log("  Fetching company facts for AAPL CIK...");
    const facts = await secClient.getCompanyFacts("0000320193");
    const hasFactsKeys = facts && typeof facts === "object" && "entityName" in facts;
    console.log(`  ✅ SEC Facts fetched successfully (has entityName: ${hasFactsKeys})`);
  } catch (err: any) {
    console.error("  ❌ SEC EDGAR failed:", err.message);
    allPassed = false;
  }

  // 4. TAVILY VALIDATION (WITH CACHE TEST)
  try {
    console.log("\n🔍 4. Tavily & Cache Validation...");
    const query = "AAPL recent material business developments";
    
    console.log("  Sending first Tavily search (uncached)...");
    const firstResult = await tavilyClient.search(query, "AAPL") as any;
    console.log(`  ✅ First request succeeded. cacheHit = ${firstResult?.cacheHit}`);

    console.log("  Sending second Tavily search (should hit cache)...");
    const secondResult = await tavilyClient.search(query, "AAPL") as any;
    console.log(`  ✅ Second request succeeded. cacheHit = ${secondResult?.cacheHit}`);
    
    if (secondResult?.cacheHit !== true) {
      console.error("  ❌ Tavily second query was NOT a cache hit!");
      allPassed = false;
    } else {
      console.log("  ✅ Tavily cache mechanism verified correctly!");
    }
  } catch (err: any) {
    console.error("  ❌ Tavily failed:", err.message);
    allPassed = false;
  }

  // 5. ALPHA VANTAGE VALIDATION
  try {
    console.log("\n💵 5. Alpha Vantage Supplement API Validation...");
    console.log("  Fetching earnings for AAPL...");
    const earnings = await alphaVantageClient.getEarnings("AAPL");
    const hasSymbol = earnings && typeof earnings === "object" && "symbol" in earnings;
    console.log(`  ✅ Alpha Vantage earnings fetched successfully (has symbol key: ${hasSymbol})`);
  } catch (err: any) {
    console.error("  ❌ Alpha Vantage failed:", err.message);
    allPassed = false;
  }

  // 6. GEMINI FLASH SPECIALIST VALIDATION
  try {
    console.log("\n🤖 6. Gemini Flash (Specialist) Validation...");
    const provider = new GeminiProvider("gemini-2.5-flash");
    const res = await provider.generateText("Respond with JSON: { \"status\": \"ok\" }", {
      responseSchema: {
        type: "OBJECT",
        properties: { status: { type: "STRING" } },
        required: ["status"]
      }
    });
    console.log(`  ✅ Gemini Flash response: ${res.text.trim()} (latency: ${res.latencyMs}ms)`);
  } catch (err: any) {
    console.error("  ❌ Gemini Flash failed:", err.message);
    allPassed = false;
  }

  // 7. GEMINI PRO COMMITTEE VALIDATION
  try {
    console.log("\n🧠 7. Gemini Pro (Committee) Validation...");
    const provider = new GeminiProvider("gemini-2.5-pro");
    const res = await provider.generateText("Respond with JSON: { \"status\": \"ok\" }", {
      responseSchema: {
        type: "OBJECT",
        properties: { status: { type: "STRING" } },
        required: ["status"]
      }
    });
    console.log(`  ✅ Gemini Pro response: ${res.text.trim()} (latency: ${res.latencyMs}ms)`);
  } catch (err: any) {
    console.error("  ❌ Gemini Pro failed:", err.message);
    allPassed = false;
  }

  // 8. GROQ VALIDATION
  try {
    console.log("\n⚡ 8. Groq (Llama-3.3-70b) Validation...");
    const provider = new GroqProvider("llama-3.3-70b-versatile");
    const res = await provider.generateText("Respond with JSON: { \"status\": \"ok\" }", {
      responseSchema: {
        type: "OBJECT",
        properties: { status: { type: "STRING" } },
        required: ["status"]
      }
    });
    console.log(`  ✅ Groq response: ${res.text.trim()} (latency: ${res.latencyMs}ms)`);
  } catch (err: any) {
    console.error("  ❌ Groq failed:", err.message);
    allPassed = false;
  }

  // 9. FALLBACK ROUTING LOGIC VALIDATION
  try {
    console.log("\n🔄 9. Fallback Routing Tests...");

    // Test Scenario 1: Gemini succeeds on first try
    {
      const mockGemini = new MockProvider(async () => ({
        text: "gemini_success",
        latencyMs: 10,
        model: "gemini-2.5-flash",
        provider: "gemini"
      }));
      const mockGroq = new MockProvider(async () => {
        throw new Error("Should not call Groq");
      });

      const router = new LLMRouter(mockGemini, mockGroq);
      const res = await router.generateText("test");
      if (res.text === "gemini_success") {
        console.log("  ✅ Scenario 1: Primary success immediately - Passed");
      } else {
        throw new Error(`Unexpected response: ${res.text}`);
      }
    }

    // Test Scenario 2: Gemini fails once (retryable), then succeeds on second try
    {
      let geminiCalls = 0;
      const mockGemini = new MockProvider(async () => {
        geminiCalls++;
        if (geminiCalls === 1) {
          throw new Error("Temporary network glitch");
        }
        return {
          text: "gemini_success_on_retry",
          latencyMs: 10,
          model: "gemini-2.5-flash",
          provider: "gemini"
        };
      });
      const mockGroq = new MockProvider(async () => {
        throw new Error("Should not call Groq");
      });

      const router = new LLMRouter(mockGemini, mockGroq);
      const res = await router.generateText("test");
      if (res.text === "gemini_success_on_retry" && geminiCalls === 2) {
        console.log("  ✅ Scenario 2: Primary retryable failure once, then success - Passed");
      } else {
        throw new Error(`Unexpected result or calls: ${geminiCalls}, response: ${res.text}`);
      }
    }

    // Test Scenario 3: Gemini fails twice, Groq succeeds
    {
      let geminiCalls = 0;
      const mockGemini = new MockProvider(async () => {
        geminiCalls++;
        throw new Error("Primary completely dead");
      });
      const mockGroq = new MockProvider(async () => ({
        text: "groq_fallback_success",
        latencyMs: 10,
        model: "llama-3.3-70b-versatile",
        provider: "groq"
      }));

      const router = new LLMRouter(mockGemini, mockGroq);
      const res = await router.generateText("test");
      if (res.text === "groq_fallback_success" && geminiCalls === 2) {
        console.log("  ✅ Scenario 3: Primary fails twice, Groq succeeds - Passed");
      } else {
        throw new Error(`Unexpected result or calls: ${geminiCalls}, response: ${res.text}`);
      }
    }

    // Test Scenario 4: Gemini fails twice, Groq also fails
    {
      const mockGemini = new MockProvider(async () => {
        throw new Error("Primary dead");
      });
      const mockGroq = new MockProvider(async () => {
        throw new Error("Fallback also dead");
      });

      const router = new LLMRouter(mockGemini, mockGroq);
      try {
        await router.generateText("test");
        throw new Error("Should have thrown error");
      } catch (err: any) {
        if (err.message.includes("Fallback also dead")) {
          console.log("  ✅ Scenario 4: Both primary and Groq fallback fail - Passed");
        } else {
          throw err;
        }
      }
    }

  } catch (err: any) {
    console.error("  ❌ Fallback Routing failed:", err.message);
    allPassed = false;
  }

  console.log("\n==================================================");
  if (allPassed) {
    console.log("🎉 ALL PROVIDER SMOKE TESTS PASSED!");
  } else {
    console.log("❌ SOME PROVIDER SMOKE TESTS FAILED. CHECK LOGS ABOVE.");
    process.exit(1);
  }
  console.log("==================================================");
}

class MockProvider implements LLMProvider {
  constructor(private fn: () => Promise<LLMResponse>) {}
  async generateText(prompt: string, options?: any): Promise<LLMResponse> {
    return this.fn();
  }
}

main().catch(err => {
  console.error("Fatal error running smoke tests:", err);
  process.exit(1);
});
