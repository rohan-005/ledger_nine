import "server-only";
import { getAlphaVantageApiKey } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";

const BASE_URL = "https://www.alphavantage.co/query";

async function avFetch<T>(functionName: string, ticker: string): Promise<T> {
  let apiKey: string;
  try {
    apiKey = getAlphaVantageApiKey();
  } catch (err) {
    throw new IntegrationError("AlphaVantage config error", "AlphaVantage", "ALPHA_VANTAGE_API_KEY is not configured", false, undefined, err);
  }

  const queryParams = new URLSearchParams({
    function: functionName,
    symbol: ticker.toUpperCase(),
    apikey: apiKey,
  });

  const url = `${BASE_URL}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!response.ok) {
      throw new IntegrationError("AlphaVantage HTTP error", "AlphaVantage", `HTTP error status ${response.status}`);
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data["Note"]) {
        throw new IntegrationError("AlphaVantage rate limit warning", "AlphaVantage", "API rate limit warning: " + data["Note"], true);
      }
      return data as T;
    } catch (err: unknown) {
      if (err instanceof IntegrationError) throw err;
      throw new IntegrationError("AlphaVantage parse error", "AlphaVantage", "Failed to parse JSON response from Alpha Vantage API", false, undefined, err);
    }
  } catch (error: unknown) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("AlphaVantage request failed", "AlphaVantage", error instanceof Error ? error.message : "Request failed", false, undefined, error);
  }
}

export const alphaVantageClient = {
  async getEarnings(ticker: string) {
    return avFetch<unknown>("EARNINGS", ticker);
  },
};
