import { describe, it, expect } from "vitest";
import { getProviderCandidates, CompanyIdentity } from "@/src/lib/company/symbolCandidates";

describe("Symbol Candidates Generator Tests", () => {
  it("should generate correct candidates for US stocks (e.g. Apple)", () => {
    const apple: CompanyIdentity = {
      name: "Apple Inc.",
      displayTicker: "AAPL",
      canonicalTicker: "AAPL",
      exchange: "NASDAQ",
      country: "US",
      currency: "USD",
      isin: null,
    };

    const res = getProviderCandidates(apple);

    expect(res.fmp).toContain("AAPL");
    expect(res.finnhub).toContain("AAPL");
    expect(res.twelveData).toContain("AAPL");
    expect(res.alphaVantage).toContain("AAPL");
  });

  it("should generate correct candidates for Indian stocks (e.g. Reliance NSE)", () => {
    const reliance: CompanyIdentity = {
      name: "Reliance Industries Limited",
      displayTicker: "RELIANCE",
      canonicalTicker: "RELIANCE.NS",
      exchange: "NSE",
      country: "India",
      currency: "INR",
      isin: null,
    };

    const res = getProviderCandidates(reliance);

    // FMP
    expect(res.fmp).toContain("RELIANCE.NS");
    expect(res.fmp).toContain("RELIANCE.BO");

    // Finnhub
    expect(res.finnhub).toContain("RELIANCE.NS");

    // Twelve Data
    expect(res.twelveData).toContain("RELIANCE");
    expect(res.twelveData).toContain("RELIANCE:NSE");

    // Alpha Vantage
    expect(res.alphaVantage).toContain("RELIANCE.NSE");
    expect(res.alphaVantage).toContain("RELIANCE.BSE");
    expect(res.alphaVantage).toContain("RELIANCE.NS");
  });

  it("should generate correct candidates for Indian stocks (e.g. TCS BSE)", () => {
    const tcs: CompanyIdentity = {
      name: "Tata Consultancy Services Limited",
      displayTicker: "TCS",
      canonicalTicker: "TCS.NS",
      exchange: "BSE",
      country: "India",
      currency: "INR",
      isin: null,
    };

    const res = getProviderCandidates(tcs);

    // FMP should prioritize BO suffix for BSE exchange
    expect(res.fmp[0]).toBe("TCS.BO");
    
    // Alpha Vantage should prioritize BSE exchange suffix
    expect(res.alphaVantage[0]).toBe("TCS.BSE");
  });
});
