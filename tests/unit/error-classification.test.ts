import { describe, it, expect } from "vitest";
import { mapErrorStatus } from "@/src/lib/providers/shared/errors";

describe("Error Classification Logic", () => {
  it("should classify standard HTTP 429 as rate_limit", () => {
    const res = mapErrorStatus(429, "Too Many Requests", null, "FMP");
    expect(res).toBe("rate_limit");
  });

  it("should classify standard HTTP 401 as auth_error", () => {
    const res = mapErrorStatus(401, "Unauthorized", null, "FMP");
    expect(res).toBe("auth_error");
  });

  it("should classify FMP JSON body with error message as plan_limit", () => {
    const res = mapErrorStatus(200, "OK", {
      "Error Message": "Special Endpoint - Please upgrade your plan to access this endpoint"
    }, "FMP");
    expect(res).toBe("plan_limit");
  });

  it("should classify FMP JSON body key upgrade message as plan_limit", () => {
    const res = mapErrorStatus(200, "OK", {
      "Error Message": "Your dev API key is limited. Please upgrade to plans."
    }, "FMP");
    expect(res).toBe("plan_limit");
  });

  it("should classify FMP JSON body key invalid message as auth_error", () => {
    const res = mapErrorStatus(200, "OK", {
      "Error Message": "Invalid API Key"
    }, "FMP");
    expect(res).toBe("auth_error");
  });

  it("should classify other FMP JSON body errors as provider_error", () => {
    const res = mapErrorStatus(200, "OK", {
      "Error Message": "Some internal provider database issue"
    }, "FMP");
    expect(res).toBe("provider_error");
  });

  it("should classify JSON parse failures as malformed_response", () => {
    const res = mapErrorStatus(200, "JSON Parse Error: Unexpected token <", null, "FMP");
    expect(res).toBe("malformed_response");
  });

  it("should classify generic non-2xx status without specific text as provider_error", () => {
    const res = mapErrorStatus(500, "Internal Server Error", null, "FMP");
    expect(res).toBe("provider_error");
  });
});
