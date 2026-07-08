import "server-only";
import { ProviderEndpointStatus } from "./types";

function extractBodyErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, any>;
  if (typeof obj["Error Message"] === "string") {
    return obj["Error Message"];
  }
  if (typeof obj.error === "string") {
    return obj.error;
  }
  if (typeof obj.message === "string") {
    if (obj.status === "error" || obj.status === "error_status" || obj.error === true) {
      return obj.message;
    }
  }
  return "";
}

/**
 * Normalizes HTTP status code, error messages, or response contents into the contract statuses.
 */
export function mapErrorStatus(
  httpStatus: number | null,
  errorMessage: string,
  data: unknown,
  provider?: string,
  symbolUsed?: string | null
): ProviderEndpointStatus {
  const bodyErrorMsg = extractBodyErrorMessage(data);
  const combinedError = (errorMessage + " " + bodyErrorMsg).trim().toLowerCase();
  
  const symbolUpper = (symbolUsed || "").toUpperCase();
  const isIndianSymbol =
    symbolUpper.endsWith(".NS") ||
    symbolUpper.endsWith(".BO") ||
    symbolUpper.includes(".NSE") ||
    symbolUpper.includes(".BSE") ||
    symbolUpper.includes(":NSE") ||
    symbolUpper.includes(":BSE") ||
    symbolUpper === "RELIANCE"; // Quick check for Reliance Industries

  const providerLower = (provider || "").toLowerCase();

  // 0. Check for explicit not_applicable
  if (
    combinedError.includes("not_applicable") ||
    combinedError.includes("not applicable") ||
    combinedError.includes("not treated as a us sec filer")
  ) {
    return "not_applicable";
  }

  // 1. Check for JSON parse / malformed responses first
  if (
    combinedError.includes("json parse error") ||
    combinedError.includes("failed to parse json") ||
    combinedError.includes("invalid json")
  ) {
    return "malformed_response";
  }

  // 2. Check for Plan Limitations (HTTP 402, or specific plan messages on 403 / 200 / etc.)
  if (
    httpStatus === 402 ||
    combinedError.includes("upgrade your plan") ||
    combinedError.includes("upgrade plan") ||
    combinedError.includes("subscription") ||
    combinedError.includes("plan limit") ||
    combinedError.includes("special endpoint") ||
    combinedError.includes("restricted endpoint") ||
    combinedError.includes("not authorized for this endpoint") ||
    combinedError.includes("premium endpoint") ||
    combinedError.includes("paywall") ||
    combinedError.includes("starter plan") ||
    combinedError.includes("developer plan") ||
    combinedError.includes("upgrade subscription") ||
    combinedError.includes("not available under your current plan") ||
    combinedError.includes("endpoint not available") ||
    combinedError.includes("please upgrade") ||
    combinedError.includes("upgrade to") ||
    combinedError.includes("limited to") ||
    combinedError.includes("api key is limited")
  ) {
    // If a plan limitation is hit on an Indian symbol for Twelve Data or Finnhub, classify as unsupported_market
    if (isIndianSymbol && (providerLower === "twelvedata" || providerLower === "twelve data" || providerLower === "finnhub")) {
      return "unsupported_market";
    }
    if (providerLower === "fmp") {
      return "plan_limit";
    }
    return "plan_limited";
  }

  // 3. Check for Rate Limit indicators (HTTP 429 or status/error message details)
  if (
    httpStatus === 429 ||
    combinedError.includes("rate limit") ||
    combinedError.includes("quota exceeded") ||
    combinedError.includes("too many requests") ||
    combinedError.includes("resource exhausted") ||
    combinedError.includes("daily limit reached") ||
    combinedError.includes("seconds") ||
    combinedError.includes("minute") ||
    combinedError.includes("request limit") ||
    combinedError.includes("limit reached") ||
    combinedError.includes("quota")
  ) {
    return "rate_limit";
  }

  // 4. Check for Auth Error indicators (HTTP 401, 403 or key/token messages)
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    combinedError.includes("unauthorized") ||
    combinedError.includes("invalid api key") ||
    combinedError.includes("api key is not configured") ||
    combinedError.includes("forbidden") ||
    combinedError.includes("invalid key") ||
    combinedError.includes("authentication")
  ) {
    if (combinedError.includes("permission") || combinedError.includes("privilege") || combinedError.includes("not allowed")) {
      return "permission_error";
    }
    if (isIndianSymbol && (provider === "Finnhub" || provider === "Twelve Data")) {
      return "unsupported_market";
    }
    if (
      combinedError.includes("subscription") ||
      combinedError.includes("plan") ||
      combinedError.includes("tier")
    ) {
      if (providerLower === "fmp") {
        return "plan_limit";
      }
      return "plan_limited";
    }
    return "auth_error";
  }

  // 5. Check for Timeout indicators
  if (
    combinedError.includes("timeout") ||
    combinedError.includes("timed out") ||
    combinedError.includes("abort") ||
    combinedError.includes("deadline")
  ) {
    return "timeout";
  }

  // 6. Check for Network failure indicators
  if (
    combinedError.includes("fetch failed") ||
    combinedError.includes("network") ||
    combinedError.includes("econnrefused") ||
    combinedError.includes("dns") ||
    combinedError.includes("socket")
  ) {
    return "network_error";
  }

  // 7. Check for Unsupported symbol indicators
  if (
    combinedError.includes("unsupported") ||
    combinedError.includes("not supported") ||
    combinedError.includes("invalid symbol") ||
    combinedError.includes("no data found") ||
    combinedError.includes("not found") ||
    combinedError.includes("cik not found")
  ) {
    if (isIndianSymbol && (providerLower === "sec edgar" || providerLower === "sec")) {
      return "not_applicable";
    }
    return "unsupported_symbol";
  }

  // 8. If body contains any error message, treat as provider_error
  if (bodyErrorMsg) {
    return "provider_error";
  }

  // 9. Generic HTTP failure
  if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300)) {
    return "provider_error";
  }

  // 10. Check for Empty data (valid HTTP status but empty dataset)
  if (isEmptyDataset(data)) {
    return "empty";
  }

  return "success";
}

/**
 * Checks if the response dataset is empty.
 */
export function isEmptyDataset(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") {
    if (Object.keys(data).length === 0) return true;
    const obj = data as Record<string, any>;
    if (obj.status === "error" || obj.status === "error_status" || obj.error === true) {
      return true;
    }
  }
  return false;
}
