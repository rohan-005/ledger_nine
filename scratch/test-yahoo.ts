import YahooFinance from "yahoo-finance2";

async function testYahooPackage() {
  console.log("=== STARTING YAHOO-FINANCE2 PACKAGE TEST (PART 5) ===");
  const yahooFinance = new YahooFinance();

  const symbols = ["AAPL", "RELIANCE.NS"];

  const now = new Date();
  const period1 = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

  for (const symbol of symbols) {
    console.log(`\n--- Symbol: ${symbol} ---`);
    try {
      console.log("Fetching quote...");
      const quote = await yahooFinance.quote(symbol);
      console.log("Quote Result:", {
        symbol: quote.symbol,
        longName: quote.longName,
        shortName: quote.shortName,
        regularMarketPrice: quote.regularMarketPrice,
        marketCap: quote.marketCap,
        sharesOutstanding: quote.sharesOutstanding,
        currency: quote.currency,
        exchange: quote.exchange,
      });
    } catch (err: any) {
      console.error("Quote Error:", err.message);
    }

    try {
      console.log(`Fetching chart from ${period1.toISOString().split('T')[0]} to today...`);
      const chart = await yahooFinance.chart(symbol, {
        period1: period1,
        period2: now,
        interval: "1d",
      });
      const meta = chart.meta;
      console.log("Chart Meta:", {
        symbol: meta.symbol,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        regularMarketPrice: meta.regularMarketPrice,
      });
      const quotes = chart.quotes || [];
      console.log(`Quotes Count: ${quotes.length}`);
      if (quotes.length > 0) {
        console.log("First candle:", quotes[0]);
        console.log("Last candle:", quotes[quotes.length - 1]);
      }
    } catch (err: any) {
      console.error("Chart Error:", err.message);
    }
  }

  console.log("\n=== TEST COMPLETE ===");
}

testYahooPackage().catch(err => {
  console.error("Runner error:", err);
});
