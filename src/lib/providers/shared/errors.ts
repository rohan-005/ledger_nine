import "server-only";
import { ProviderEndpointStatus } from "./types";

/**
 * Normalizes HTTP status code, error messages, or response contents into the contract statuses.
 */
export function mapErrorStatus(
  httpStatus: number | null,
  errorMessage: string,
  data: unknown
): ProviderEndpointStatus {
  const errLower = errorMessage.toLowerCase();
  const dataString = data ? JSON.stringify(data).toLowerCase() : "";

  // 1. Check for Plan Limitations (HTTP 402, or specific plan messages on 403 / 200 / etc.)
  if (
    httpStatus === 402 ||
    errLower.includes("upgrade your plan") ||
    errLower.includes("upgrade plan") ||
    errLower.includes("subscription") ||
    errLower.includes("plan limit") ||
    errLower.includes("special endpoint") ||
    errLower.includes("restricted endpoint") ||
    errLower.includes("not authorized for this endpoint") ||
    errLower.includes("premium endpoint") ||
    errLower.includes("paywall") ||
    errLower.includes("starter plan") ||
    errLower.includes("developer plan") ||
    errLower.includes("upgrade subscription") ||
    dataString.includes("upgrade your plan") ||
    dataString.includes("upgrade plan") ||
    dataString.includes("subscription") ||
    dataString.includes("plan limit") ||
    dataString.includes("special endpoint") ||
    dataString.includes("restricted endpoint") ||
    dataString.includes("not authorized for this endpoint") ||
    dataString.includes("premium endpoint") ||
    dataString.includes("paywall") ||
    dataString.includes("starter plan") ||
    dataString.includes("developer plan") ||
    dataString.includes("upgrade subscription")
  ) {
    return "plan_limited";
  }

  // 2. Check for Rate Limit indicators (HTTP 429 or status/error message details)
  if (
    httpStatus === 429 ||
    errLower.includes("rate limit") ||
    errLower.includes("quota exceeded") ||
    errLower.includes("too many requests") ||
    errLower.includes("resource exhausted") ||
    errLower.includes("daily limit reached") ||
    errLower.includes("seconds") ||
    errLower.includes("minute") ||
    errLower.includes("request limit") ||
    dataString.includes("rate limit") ||
    dataString.includes("quota exceeded") ||
    dataString.includes("too many requests") ||
    dataString.includes("resource exhausted") ||
    dataString.includes("daily limit reached") ||
    dataString.includes("seconds") ||
    dataString.includes("minute") ||
    dataString.includes("request limit")
  ) {
    return "rate_limit";
  }

  // 3. Check for Auth Error indicators (HTTP 401, 403 or key/token messages)
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    errLower.includes("unauthorized") ||
    errLower.includes("invalid api key") ||
    errLower.includes("api key is not configured") ||
    errLower.includes("forbidden") ||
    errLower.includes("invalid key") ||
    errLower.includes("authentication") ||
    dataString.includes("unauthorized") ||
    dataString.includes("invalid api key") ||
    dataString.includes("api key is not configured") ||
    dataString.includes("forbidden") ||
    dataString.includes("invalid key") ||
    dataString.includes("authentication")
  ) {
    return "auth_error";
  }

  // 3. Check for Timeout indicators
  if (
    errLower.includes("timeout") ||
    errLower.includes("timed out") ||
    errLower.includes("abort") ||
    errLower.includes("deadline")
  ) {
    return "timeout";
  }

  // 4. Check for Network failure indicators
  if (
    errLower.includes("fetch failed") ||
    errLower.includes("network") ||
    errLower.includes("econnrefused") ||
    errLower.includes("dns") ||
    errLower.includes("socket")
  ) {
    return "network_error";
  }

  // 5. Check for Unsupported symbol indicators
  if (
    errLower.includes("unsupported") ||
    errLower.includes("not supported") ||
    errLower.includes("invalid symbol") ||
    errLower.includes("no data found") ||
    errLower.includes("not found") ||
    dataString.includes("unsupported") ||
    dataString.includes("not supported") ||
    dataString.includes("invalid symbol")
  ) {
    return "unsupported";
  }

  // 6. Generic HTTP failure
  if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300)) {
    return "provider_error";
  }

  // 7. Check for Empty data (valid HTTP status but empty dataset)
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
    // Check if it's empty object
    if (Object.keys(data).length === 0) return true;
    
    // Check if Twelve Data or other provider returns empty status or errors in body
    const obj = data as Record<string, any>;
    if (obj.status === "error" || obj.status === "error_status" || obj.error === true) {
      return true;
    }
  }
  return false;
}
