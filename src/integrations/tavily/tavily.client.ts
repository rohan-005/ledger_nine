import "server-only";
import { getTavilyApiKey } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";
import { cacheRepository } from "@/src/db/repositories/cache.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const SEARCH_URL = "https://api.tavily.com/search";

function deduplicateResults(data: any): any {
  if (data && typeof data === "object" && Array.isArray(data.results)) {
    const seenUrls = new Set<string>();
    const uniqueResults = [];
    for (const res of data.results) {
      if (!res || !res.url) continue;
      const normalizedUrl = res.url.split("?")[0].split("#")[0].replace(/\/$/, "");
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueResults.push(res);
      }
    }
    data.results = uniqueResults;
  }
  return data;
}

export const tavilyClient = {
  async search(
    query: string,
    ticker: string,
    mode: "basic" | "advanced" = "basic"
  ): Promise<unknown> {
    const dateBucket = new Date().toISOString().slice(0, 10); // Daily cache bucket
    const cacheKey = `tavily:${ticker.toUpperCase()}:${query.toLowerCase().trim()}:${mode}:${dateBucket}`;

    // 1. Try to fetch from cache first
    try {
      const cached = await cacheRepository.getValid("tavily", cacheKey);
      if (cached) {
        logger.info("Tavily search cache hit", { ticker, query, mode });
        const deduped = deduplicateResults(cached);
        if (deduped && typeof deduped === "object") {
          (deduped as any).cacheHit = true;
        }
        return deduped;
      }
    } catch (error) {
      // Degrade gracefully if database URL is missing or DB is down
      logger.warn("Failed to check Tavily cache, proceeding directly to API", { error });
    }

    // 2. Fetch from Tavily API
    let apiKey: string;
    try {
      apiKey = getTavilyApiKey();
    } catch (err) {
      throw new IntegrationError("Tavily config error", "Tavily", "TAVILY_API_KEY is not configured", false, undefined, err);
    }

    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: mode,
          include_answer: false,
        }),
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      if (!response.ok) {
        throw new IntegrationError("Tavily HTTP error", "Tavily", `HTTP error status ${response.status}`);
      }

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
        data = deduplicateResults(data);
      } catch (err) {
        throw new IntegrationError("Tavily parse error", "Tavily", "Failed to parse JSON response from Tavily API", false, undefined, err);
      }

      // 3. Write back to cache asynchronously
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours TTL

        await cacheRepository.set({
          id: generateId("run").replace("run_", "ch_"), // generate cache id
          provider: "tavily",
          cacheKey,
          requestFingerprint: cacheKey,
          payload: JSON.stringify(data),
          expiresAt,
        });
      } catch (error) {
        logger.warn("Failed to write Tavily response to cache", { error });
      }

      if (data && typeof data === "object") {
        (data as any).cacheHit = false;
      }
      return data;
    } catch (error: unknown) {
      if (error instanceof IntegrationError) {
        throw error;
      }
      throw new IntegrationError("Tavily request failed", "Tavily", error instanceof Error ? error.message : "Request failed", false, undefined, error);
    }
  },
};
