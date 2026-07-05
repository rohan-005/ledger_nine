import "server-only";
import { getSecEdgarUserAgent } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";
import { RATE_LIMITS_CONFIG } from "@/src/config/rate-limits.config";

const SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";

let lastRequestTime = 0;

async function secFetch<T>(url: string): Promise<T> {
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
    try {
      return JSON.parse(text) as T;
    } catch (err: unknown) {
      throw new IntegrationError("SEC parse error", "SEC", "Failed to parse JSON response from SEC Edgar", false, undefined, err);
    }
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
    return secFetch<unknown>(url);
  },

  async getCompanyFacts(cik: string | number) {
    const padded = this.padCik(cik);
    const url = `${FACTS_URL}/CIK${padded}.json`;
    return secFetch<unknown>(url);
  },
};
