import "server-only";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { scoreRepository } from "@/src/db/repositories/score.repository";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
import { parseAssetProfile } from "@/src/lib/research/asset-identity";
import { checkSufficiency } from "@/src/lib/research/sufficiency";
import { sanitizeErrorMessage } from "@/src/lib/errors-sanitizer";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
import { reportRepository } from "@/src/db/repositories/report.repository";
import { evidenceRepository } from "@/src/db/repositories/evidence.repository";
import { contradictionRepository } from "@/src/db/repositories/contradiction.repository";
import { finnhubClient } from "@/src/lib/services/finnhub";
import { newsapiClient } from "@/src/lib/services/newsapi";
import { tavilyClient } from "@/src/integrations/tavily/tavily.client";
import { geminiClient } from "@/src/lib/services/gemini";
import { calculateFinancialTrends, AnnualData } from "@/src/lib/analysis/metrics";
import { computeDeterministicScores } from "@/src/lib/analysis/scoring";
import { runDeterministicContradictionAudit } from "@/src/lib/analysis/contradictions";
import { evaluateVerdict } from "@/src/lib/analysis/decision-engine";
import { Evidence } from "@/src/core/evidence/evidence.types";

const responseSchema = {
  type: "OBJECT",
  properties: {
    businessQualityMoat: { type: "STRING", enum: ["wide", "narrow", "none", "unknown"] },
    businessQualityReasoning: { type: "STRING" },
    competitivePosition: { type: "STRING", enum: ["leader", "strong", "neutral", "weak", "unknown"] },
    competitivePositionReasoning: { type: "STRING" },
    managementGovernance: { type: "STRING", enum: ["excellent", "good", "mixed", "poor", "unknown"] },
    managementGovernanceReasoning: { type: "STRING" },
    riskExposure: { type: "STRING", enum: ["low", "medium", "high", "critical", "unknown"] },
    riskReasoning: { type: "STRING" },
    thesis: { type: "STRING" },
    bullCase: { type: "ARRAY", items: { type: "STRING" } },
    bearCase: { type: "ARRAY", items: { type: "STRING" } },
    keyRisks: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" }
  },
  required: [
    "businessQualityMoat",
    "businessQualityReasoning",
    "competitivePosition",
    "competitivePositionReasoning",
    "managementGovernance",
    "managementGovernanceReasoning",
    "riskExposure",
    "riskReasoning",
    "thesis",
    "bullCase",
    "bearCase",
    "keyRisks",
    "summary"
  ]
};

