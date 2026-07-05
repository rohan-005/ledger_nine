import "server-only";
import { getSecEdgarUserAgent } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";
import { RATE_LIMITS_CONFIG } from "@/src/config/rate-limits.config";
import { cacheRepository } from "@/src/db/repositories/cache.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";

let lastRequestTime = 0;

async function secFetch<T>(url: string, cacheKey: string): Promise<T> {
  // 1. Try cache first
  try {
    const cached = await cacheRepository.getValid("sec", cacheKey);
    if (cached) {
      logger.info("SEC cache hit", { cacheKey });
      return cached as T;
    }
  } catch (error) {
    logger.warn("Failed to check SEC cache, proceeding to API", { error });
  }

  const userAgent = getSecEdgarUserAgent();

  // Self-throttling delay to comply with fair-access limits
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  const minDelay = RATE_LIMITS_CONFIG.sec.delayMs;
  if (timeSinceLast < minDelay) {
    await new Promise((resolve) => setTimeout(resolve, minDelay - timeSinceLast));
  }
  lastRequestTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept-Encoding": "gzip, deflate",
      },
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (response.status === 403) {
      throw new IntegrationError("SEC access forbidden", "SEC", "Access forbidden. Ensure User-Agent matches SEC requirements.");
    }

    if (!response.ok) {
      throw new IntegrationError("SEC HTTP error", "SEC", `HTTP error status ${response.status}`);
    }

    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch (err: unknown) {
      throw new IntegrationError("SEC parse error", "SEC", "Failed to parse JSON response from SEC Edgar", false, undefined, err);
    }

    // 2. Write to cache
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours TTL
      await cacheRepository.set({
        id: generateId("run").replace("run_", "ch_"),
        provider: "sec",
        cacheKey,
        requestFingerprint: cacheKey,
        payload: JSON.stringify(data),
        expiresAt,
      });
    } catch (cacheErr) {
      logger.warn("Failed to write SEC response to cache", { cacheErr });
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof IntegrationError) {
      throw error;
    }
    throw new IntegrationError("SEC request failed", "SEC", error instanceof Error ? error.message : "Request failed", false, undefined, error);
  }
}

export const secClient = {
  /**
   * Pads a CIK string or number to the required 10-digit format
   */
  padCik(cik: string | number): string {
    const clean = String(cik).trim().replace(/^0+/, "");
    return clean.padStart(10, "0");
  },

  async getSubmissions(cik: string | number) {
    const padded = this.padCik(cik);
    const url = `${SUBMISSIONS_URL}/CIK${padded}.json`;
    const dateBucket = new Date().toISOString().slice(0, 10);
    const cacheKey = `sec:${padded}:submissions:${dateBucket}`;
    return secFetch<unknown>(url, cacheKey);
  },

  async getCompanyFacts(cik: string | number) {
    const padded = this.padCik(cik);
    const url = `${FACTS_URL}/CIK${padded}.json`;
    const dateBucket = new Date().toISOString().slice(0, 10);
    const cacheKey = `sec:${padded}:facts:${dateBucket}`;
    return secFetch<unknown>(url, cacheKey);
  },
};
