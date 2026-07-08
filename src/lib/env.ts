import { ConfigurationError } from "./errors";

export function getGroqApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new ConfigurationError("GROQ_API_KEY is not configured in environment variables.");
  }
  return key;
}

export function getFmpApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new ConfigurationError("FMP_API_KEY is not configured in environment variables.");
  }
  return key;
}

export function getAlphaVantageApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) {
    throw new ConfigurationError("ALPHA_VANTAGE_API_KEY is not configured in environment variables.");
  }
  return key;
}

export function getSecEdgarUserAgent(): string {
  const key = process.env.SEC_EDGAR_USER_AGENT;
  if (!key) {
    throw new ConfigurationError("SEC_EDGAR_USER_AGENT is not configured in environment variables.");
  }
  return key;
}

export function getDatabaseUrl(): string {
  const key = process.env.DATABASE_URL;
  if (!key) {
    throw new ConfigurationError("DATABASE_URL is not configured in environment variables.");
  }
  return key;
}

export function getFinnhubApiKey(): string {
  return process.env.FINNHUB_API_KEY || "";
}

export function getNewsApiKey(): string {
  return process.env.NEWS_API_KEY || "";
}

export function getTwelveDataApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY || "";
}



