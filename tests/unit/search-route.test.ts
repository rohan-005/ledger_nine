import { describe, it, expect, vi } from "vitest";
import { GET } from "@/src/app/api/search/route";
import { NextRequest } from "next/server";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";

vi.mock("@/src/integrations/fmp/fmp.client", () => ({
  fmpClient: {
    search: vi.fn(),
  },
}));

describe("Search API Route Tests", () => {
  it("should return curated suggestions when query is empty", async () => {
    const req = new NextRequest("http://localhost/api/search");
    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].ticker).toBe("AAPL");
  });

  it("should return filtered and deduplicated results for a query", async () => {
    vi.mocked(fmpClient.search).mockResolvedValueOnce([
      { symbol: "AAPL", name: "Apple Inc.", exchangeShortName: "NASDAQ" },
      { symbol: "TATASTEEL.NS", name: "Tata Steel Limited", exchangeShortName: "NSE" },
    ]);
    const req = new NextRequest("http://localhost/api/search?q=Apple");
    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.length).toBeGreaterThan(0);
    const tickers = data.map((item: any) => item.canonicalTicker);
    expect(tickers).toContain("AAPL");
  });
});