export const researchCoordinator = {
  /**
   * Starts a research run, launches the process asynchronously in the background,
   * and returns the research run ID immediately.
   */
  async startResearch(
    ticker: string,
    investmentHorizon: string,
    riskTolerance: "low" | "moderate" | "high"
  ): Promise<string> {
    const researchId = generateId("run");
    const cleanTicker = ticker.toUpperCase().trim();

    logger.info("Coordinator: Starting new research run", { researchId, ticker: cleanTicker });

    // Initialize in DB
    await researchRepository.createRun({
      id: researchId,
      ticker: cleanTicker,
      companyName: cleanTicker, // Default to ticker, will update once profile is fetched
      investmentHorizon,
      riskTolerance,
      status: "queued",
    });

    // Launch background execution without awaiting
    this.executeResearch(researchId, cleanTicker, investmentHorizon, riskTolerance).catch((err) => {
      logger.error("Coordinator: Background research run failed", { researchId, error: err });
    });

    return researchId;
  },

  /**
   * Synchronously executes the full research pipeline for a given run ID.
   */
  async executeResearch(
    researchId: string,
    ticker: string,
    investmentHorizon: string,
    riskTolerance: "low" | "moderate" | "high"
  ) {
    logger.info("Coordinator: Executing pipeline", { researchId, ticker });
    await researchRepository.updateStatus(researchId, "running");

    // Initialize agent runs for the progress tracker UI
    const startAgent = async (agentId: string) => {
      const id = generateId("ag");
      await agentRunRepository.startAgentRun({
        id,
        researchId,
        agentId,
        status: "running",
        provider: "api",
        model: "factual_data_collector",
        startedAt: new Date(),
      });
      return id;
    };

    const financialRunId = await startAgent("financial");
    const secRunId = await startAgent("sec");
    const macroRunId = await startAgent("macro");
    const earningsRunId = await startAgent("earnings");

    try {
      // 1. Fetch Company Name & Resolve Asset Identity
      let profilePayload: Record<string, any> | null = null;
      try {
        profilePayload = await fmpClient.getCompanyProfile(ticker);
      } catch (err) {
        logger.warn("Coordinator: Failed to retrieve company profile from FMP, trying Finnhub", { ticker, error: err });
        try {
          const finnhubProfile = await finnhubClient.getCompanyProfile(ticker);
          if (finnhubProfile) {
            profilePayload = {
              symbol: ticker,
              companyName: finnhubProfile.name,
              exchange: finnhubProfile.exchange,
              country: finnhubProfile.country,
              currency: finnhubProfile.currency,
            };
          }
        } catch (fhErr) {
          logger.warn("Coordinator: Failed to retrieve company profile from Finnhub", { ticker, error: fhErr });
        }
      }

      const identity = parseAssetProfile(ticker, profilePayload);

      // Asset Resolution check: exit early if ticker is unresolved
      if (!identity.resolved) {
        logger.info("Coordinator: Asset unresolved. Exiting early.", { researchId, ticker });
        
        await agentRunRepository.failAgentRun(financialRunId, "Unresolved ticker");
        await agentRunRepository.failAgentRun(secRunId, "Unresolved ticker");
        await agentRunRepository.failAgentRun(macroRunId, "Unresolved ticker");
        await agentRunRepository.failAgentRun(earningsRunId, "Unresolved ticker");

        // Write empty report row so DB queries find it
        await reportRepository.upsertReport({
          id: generateId("rep"),
          researchId,
          thesis: "",
          bullCase: JSON.stringify([]),
          bearCase: JSON.stringify([]),
          keyRisks: JSON.stringify([]),
          summary: "",
          createdAt: new Date(),
        });

        await researchRepository.updateCurrentNode(researchId, "completed");
        await researchRepository.markCompleted(
          researchId,
          ticker,
          "asset_unresolved",
          ["UNRESOLVED_TICKER"],
          []
        );
        return;
      }

      const companyName = identity.companyName || ticker;

      // 2. Run parallel factual data queries
      await researchRepository.updateCurrentNode(researchId, "specialists");
      const startTime = Date.now();
      const toDate = new Date().toISOString().slice(0, 10);
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [
        fmpIncomeRes,
        fmpBalanceRes,
        fmpCashFlowRes,
        fmpQuoteRes,
        finnhubQuoteRes,
        finnhubNewsRes,
        newsApiRes,
        tavilyRes
      ] = await Promise.allSettled([
        fmpClient.getIncomeStatements(ticker, 4),
        fmpClient.getBalanceSheets(ticker, 4),
        fmpClient.getCashFlowStatements(ticker, 4),
        fmpClient.getQuote(ticker),
        finnhubClient.getQuote(ticker),
        finnhubClient.getCompanyNews(ticker, fromDate, toDate),
        newsapiClient.searchEverything(companyName, 10),
        tavilyClient.search(`${companyName} investment analysis ${ticker}`, ticker)
      ]);

      const latency = Date.now() - startTime;

      const fmpIncome = fmpIncomeRes.status === "fulfilled" && fmpIncomeRes.value ? fmpIncomeRes.value : [];
      const fmpBalance = fmpBalanceRes.status === "fulfilled" && fmpBalanceRes.value ? fmpBalanceRes.value : [];
      const fmpCashFlow = fmpCashFlowRes.status === "fulfilled" && fmpCashFlowRes.value ? fmpCashFlowRes.value : [];
      const fmpQuote = fmpQuoteRes.status === "fulfilled" && fmpQuoteRes.value ? [fmpQuoteRes.value] : [];
      const finnhubQuote = finnhubQuoteRes.status === "fulfilled" ? finnhubQuoteRes.value : null;
      const finnhubNews = finnhubNewsRes.status === "fulfilled" && finnhubNewsRes.value ? finnhubNewsRes.value : [];
      const newsApiArticles = newsApiRes.status === "fulfilled" && newsApiRes.value && (newsApiRes.value as any).articles ? (newsApiRes.value as any).articles : [];
      const tavilyResults = tavilyRes.status === "fulfilled" ? tavilyRes.value : null;

      // Update agent run statuses
      if (fmpIncome.length > 0 || fmpBalance.length > 0 || fmpCashFlow.length > 0) {
        await agentRunRepository.completeAgentRun(financialRunId, "FMP", "Financial Statements API", latency);
      } else {
        await agentRunRepository.failAgentRun(financialRunId, "Failed to retrieve financial statements", "FMP", "Financial Statements API", latency);
      }

      if (fmpIncome.length > 0 || fmpQuote.length > 0) {
        await agentRunRepository.completeAgentRun(secRunId, "FMP", "SEC/Profile API", latency);
      } else {
        await agentRunRepository.failAgentRun(secRunId, "Failed to retrieve SEC/Profile data", "FMP", "SEC/Profile API", latency);
      }

      if (newsApiArticles.length > 0 || finnhubNews.length > 0) {
        await agentRunRepository.completeAgentRun(macroRunId, "NewsAPI/Finnhub", "News API", latency);
      } else {
        await agentRunRepository.failAgentRun(macroRunId, "Failed to retrieve macro/news data", "NewsAPI/Finnhub", "News API", latency);
      }

      if (tavilyResults || finnhubQuote) {
        await agentRunRepository.completeAgentRun(earningsRunId, "Tavily/Finnhub", "Web/Earnings API", latency);
      } else {
        await agentRunRepository.failAgentRun(earningsRunId, "Failed to retrieve earnings/web analysis", "Tavily/Finnhub", "Web/Earnings API", latency);
      }

      // 3. Process financial statements & compute trends
      const annualDataMap = new Map<number, Partial<AnnualData>>();
      const getYear = (dateStr: string) => new Date(dateStr).getFullYear();

      fmpIncome.forEach((item: any) => {
        const year = getYear(item.date);
        if (!year) return;
        if (!annualDataMap.has(year)) annualDataMap.set(year, {});
        const data = annualDataMap.get(year)!;
        data.calendarYear = String(year);
        data.revenue = Number(item.revenue) || 0;
        data.grossProfit = Number(item.grossProfit) || 0;
        data.operatingIncome = Number(item.operatingIncome) || 0;
        data.netIncome = Number(item.netIncome) || 0;
        data.interestExpense = Number(item.interestExpense) || 0;
      });

      fmpBalance.forEach((item: any) => {
        const year = getYear(item.date);
        if (!year) return;
        if (!annualDataMap.has(year)) annualDataMap.set(year, {});
        const data = annualDataMap.get(year)!;
        data.calendarYear = String(year);
        data.totalEquity = Number(item.totalStockholdersEquity) || (Number(item.totalAssets) - Number(item.totalLiabilities)) || 0;
        data.totalDebt = Number(item.totalDebt) || (Number(item.shortTermDebt || 0) + Number(item.longTermDebt || 0)) || 0;
      });

      fmpCashFlow.forEach((item: any) => {
        const year = getYear(item.date);
        if (!year) return;
        if (!annualDataMap.has(year)) annualDataMap.set(year, {});
        const data = annualDataMap.get(year)!;
        data.calendarYear = String(year);
        data.operatingCashFlow = Number(item.netCashProvidedByOperatingActivities) || 0;
        data.capitalExpenditure = Number(item.capitalExpenditure) || 0;
      });

      const annualDataList: AnnualData[] = Array.from(annualDataMap.values())
        .filter((data): data is AnnualData => 
          data.calendarYear !== undefined &&
          data.revenue !== undefined &&
          data.netIncome !== undefined
        )
        .sort((a, b) => Number(a.calendarYear) - Number(b.calendarYear));

      const financialTrends = calculateFinancialTrends(annualDataList);

      // 4. Generate evidence list
      const evidenceInsertions: any[] = [];

      const addEvidenceItem = (
        claim: string,
        category: "financial" | "valuation" | "news" | "risk" | "business",
        sourceType: "fmp" | "sec" | "tavily" | "llm_inference",
        agentId: "financial" | "sec" | "macro" | "earnings",
        rawValue?: any,
        normalizedValue?: number,
        confidence = 1.0,
        sourceQuality = 0.9
      ) => {
        const evId = generateId("ev");
        evidenceInsertions.push({
          id: evId,
          researchId,
          claim,
          category,
          sourceType,
          rawValue: rawValue ? JSON.stringify(rawValue) : null,
          normalizedValue: normalizedValue !== undefined && normalizedValue !== null ? String(normalizedValue) : null,
          confidence: String(confidence),
          sourceQuality: String(sourceQuality),
          agentId,
          observedAt: new Date(),
          createdAt: new Date()
        });
      };

      // Populate FMP evidence
      if (annualDataList.length > 0) {
        annualDataList.forEach((data) => {
          addEvidenceItem(
            `FY${data.calendarYear} Financials: Revenue of $${(data.revenue / 1e9).toFixed(2)}B, Net Income of $${(data.netIncome / 1e9).toFixed(2)}B, FCF of $${(((data.operatingCashFlow || 0) - (data.capitalExpenditure || 0)) / 1e9).toFixed(2)}B.`,
            "financial",
            "fmp",
            "financial",
            data,
            undefined,
            1.0,
            0.95
          );
        });
      }

      // Populate quote evidence
      const currentPE = fmpQuote[0]?.pe || finnhubQuote?.pe || null;
      if (fmpQuote[0]) {
        addEvidenceItem(
          `Market Quote: Share Price of $${fmpQuote[0].price}, P/E ratio is ${currentPE || "N/A"}, EV/EBITDA is ${fmpQuote[0].enterpriseValueOverEBITDA || "N/A"}, Market Cap is $${(Number(fmpQuote[0].marketCap || 0) / 1e9).toFixed(2)}B.`,
          "valuation",
          "fmp",
          "sec",
          fmpQuote[0],
          undefined,
          1.0,
          0.95
        );
      }

      // Populate news evidence
      newsApiArticles.slice(0, 5).forEach((art: any) => {
        addEvidenceItem(
          `News Highlight: ${art.title} - ${art.description || ""}`,
          "news",
          "tavily",
          "macro",
          art,
          undefined,
          0.85,
          0.8
        );
      });

      // Insert factual evidence items
      if (evidenceInsertions.length > 0) {
        await evidenceRepository.insertManyEvidence(evidenceInsertions);
      }

      // Read runtime evidence list
      const runtimeEvidenceList: Evidence[] = evidenceInsertions.map(e => ({
        id: e.id,
        researchId: e.researchId,
        claim: e.claim,
        category: e.category,
        sourceType: e.sourceType,
        rawValue: e.rawValue,
        normalizedValue: (e.normalizedValue !== null && e.normalizedValue !== undefined) ? Number(e.normalizedValue) : undefined,
        confidence: Number(e.confidence),
        sourceQuality: Number(e.sourceQuality),
        agentId: e.agentId,
        createdAt: e.createdAt.toISOString()
      }));

      // Check sufficiency
      const agentRunsList = await agentRunRepository.getAgentRunsByResearchId(researchId);
      const isUSAsset = identity.country === "US" || identity.country === "United States" ||
        (identity.exchange?.toUpperCase() || "").includes("NASDAQ") ||
        (identity.exchange?.toUpperCase() || "").includes("NYSE");

      const sufficiencyResult = checkSufficiency(runtimeEvidenceList, agentRunsList, isUSAsset);

      let geminiData = {
        businessQualityMoat: "unknown" as any,
        businessQualityReasoning: "No qualitative analysis available.",
        competitivePosition: "unknown" as any,
        competitivePositionReasoning: "No qualitative analysis available.",
        managementGovernance: "unknown" as any,
        managementGovernanceReasoning: "No qualitative analysis available.",
        riskExposure: "unknown" as any,
        riskReasoning: "No qualitative analysis available.",
        thesis: "Research was insufficient to generate an investment thesis.",
        bullCase: [],
        bearCase: [],
        keyRisks: [],
        summary: "Factual evidence collected, but below sufficiency thresholds."
      };

      if (sufficiencyResult.sufficient) {
        await researchRepository.updateCurrentNode(researchId, "committee");
        
        const prompt = `
You are a senior investment research analyst. Analyze the following factual information for ${ticker} (${companyName}) and provide a professional, evidence-based qualitative analysis.

Context:
- Company Ticker: ${ticker}
- Company Name: ${companyName}
- Current Quotes & Market Price: ${JSON.stringify(fmpQuote[0] || finnhubQuote || {})}
- Financial Trends: ${JSON.stringify(financialTrends)}
- News Articles: ${JSON.stringify(newsApiArticles.slice(0, 10).map((a: any) => ({ title: a.title, description: a.description, source: a.source?.name })))}
- Web Search Results: ${JSON.stringify(tavilyResults ? (tavilyResults as any).results?.slice(0, 5) : [])}

Task:
Analyze this data and return a JSON object with:
1. "businessQualityMoat": Select "wide" | "narrow" | "none" | "unknown" (base this on gross margins and qualitative competitive advantages).
2. "businessQualityReasoning": Clear explanation of the moat rating.
3. "competitivePosition": Select "leader" | "strong" | "neutral" | "weak" | "unknown" (compare to rivals).
4. "competitivePositionReasoning": Rationale for the positioning.
5. "managementGovernance": Select "excellent" | "good" | "mixed" | "poor" | "unknown" (capital allocation and governance).
6. "managementGovernanceReasoning": Rationale for the management assessment.
7. "riskExposure": Select "low" | "medium" | "high" | "critical" | "unknown".
8. "riskReasoning": Rationale for the risk classification.
9. "thesis": A clear 2-3 sentence investment thesis.
10. "bullCase": Array of 3 key positive vectors.
11. "bearCase": Array of 3 key negative vectors.
12. "keyRisks": Array of 3 specific critical risks.
13. "summary": A concise overview of the company's prospects.

Return ONLY a valid JSON object matching the requested schema. No markdown wrapping.
`;

        try {
          const geminiRes = await geminiClient.generateText(prompt, {
            responseSchema,
            systemInstruction: "You are a senior investment research analyst. Return strict JSON according to the schema.",
          });
          const parsed = JSON.parse(geminiRes.text);
          geminiData = { ...geminiData, ...parsed };

          // Create qualitative evidence items based on LLM outputs
          const businessScore = geminiData.businessQualityMoat === "wide" ? 90 : geminiData.businessQualityMoat === "narrow" ? 70 : 40;
          const compScore = geminiData.competitivePosition === "leader" ? 95 : geminiData.competitivePosition === "strong" ? 80 : 60;
          const mgmtScore = geminiData.managementGovernance === "excellent" ? 95 : geminiData.managementGovernance === "good" ? 80 : 60;
          const riskScore = geminiData.riskExposure === "low" ? 85 : geminiData.riskExposure === "medium" ? 65 : 45;

          const startIdx = evidenceInsertions.length;
          
          addEvidenceItem(
            `Moat assessment is ${geminiData.businessQualityMoat}. Rationale: ${geminiData.businessQualityReasoning}`,
            "business",
            "llm_inference",
            "sec",
            null,
            businessScore
          );
          addEvidenceItem(
            `Competitive positioning is ${geminiData.competitivePosition}. Rationale: ${geminiData.competitivePositionReasoning}`,
            "business",
            "llm_inference",
            "earnings",
            null,
            compScore
          );
          addEvidenceItem(
            `Management and governance assessment is ${geminiData.managementGovernance}. Rationale: ${geminiData.managementGovernanceReasoning}`,
            "business",
            "llm_inference",
            "earnings",
            null,
            mgmtScore
          );
          addEvidenceItem(
            `Risk exposure is classified as ${geminiData.riskExposure}. Rationale: ${geminiData.riskReasoning}`,
            "risk",
            "llm_inference",
            "macro",
            null,
            riskScore
          );

          // Save qualitative evidence items to DB
          const newInsertions = evidenceInsertions.slice(startIdx);
          await evidenceRepository.insertManyEvidence(newInsertions);

          newInsertions.forEach((e) => {
            runtimeEvidenceList.push({
              id: e.id,
              researchId: e.researchId,
              claim: e.claim,
              category: e.category,
              sourceType: e.sourceType,
              rawValue: e.rawValue,
              normalizedValue: (e.normalizedValue !== null && e.normalizedValue !== undefined) ? Number(e.normalizedValue) : undefined,
              confidence: Number(e.confidence),
              sourceQuality: Number(e.sourceQuality),
              agentId: e.agentId,
              createdAt: e.createdAt.toISOString()
            });
          });

        } catch (err) {
          logger.error("Coordinator: Qualitative analysis or parsing failed", { error: err });
          sufficiencyResult.limitations.push("LLM Report Synthesis failed or returned invalid response.");
        }
      }

      // 5. Run contradiction audit
      await researchRepository.updateCurrentNode(researchId, "contradictions");
      const auditResults = runDeterministicContradictionAudit(runtimeEvidenceList, financialTrends, {
        peRatio: currentPE || undefined
      });

      const contradictionInsertions = auditResults.map((res) => ({
        id: generateId("ct"),
        researchId,
        evidenceIdA: res.evidenceIdA,
        evidenceIdB: res.evidenceIdB,
        description: res.description,
        severity: res.severity,
        confidence: String(res.confidence),
        createdAt: new Date()
      }));

      if (contradictionInsertions.length > 0) {
        await contradictionRepository.insertContradictions(contradictionInsertions);
      }

      // 6. Compute scores and decision
      await researchRepository.updateCurrentNode(researchId, "scoring");
      
      const scores = computeDeterministicScores(financialTrends, {
        peRatio: currentPE ? Number(currentPE) : undefined,
        evEbitda: fmpQuote[0]?.enterpriseValueOverEBITDA ? Number(fmpQuote[0].enterpriseValueOverEBITDA) : undefined,
      }, {
        businessQualityMoat: geminiData.businessQualityMoat,
        competitivePosition: geminiData.competitivePosition,
        managementGovernance: geminiData.managementGovernance,
        riskExposure: geminiData.riskExposure,
      });

      // Calculate contradiction penalty
      let totalPenalty = 0;
      auditResults.forEach((res) => {
        if (res.severity === "high") totalPenalty += 15;
        else if (res.severity === "medium") totalPenalty += 7;
      });

      const decision = evaluateVerdict(scores, totalPenalty, sufficiencyResult.sufficient);

      // Save scores to DB
      await scoreRepository.upsertScore({
        id: generateId("score"),
        researchId,
        // Old pillars (compatibility)
        business: decision.finalScore !== null ? String(scores.businessQuality) : null,
        financial: decision.finalScore !== null ? String(scores.financialQuality) : null,
        valuation: decision.finalScore !== null ? String(scores.valuation) : null,
        news: decision.finalScore !== null ? "70" : null,
        risk: decision.finalScore !== null ? String(scores.risk) : null,
        evidenceQuality: decision.finalScore !== null ? "80" : null,
        
        // 8 new pillars
        financialQuality: decision.finalScore !== null ? String(scores.financialQuality) : null,
        growthQuality: decision.finalScore !== null ? String(scores.growthQuality) : null,
        businessQuality: decision.finalScore !== null ? String(scores.businessQuality) : null,
        competitivePosition: decision.finalScore !== null ? String(scores.competitivePosition) : null,
        managementGovernance: decision.finalScore !== null ? String(scores.managementGovernance) : null,
        earningsQuality: decision.finalScore !== null ? String(scores.earningsQuality) : null,
        
        // Penalties & Verdict
        contradictionPenalty: decision.finalScore !== null ? String(Math.min(decision.totalPenalty, 25)) : "0",
        finalScore: decision.finalScore !== null ? String(decision.finalScore) : null,
        decision: decision.verdict,
        scoreBreakdown: JSON.stringify(decision),
        createdAt: new Date(),
      });

      // Save Synthesized Report
      await reportRepository.upsertReport({
        id: generateId("rep"),
        researchId,
        thesis: geminiData.thesis || "",
        bullCase: JSON.stringify(geminiData.bullCase || []),
        bearCase: JSON.stringify(geminiData.bearCase || []),
        keyRisks: JSON.stringify(geminiData.keyRisks || []),
        summary: geminiData.summary || "",
        createdAt: new Date(),
      });

      // 7. Complete Research Run
      let finalOutcome:
        | "sufficient"
        | "insufficient_evidence"
        | "provider_failure"
        | "asset_unresolved"
        | "synthesis_degraded"
        | "interrupted" = sufficiencyResult.outcome === "provider_failure"
        ? "insufficient_evidence"
        : sufficiencyResult.outcome as Exclude<typeof sufficiencyResult.outcome, "provider_failure">;

      if (!sufficiencyResult.sufficient) {
        logger.warn("Coordinator: Research insufficient, saved default blank report", {
          researchId,
          reasons: sufficiencyResult.reasons,
        });
      }

      await researchRepository.updateCurrentNode(researchId, "completed");
      await researchRepository.markCompleted(
        researchId,
        companyName,
        finalOutcome,
        sufficiencyResult.reasons,
        sufficiencyResult.limitations,
        "completed"
      );

      logger.info("Coordinator: Pipeline reached terminal state", {
        researchId,
        ticker,
        outcome: finalOutcome,
        sufficiencyPassed: sufficiencyResult.sufficient,
      });

    } catch (error: any) {
      logger.error("Coordinator: Pipeline execution failed", { researchId, error });
      
      // Mark agent runs failed if they were still running
      await agentRunRepository.failAgentRun(financialRunId, error.message || String(error));
      await agentRunRepository.failAgentRun(secRunId, error.message || String(error));
      await agentRunRepository.failAgentRun(macroRunId, error.message || String(error));
      await agentRunRepository.failAgentRun(earningsRunId, error.message || String(error));

      const userSafeErrorMessage = sanitizeErrorMessage(error.message || String(error));
      try {
        await researchRepository.markInterrupted(researchId, userSafeErrorMessage);
      } catch (dbErr) {
        logger.warn("Coordinator: Failed to mark run as interrupted in database", { dbErr });
      }
      throw error;
    }
  }
};
