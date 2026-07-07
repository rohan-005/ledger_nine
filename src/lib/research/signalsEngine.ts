import "server-only";
import { CompanyMarketSnapshot, SignalsBreakdown } from "../../types/snapshot";

/**
 * Computes simple, local mathematical scores for a company based on the compiled snapshot.
 */
export function calculateSignals(snapshot: CompanyMarketSnapshot): SignalsBreakdown {
  // 1. Price Momentum Score
  let priceMomentum = 50;
  const ret30 = snapshot.history.return30dPercent;
  if (ret30 !== null) {
    if (ret30 >= 0) {
      priceMomentum = 50 + Math.min(45, ret30 * 2.5); // Max 95
    } else {
      priceMomentum = Math.max(10, 50 - Math.abs(ret30) * 2.5); // Min 10
    }
  }

  // Daily change percentage adjustment
  const dayChange = snapshot.market.changePercent;
  if (dayChange !== null) {
    if (dayChange > 0) {
      priceMomentum = Math.min(100, priceMomentum + 5);
    } else if (dayChange < 0) {
      priceMomentum = Math.max(0, priceMomentum - 5);
    }
  }

  // 2. Valuation Score
  const pe = snapshot.market.pe;
  const pb = snapshot.market.pb;
  
  let peScore = 50;
  if (pe !== null) {
    if (pe < 0) {
      peScore = 20; // Unprofitable
    } else if (pe <= 15) {
      peScore = 90; // Cheap
    } else if (pe <= 25) {
      peScore = 70; // Fair
    } else if (pe <= 45) {
      peScore = Math.max(30, 95 - pe * 1.5); // Expensive
    } else {
      peScore = 15; // Extremely expensive
    }
  }

  let pbScore = 50;
  if (pb !== null) {
    if (pb < 0) {
      pbScore = 30;
    } else if (pb <= 1.5) {
      pbScore = 90;
    } else if (pb <= 3.0) {
      pbScore = 70;
    } else if (pb <= 6.0) {
      pbScore = Math.max(20, 100 - pb * 10);
    } else {
      pbScore = 15;
    }
  }

  let valuation = Math.round((peScore + pbScore) / 2);

  // 3. Financial Quality Score
  let financialQuality = 50;
  const financials = snapshot.financials;
  
  if (financials.length >= 2) {
    const latest = financials[0];
    const prev = financials[1];
    
    let checks = 0;
    let passes = 0;

    // Growth Checks
    if (latest.revenue !== null && prev.revenue !== null) {
      checks++;
      if (latest.revenue > prev.revenue) passes++;
    }
    if (latest.netIncome !== null && prev.netIncome !== null) {
      checks++;
      if (latest.netIncome > prev.netIncome) passes++;
    }

    // Cash Flow check
    if (latest.freeCashFlow !== null) {
      checks++;
      if (latest.freeCashFlow > 0) passes++;
    } else if (latest.operatingCashFlow !== null) {
      checks++;
      if (latest.operatingCashFlow > 0) passes++;
    }

    // Profitability Check (ROE > 12%)
    if (latest.roe !== null) {
      checks++;
      if (latest.roe > 0.12) passes++;
    }

    // Leverage Check (Debt/Equity < 1.5)
    if (latest.debtToEquity !== null) {
      checks++;
      if (latest.debtToEquity < 1.5) passes++;
    }

    if (checks > 0) {
      financialQuality = Math.round((passes / checks) * 100);
    }
  } else if (financials.length === 1) {
    // Limited history
    const latest = financials[0];
    let checks = 0;
    let passes = 0;
    if (latest.freeCashFlow !== null && latest.freeCashFlow > 0) { checks++; passes++; }
    if (latest.roe !== null && latest.roe > 0.12) { checks++; passes++; }
    if (latest.debtToEquity !== null && latest.debtToEquity < 1.5) { checks++; passes++; }
    if (checks > 0) {
      financialQuality = Math.round((passes / checks) * 80); // Capped at 80 due to limited history
    }
  }

  // 4. News Context Sentiment Score
  let newsContext = 50;
  const positiveWords = ["growth", "profit", "record", "gain", "upgrade", "buy", "bullish", "success", "beat", "higher", "positive", "strong"];
  const negativeWords = ["drop", "loss", "decline", "fall", "downgrade", "sell", "bearish", "lawsuit", "warn", "debt", "lower", "weak", "concern"];

  if (snapshot.news.length > 0) {
    let posCount = 0;
    let negCount = 0;

    for (const article of snapshot.news) {
      const textToSearch = `${article.title} ${article.summary || ""}`.toLowerCase();
      
      for (const word of positiveWords) {
        if (textToSearch.includes(word)) posCount++;
      }
      for (const word of negativeWords) {
        if (textToSearch.includes(word)) negCount++;
      }
    }

    const net = posCount - negCount;
    newsContext = Math.min(95, Math.max(10, 50 + net * 5));
  }

  // 5. Data Confidence Score
  let dataConfidence = 100;
  for (const provider of snapshot.providers) {
    if (["auth_error", "rate_limit", "unsupported"].includes(provider.status)) {
      dataConfidence -= 10;
    } else if (provider.status === "empty") {
      dataConfidence -= 5;
    }
    // Deduct for specific endpoint failures
    const failedCount = provider.endpoints.filter(e => !e.ok).length;
    dataConfidence -= failedCount * 2;
  }

  if (snapshot.financials.length === 0) {
    dataConfidence -= 15;
  }
  if (snapshot.market.price === null) {
    dataConfidence -= 20;
  }
  dataConfidence = Math.min(100, Math.max(10, dataConfidence));

  // Round all individual signals
  priceMomentum = Math.round(priceMomentum);
  valuation = Math.round(valuation);
  financialQuality = Math.round(financialQuality);
  newsContext = Math.round(newsContext);
  dataConfidence = Math.round(dataConfidence);

  // 6. Weighted Final Deterministic Score
  // Weights: Price Momentum 25%, Valuation 20%, Financial Quality 25%, News Context 15%, Data Confidence 15%
  const finalDeterministicScore = Math.round(
    priceMomentum * 0.25 +
    valuation * 0.20 +
    financialQuality * 0.25 +
    newsContext * 0.15 +
    dataConfidence * 0.15
  );

  // 7. Deterministic Verdict
  // Category mapping: INVEST, WATCH, PASS
  let deterministicVerdict: SignalsBreakdown["deterministicVerdict"] = "WATCH";
  if (finalDeterministicScore >= 70 && dataConfidence >= 60) {
    deterministicVerdict = "INVEST";
  } else if (finalDeterministicScore < 50 || dataConfidence < 40) {
    deterministicVerdict = "PASS";
  }

  return {
    priceMomentum,
    valuation,
    financialQuality,
    newsContext,
    dataConfidence,
    finalDeterministicScore,
    deterministicVerdict,
  };
}
