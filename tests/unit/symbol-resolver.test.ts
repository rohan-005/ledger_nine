import { describe, it, expect, vi } from "vitest";
import { resolveSymbol } from "@/src/lib/market/symbolResolver";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";

vi.mock("@/src/integrations/fmp/fmp.client", () => ({
  fmpClient: {
    search: vi.fn(),
  },
}));

describe("Symbol Resolver Tests", () => {
  it("should resolve a curated stock instantly", async () => {
    const res = await resolveSymbol("AAPL");
    expect(res).not.toBeNull();
    expect(res!.canonicalTicker).toBe("AAPL");
    expect(res!.country).toBe("US");
    expect(res!.exchange).toBe("NASDAQ");
  });

  it("should resolve a curated Indian stock instantly", async () => {
    const res = await resolveSymbol("Reliance");
    expect(res).not.toBeNull();
    expect(res!.canonicalTicker).toBe("RELIANCE.NS");
    expect(res!.country).toBe("India");
    expect(res!.exchange).toBe("NSE");
  });

  it("should resolve with exchange suffix BO or NS", async () => {
    const res = await resolveSymbol("TCS.NS");
    expect(res).not.toBeNull();
    expect(res!.canonicalTicker).toBe("TCS.NS");
    expect(res!.exchange).toBe("NSE");
    expect(res!.country).toBe("India");
  });

  it("should fall back to FMP search API for unknown stocks", async () => {
    vi.mocked(fmpClient.search).mockResolvedValueOnce([
      { symbol: "TATASTEEL.NS", name: "Tata Steel Limited", exchangeShortName: "NSE" }
    ]);
    const res = await resolveSymbol("Tata Steel");
    expect(res).not.toBeNull();
    expect(res!.canonicalTicker).toBe("TATASTEEL.NS");
    expect(res!.exchange).toBe("NSE");
    expect(res!.country).toBe("India");
  });
});
