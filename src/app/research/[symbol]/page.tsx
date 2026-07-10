"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import ResearchLoadingExperience from "@/src/components/research/ResearchLoadingExperience";
import { generateInvestmentReport } from "@/src/utils/pdfGenerator";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

interface SearchResult {
  name: string;
  ticker: string;
  canonicalTicker: string;
  exchange: string;
  country: string;
}

export default function ResearchPage(props: PageProps) {
  const resolvedParams = use(props.params);
  const rawSymbol = resolvedParams.symbol;
  const symbol = decodeURIComponent(rawSymbol);

  // States
  const [loading, setLoading] = useState(true);
  const [isExitingLoader, setIsExitingLoader] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any | null>(null);
  const [simulateGroq, setSimulateGroq] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  // Audit Tab specific filters/views
  const [activeProviderFilter, setActiveProviderFilter] = useState<string | null>(null);
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  // Reference for scrolling to specific evidence items
  const evidenceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const runResearch = async () => {
    setLoading(true);
    setIsExitingLoader(false);
    setPipelineResult(null);

    try {
      const payload: any = { ticker: symbol };
      if (simulateGroq) {
        payload.simulate = { groq: simulateGroq };
      }

      const res = await fetch("/api/research/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setPipelineResult(data);
        // Visual exit transition of 600ms
        setIsExitingLoader(true);
        await new Promise((r) => setTimeout(r, 600));
        setLoading(false);
        setIsExitingLoader(false);
      } else {
        const errText = await res.text();
        alert(`Research pipeline failure: ${errText}`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Research pipeline error: ${err.message || err}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      runResearch();
    }
  }, [symbol]);

  // Handle simulate option update and trigger re-run
  const handleSimulationChange = (val: string) => {
    setSimulateGroq(val);
  };

  const getHistoricalPrices = () => {
    if (!pipelineResult?.evidenceBundle?.historicalPrices) return [];
    const historicalItem = pipelineResult.evidenceBundle.historicalPrices[0];
    if (!historicalItem || !Array.isArray(historicalItem.data)) return [];
    
    const rawList = historicalItem.data as any[];
    const points = rawList.map((d: any) => {
      const dateStr = d.date || d.datetime || d.timestamp || "";
      const priceVal = parseFloat(d.close || d.price || d.open || 0);
      return { date: dateStr, price: priceVal };
    }).filter((p: any) => p.price > 0 && p.date);

    points.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return points;
  };

  const formatCurrency = (val: number | null | undefined, currency = "USD") => {
    if (val === null || val === undefined) return "N/A";
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatLargeNumber = (val: number | null | undefined, isCurrency = false, currency = "USD") => {
    if (val === null || val === undefined || isNaN(val)) return "N/A";
    const absVal = Math.abs(val);
    let formatted = "";
    if (absVal >= 1e12) {
      formatted = `${(val / 1e12).toFixed(2)}T`;
    } else if (absVal >= 1e9) {
      formatted = `${(val / 1e9).toFixed(2)}B`;
    } else if (absVal >= 1e6) {
      formatted = `${(val / 1e6).toFixed(2)}M`;
    } else {
      formatted = val.toLocaleString();
    }
    if (isCurrency) {
      const symbol = currency === "INR" ? "₹" : "$";
      return `${symbol}${formatted}`;
    }
    return formatted;
  };

  const getCategoryStatusClass = (status: string) => {
    switch (status) {
      case "sufficient":
      case "strong":
      case "positive":
      case "valued":
        return "bg-neutral-100 text-neutral-900 border-neutral-900";
      case "moderate":
      case "mixed":
        return "bg-neutral-50 text-neutral-700 border-neutral-400";
      case "neutral":
        return "bg-neutral-50 text-neutral-600 border-neutral-300";
      case "insufficient":
      case "weak":
      case "negative":
        return "bg-neutral-900 text-white border-neutral-950 font-bold";
      case "unavailable":
      default:
        return "bg-neutral-50 text-neutral-500 border-neutral-200";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "working":
      case "success":
        return "bg-neutral-100 text-neutral-900 border-neutral-900";
      case "partial":
        return "bg-neutral-50 text-neutral-700 border-neutral-400";
      case "empty":
        return "bg-neutral-50 text-neutral-400 border-neutral-200";
      case "rate_limit":
        return "bg-neutral-900 text-white border-neutral-950 font-bold animate-pulse";
      case "auth_error":
        return "bg-neutral-900 text-white border-neutral-950 font-black";
      case "plan_limited":
      case "plan_limit":
        return "bg-neutral-100 text-neutral-800 border-neutral-400 font-medium";
      default:
        return "bg-neutral-50 text-neutral-600 border-neutral-300";
    }
  };

  const getVerdictStyle = (v: string) => {
    switch (v) {
      case "INVEST":
        return "bg-emerald-700 text-white border-emerald-900 shadow-[2px_2px_0px_0px_#111111]";
      case "PASS":
        return "bg-rose-700 text-white border-rose-900 shadow-[2px_2px_0px_0px_#111111]";
      default:
        return "bg-neutral-800 text-white border-neutral-950";
    }
  };

  const extractMetadata = (description: string | null) => {
    if (!description) return { ceo: null, founded: null };
    let ceo: string | null = null;
    let founded: string | null = null;

    const ceoMatch = description.match(/(?:CEO|Chief Executive Officer)(?:\s+(?:is|of))?\s+([A-Z][a-z\u00C0-\u00FF\u0100-\u017F]+(?:\s+[A-Z][a-z\u00C0-\u00FF\u0100-\u017F]+){1,2})/);
    if (ceoMatch) {
      ceo = ceoMatch[1];
    } else {
      const altCeoMatch = description.match(/([A-Z][a-z\u00C0-\u00FF\u0100-\u017F]+(?:\s+[A-Z][a-z\u00C0-\u00FF\u0100-\u017F]+){1,2}),\s*(?:CEO|Chief Executive Officer)/);
      if (altCeoMatch) ceo = altCeoMatch[1];
    }

    const foundedMatch = description.match(/founded\s+(?:in|on)\s+(\d{4})/i);
    if (foundedMatch) {
      founded = foundedMatch[1];
    }

    return { ceo, founded };
  };

  const handleCitationClick = (id: string) => {
    setActiveTab("audit");
    setTimeout(() => {
      const target = evidenceRefs.current[id];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("ring-2", "ring-foreground", "scale-101");
        setTimeout(() => {
          target.classList.remove("ring-2", "ring-foreground", "scale-101");
        }, 3000);
      }
    }, 150);
  };

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Loading state panel
  if (loading) {
    return (
      <div className="flex-1 bg-background flex flex-col justify-center items-center px-4 py-20 w-full">
        <ResearchLoadingExperience 
          ticker={symbol} 
          companyName={pipelineResult?.snapshot?.company?.name || "Company Profile"} 
          isExiting={isExitingLoader} 
        />
      </div>
    );
  }

  if (!pipelineResult) {
    return (
      <div className="flex-1 bg-background flex flex-col justify-center items-center px-4 py-20">
        <div className="w-full max-w-md bg-white border-2 border-foreground shadow-[4px_4px_0px_0px_#111111] p-6 text-center space-y-4">
          <div className="w-12 h-12 border border-foreground flex items-center justify-center text-foreground mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Pipeline Fetch Failed</h2>
          <p className="text-2xs text-foreground-secondary leading-relaxed font-medium">
            Could not retrieve data points or complete analysis runs for symbol. Ensure provider connections are active.
          </p>
          <div className="pt-2">
            <button
              onClick={runResearch}
              className="px-4 py-2 border border-foreground bg-foreground text-white hover:bg-neutral-800 text-xs font-bold shadow-[2px_2px_0px_0px_#737373] transition-colors cursor-pointer"
            >
              Retry Pipeline Audit
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { snapshot, analysisRunResult, allEndpoints, evidenceBundle } = pipelineResult;
  const currency = snapshot.company.currency || "USD";
  const points = getHistoricalPrices();

  const tabs = [
    { id: "overview", label: "OVERVIEW" },
    { id: "price-trend", label: "PRICE TREND" },
    { id: "financials", label: "BALANCE & CASH" },
    { id: "news", label: "NEWS SENTIMENT" },
    { id: "evidence", label: "EVIDENCE BALANCE" },
    { id: "audit", label: "PROVIDER AUDIT" }
  ];

  const hasAnalysis = analysisRunResult && analysisRunResult.status !== "unavailable" && analysisRunResult.analysis;
  const verdictStr = hasAnalysis ? analysisRunResult.analysis.verdict : "UNAVAILABLE";
  const finalScore = hasAnalysis ? analysisRunResult.analysis.finalScore : null;
  const overallSummary = hasAnalysis 
    ? (analysisRunResult.analysis.overallSummary || analysisRunResult.analysis.companySummary) 
    : "AI synthesis verdict is currently unavailable. No qualitative thesis could be generated.";
  const marketCapFormatted = formatLargeNumber(snapshot.market.marketCap, true, currency);

  return (
    <div className="w-full flex-1 bg-background flex flex-col font-sans">
      {/* Top Overview & Final Verdict Section (First Viewport) */}
      <div className="border-b-2 border-foreground bg-neutral-50 py-8">
        <div className="max-w-7xl w-full mx-auto px-6">
          <div className="bg-white border-2 border-foreground p-6 shadow-[4px_4px_0px_0px_#111111] space-y-6">
            
            {/* Desktop Layout (Two Column) */}
            <div className="hidden md:grid grid-cols-12 gap-8 items-stretch">
              {/* Left Column: Company Overview */}
              <div className="col-span-7 flex flex-col justify-between space-y-4 border-r border-neutral-200 pr-8">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-xs uppercase tracking-tight bg-neutral-100 border border-foreground px-2 py-0.5">
                      {snapshot.company.ticker}
                    </span>
                    <span className="text-2xs text-foreground-secondary font-mono">
                      {snapshot.company.exchange || "US Exchange"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-foreground mt-1.5 leading-tight uppercase font-sans">
                    {snapshot.company.name}
                  </h2>
                  
                  {/* Sector, CEO, Founded */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-foreground-secondary font-bold font-mono mt-2">
                    <span className="uppercase">{snapshot.company.sector || "N/A"} / {snapshot.company.industry || "N/A"}</span>
                    {(() => {
                      const { ceo, founded } = extractMetadata(snapshot.company.description);
                      return (
                        <>
                          {ceo && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span>CEO: {ceo}</span>
                            </>
                          )}
                          {founded && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span>FOUNDED: {founded}</span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Price & Market Cap Row */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                  <div>
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Latest Stock Price</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-foreground font-mono">
                        {formatCurrency(snapshot.market.price, currency)}
                      </span>
                      {snapshot.market.changePercent !== null && (
                        <span className={`text-8xs font-black font-mono px-1.5 py-0.5 border ${
                          snapshot.market.changePercent >= 0 
                            ? "bg-neutral-100 text-neutral-900 border-neutral-900" 
                            : "bg-neutral-900 text-white border-neutral-950"
                        }`}>
                          {snapshot.market.changePercent >= 0 ? "+" : ""}
                          {snapshot.market.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Market Cap</span>
                    <span className="text-xl font-black text-foreground font-mono block mt-1">
                      {marketCapFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Final Verdict */}
              <div className="col-span-5 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-8xs font-bold text-foreground-muted uppercase tracking-widest block font-mono">Investment Verdict</span>
                    <div className={`px-5 py-2 border text-center font-black text-2xl tracking-widest ${getVerdictStyle(verdictStr)}`}>
                      {verdictStr}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="text-8xs font-bold text-foreground-muted uppercase tracking-widest block font-mono">Confidence Score</span>
                    <div className="bg-white border border-foreground px-4 py-2 flex flex-col items-center justify-center shadow-[2px_2px_0px_0px_#111111]">
                      <span className="text-lg font-black text-foreground font-mono">
                        {finalScore !== null ? finalScore : "N/A"}
                      </span>
                      <span className="text-8xs text-foreground-muted uppercase tracking-wider font-bold font-mono">out of 100</span>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-50 p-4 border border-neutral-200 space-y-1.5 flex-1 flex flex-col justify-center">
                  <span className="text-8xs font-black text-foreground-muted uppercase tracking-widest block font-mono">Thesis Summary:</span>
                  <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                    {overallSummary}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Layout (Stacked) */}
            <div className="block md:hidden space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-9xs uppercase bg-neutral-100 border border-foreground px-2 py-0.5">
                    {snapshot.company.ticker}
                  </span>
                  <span className="text-9xs text-foreground-secondary font-mono">
                    {snapshot.company.exchange || "US Exchange"}
                  </span>
                </div>
                <h2 className="text-base font-black text-foreground mt-1 uppercase">
                  {snapshot.company.name}
                </h2>
                <p className="text-9xs text-foreground-secondary font-bold font-mono uppercase mt-0.5">
                  {snapshot.company.sector || "N/A"} · {snapshot.company.industry || "N/A"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 border-y border-neutral-200">
                <div>
                  <span className="text-9xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Price</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-base font-black text-foreground font-mono">
                      {formatCurrency(snapshot.market.price, currency)}
                    </span>
                    {snapshot.market.changePercent !== null && (
                      <span className={`text-9xs font-bold font-mono px-1 border ${
                        snapshot.market.changePercent >= 0 
                          ? "bg-neutral-100 text-neutral-900 border-neutral-900" 
                          : "bg-neutral-900 text-white border-neutral-950"
                      }`}>
                        {snapshot.market.changePercent >= 0 ? "+" : ""}{snapshot.market.changePercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-9xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Market Cap</span>
                  <span className="text-base font-black text-foreground font-mono block mt-0.5">
                    {marketCapFormatted}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-9xs font-bold text-foreground-muted uppercase tracking-widest block mb-1 font-mono">Verdict</span>
                  <div className={`py-1.5 border text-center font-black text-lg tracking-widest ${getVerdictStyle(verdictStr)}`}>
                    {verdictStr}
                  </div>
                </div>
                <div>
                  <span className="text-9xs font-bold text-foreground-muted uppercase tracking-widest block mb-1 font-mono">Score</span>
                  <div className="bg-white border border-foreground px-3 py-1 text-center shadow-[2px_2px_0px_0px_#111111]">
                    <span className="text-base font-black text-foreground font-mono">
                      {finalScore !== null ? finalScore : "N/A"}
                    </span>
                    <span className="text-9xs text-foreground-muted block font-mono font-bold uppercase">/ 100</span>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-50 p-3.5 border border-neutral-200 space-y-1">
                <span className="text-9xs font-black text-foreground-muted uppercase tracking-widest block font-mono">Thesis Summary:</span>
                <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                  {overallSummary}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Sticky Tab Navigation Header */}
      <div className="sticky top-0 bg-white border-b-2 border-foreground z-40 no-print">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-sm uppercase tracking-tight bg-neutral-100 border border-foreground px-2 py-0.5">
              {snapshot.company.ticker}
            </span>
            <h1 className="text-xs font-bold text-foreground uppercase tracking-tight hidden sm:block">{snapshot.company.name}</h1>
          </div>
          
          <nav aria-label="Page section navigation" className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-2xs font-bold tracking-wider px-3 py-1.5 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-foreground text-white border border-foreground"
                    : "text-foreground-secondary hover:text-foreground hover:bg-neutral-100 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex gap-2">
            <button
              onClick={() => generateInvestmentReport(pipelineResult)}
              className="px-3 py-1.5 border border-foreground bg-white text-2xs font-bold text-foreground hover:bg-neutral-50 shadow-[2px_2px_0px_0px_#111111] transition-all cursor-pointer font-mono shrink-0"
            >
              DOWNLOAD PDF
            </button>
            <button
              onClick={runResearch}
              className="px-3 py-1.5 border border-foreground bg-white text-2xs font-bold text-foreground hover:bg-neutral-50 shadow-[2px_2px_0px_0px_#111111] transition-all cursor-pointer font-mono shrink-0"
            >
              RE-RUN DIAGNOSTIC
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
        
        {/* Tab content area */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Core Ticker info */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <div className="flex justify-between items-center border-b border-foreground pb-3">
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-tight">1. Company Details</h3>
                  <p className="text-2xs text-foreground-secondary font-mono">Listing metadata and profile details extracted from registry providers</p>
                </div>
                <span className="text-2xs text-foreground-secondary font-mono bg-neutral-100 px-2 py-0.5 border border-neutral-300">
                  Exchange: {snapshot.company.exchange || "US"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-neutral-50 border border-neutral-200 p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Company Name</span>
                  <span className="text-xs font-bold text-foreground block mt-1">{snapshot.company.name}</span>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Exchange / Country</span>
                  <span className="text-xs font-bold text-foreground block mt-1">
                    {snapshot.company.exchange || "N/A"} ({snapshot.company.country || "N/A"})
                  </span>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Sector / Industry</span>
                  <span className="text-xs font-bold text-foreground block mt-1 truncate">
                    {snapshot.company.sector || "N/A"} / {snapshot.company.industry || "N/A"}
                  </span>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Reporting Currency</span>
                  <span className="text-xs font-mono font-bold text-foreground block mt-1">
                    {snapshot.company.currency || "USD"}
                  </span>
                </div>
              </div>

              {snapshot.company.description && (
                <div className="bg-neutral-50 border border-neutral-200 p-4">
                  <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono mb-1">Company Description</span>
                  <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                    {snapshot.company.description}
                  </p>
                </div>
              )}
            </div>

            {/* Price Quote & Session Analytics */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <div className="flex justify-between items-center border-b border-foreground pb-3">
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-tight">2. Current Stock Price</h3>
                  <p className="text-2xs text-foreground-secondary font-mono">Live/latest market price quote and session analytics</p>
                </div>
                <span className="text-2xs text-foreground-secondary font-mono bg-neutral-100 px-2 py-0.5 border border-neutral-300">
                  Source: {snapshot.provenance?.market || "Provider Quotes"}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-3xl font-black text-foreground font-mono">
                    {formatCurrency(snapshot.market.price, currency)}
                  </span>
                  {snapshot.market.changePercent !== null && (
                    <span className={`text-2xs font-black font-mono px-2 py-0.5 border ${
                      snapshot.market.changePercent >= 0 
                        ? "bg-neutral-100 text-neutral-900 border-neutral-900" 
                        : "bg-neutral-900 text-white border-neutral-950"
                    }`}>
                      {snapshot.market.changePercent >= 0 ? "+" : ""}
                      {snapshot.market.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 flex-1 w-full">
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Prev Close</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatCurrency(snapshot.market.previousClose, currency)}
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Session High</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatCurrency(snapshot.market.high, currency)}
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Session Low</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatCurrency(snapshot.market.low, currency)}
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Volume</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatLargeNumber(snapshot.market.volume)}
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">P/E Ratio</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {snapshot.market.pe !== null ? snapshot.market.pe.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">P/B Ratio</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {snapshot.market.pb !== null ? snapshot.market.pb.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">EPS</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {snapshot.market.eps !== null ? snapshot.market.eps.toFixed(2) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cross provider comparison alert */}
              {snapshot.validation && snapshot.validation.status !== "unchecked" && (
                <div className="bg-neutral-50 border border-neutral-200 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold mb-0.5 font-mono">Cross-Provider Quote Verification Alert</span>
                    <p className="text-xs text-foreground-secondary font-medium leading-relaxed">
                      Primary provider <span className="font-bold text-foreground">{snapshot.validation.primarySource}</span> was compared against secondary reference <span className="font-bold text-foreground">{snapshot.validation.comparedSource}</span>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {snapshot.validation.deviationPercent !== null && (
                      <span className="text-2xs text-foreground-secondary font-mono bg-white px-2 py-0.5 border border-foreground">
                        Deviation: {snapshot.validation.deviationPercent.toFixed(4)}%
                      </span>
                    )}
                    <span className={`text-8xs font-black uppercase tracking-widest px-2 py-0.5 border ${
                      snapshot.validation.status === "consistent"
                        ? "bg-neutral-100 text-neutral-900 border-neutral-900"
                        : "bg-neutral-900 text-white border-neutral-950"
                    }`}>
                      {snapshot.validation.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "price-trend" && (
          <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-foreground pb-3">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-tight">3. Price History (Last 2–3 Years)</h3>
                <p className="text-2xs text-foreground-secondary font-mono">Factual daily historical closing prices and compound returns over the length</p>
              </div>
              <span className={`px-2 py-0.5 text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.priceHistory.status)}`}>
                {snapshot.categoryAssessments.priceHistory.status}
              </span>
            </div>

            {points.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-foreground font-mono">
                No historical price data points fetched.
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const startPrice = points[0].price;
                  const endPrice = points[points.length - 1].price;
                  const minPrice = Math.min(...points.map(p => p.price));
                  const maxPrice = Math.max(...points.map(p => p.price));
                  const totalReturn = ((endPrice - startPrice) / startPrice) * 100;

                  const strokeColor = "#111111";

                  // SVG calculation
                  const priceRange = maxPrice - minPrice || 1;
                  const padding = priceRange * 0.05;
                  const chartMin = minPrice - padding;
                  const chartMax = maxPrice + padding;
                  const chartRange = chartMax - chartMin;

                  const width = 1000;
                  const height = 240;

                  const coords = points.map((p, index) => {
                    const denominator = points.length > 1 ? points.length - 1 : 1;
                    const x = (index / denominator) * width;
                    const y = height - ((p.price - chartMin) / chartRange) * height;
                    return { x, y };
                  });

                  const chartPath = `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map(c => `L ${c.x} ${c.y}`).join(" ");
                  const areaPath = `${chartPath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-neutral-50 border border-neutral-200 p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Start Price ({points[0].date})</span>
                          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(startPrice, currency)}</span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">End Price ({points[points.length - 1].date})</span>
                          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(endPrice, currency)}</span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">Period Return</span>
                          <span className={`text-sm font-black font-mono ${totalReturn >= 0 ? "text-neutral-900" : "text-neutral-700"}`}>
                            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
                          </span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-widest block font-bold font-mono">High / Low Peaks</span>
                          <span className="text-xs font-bold text-foreground font-mono">
                            {formatCurrency(minPrice, currency)} - {formatCurrency(maxPrice, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Line Chart */}
                      <div className="relative border border-foreground bg-white p-4 overflow-hidden shadow-[2px_2px_0px_0px_#111111]">
                        <svg viewBox="0 0 1000 240" className="w-full h-56 overflow-visible" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="monoGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#111111" stopOpacity="0.08"/>
                              <stop offset="100%" stopColor="#111111" stopOpacity="0.0"/>
                            </linearGradient>
                          </defs>
                          
                          {/* Grid Lines */}
                          <line x1="0" y1="60" x2="1000" y2="60" stroke="#e5e5e5" strokeDasharray="2 2" strokeWidth="1" />
                          <line x1="0" y1="120" x2="1000" y2="120" stroke="#e5e5e5" strokeDasharray="2 2" strokeWidth="1" />
                          <line x1="0" y1="180" x2="1000" y2="180" stroke="#e5e5e5" strokeDasharray="2 2" strokeWidth="1" />

                          {/* Fill */}
                          <path d={areaPath} fill="url(#monoGradient)" />

                          {/* Path line */}
                          <path d={chartPath} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
                        </svg>

                        {/* Labels */}
                        <div className="flex justify-between text-8xs text-foreground-secondary font-mono mt-2 uppercase font-bold">
                          <span>{points[0].date}</span>
                          <span>{points[Math.floor(points.length / 2)].date}</span>
                          <span>{points[points.length - 1].date}</span>
                        </div>
                      </div>
                      <p className="text-6xs text-foreground-secondary italic leading-normal">
                        * {snapshot.categoryAssessments.priceHistory.reason}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === "financials" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Financial strength */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <div className="flex justify-between items-center border-b border-foreground pb-3">
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-tight">4. Financial Capacity & Strength</h3>
                  <p className="text-2xs text-foreground-secondary font-mono">Annual balance sheet strength, leverage capacities, and equity returns</p>
                </div>
                <span className={`px-2 py-0.5 text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.financialCapacity.status)}`}>
                  {snapshot.categoryAssessments.financialCapacity.status}
                </span>
              </div>

              {snapshot.financials.length === 0 ? (
                <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-foreground font-mono">
                  No fundamental financial statements resolved.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-foreground">
                    <table className="w-full text-left border-collapse text-2xs">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-foreground text-foreground font-bold font-mono uppercase">
                          <th className="p-3">Year</th>
                          <th className="p-3">Revenue</th>
                          <th className="p-3">Net Income</th>
                          <th className="p-3">Total Assets</th>
                          <th className="p-3">Total Liabilities</th>
                          <th className="p-3">Shareholder Equity</th>
                          <th className="p-3">Debt-to-Equity</th>
                          <th className="p-3">ROE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {snapshot.financials.map((f: any) => {
                          const equity = (f.totalAssets !== null && f.totalLiabilities !== null) ? (f.totalAssets - f.totalLiabilities) : null;
                          return (
                            <tr key={f.year} className="hover:bg-neutral-50 text-foreground-secondary font-mono">
                              <td className="p-3 font-sans font-bold text-foreground">{f.year}</td>
                              <td className="p-3">{formatLargeNumber(f.revenue, true, currency)}</td>
                              <td className={`p-3 font-bold ${f.netIncome >= 0 ? "text-neutral-900" : "text-neutral-700"}`}>
                                {formatLargeNumber(f.netIncome, true, currency)}
                              </td>
                              <td className="p-3">{formatLargeNumber(f.totalAssets, true, currency)}</td>
                              <td className="p-3">{formatLargeNumber(f.totalLiabilities, true, currency)}</td>
                              <td className="p-3 font-semibold">{formatLargeNumber(equity, true, currency)}</td>
                              <td className="p-3">{f.debtToEquity !== null ? f.debtToEquity.toFixed(2) : "N/A"}</td>
                              <td className="p-3">{f.roe !== null ? `${(f.roe * 100).toFixed(2)}%` : "N/A"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-6xs text-foreground-secondary italic leading-normal">
                    * {snapshot.categoryAssessments.financialCapacity.reason}
                  </p>
                </div>
              )}
            </div>

            {/* Cash flow health */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <div className="flex justify-between items-center border-b border-foreground pb-3">
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-tight">5. Cash Flow Analysis</h3>
                  <p className="text-2xs text-foreground-secondary font-mono">Operational liquidity generation and calculated free cash flow values</p>
                </div>
                <span className={`px-2 py-0.5 text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.cashFlow.status)}`}>
                  {snapshot.categoryAssessments.cashFlow.status}
                </span>
              </div>

              {snapshot.financials.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-400 border border-dashed border-foreground font-mono">
                  No cash flow statements resolved.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-foreground">
                    <table className="w-full text-left border-collapse text-2xs">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-foreground text-foreground font-bold font-mono uppercase">
                          <th className="p-3">Year</th>
                          <th className="p-3">Operating Cash Flow</th>
                          <th className="p-3">Capex (Calculated)</th>
                          <th className="p-3">Free Cash Flow</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {snapshot.financials.map((f: any) => {
                          const capex = (f.operatingCashFlow !== null && f.freeCashFlow !== null) ? (f.operatingCashFlow - f.freeCashFlow) : null;
                          return (
                            <tr key={f.year} className="hover:bg-neutral-50 text-foreground-secondary font-mono">
                              <td className="p-3 font-sans font-bold text-foreground">{f.year}</td>
                              <td className={`p-3 ${f.operatingCashFlow >= 0 ? "text-neutral-900" : "text-neutral-700"}`}>
                                {formatLargeNumber(f.operatingCashFlow, true, currency)}
                              </td>
                              <td className="p-3">{formatLargeNumber(capex, true, currency)}</td>
                              <td className={`p-3 font-bold ${f.freeCashFlow >= 0 ? "text-neutral-900" : "text-neutral-700"}`}>
                                {formatLargeNumber(f.freeCashFlow, true, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-6xs text-foreground-secondary italic leading-normal">
                    * {snapshot.categoryAssessments.cashFlow.reason}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "news" && (
          <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-foreground pb-3">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-tight">6. Market News & Mentions</h3>
                <p className="text-2xs text-foreground-secondary font-mono">Recent aggregated news headlines, articles, and references</p>
              </div>
              <span className={`px-2 py-0.5 text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.news.status)}`}>
                Sentiment: {snapshot.categoryAssessments.news.status}
              </span>
            </div>

            {snapshot.news.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-foreground font-mono">
                No recent news headlines fetched.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {snapshot.news.slice(0, 6).map((item: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="border border-foreground p-4 bg-white shadow-[2px_2px_0px_0px_#111111] flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-8xs text-foreground-muted font-mono uppercase font-bold">
                          <span>{item.source || "Unknown Source"}</span>
                          <span>{item.date ? new Date(item.date).toLocaleDateString() : "Recent"}</span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2 uppercase">{item.title}</h4>
                        {item.summary && (
                          <p className="text-2xs text-foreground-secondary leading-relaxed line-clamp-3 font-medium">
                            {item.summary}
                          </p>
                        )}
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-2xs font-bold text-foreground hover:underline underline self-start flex items-center gap-1 font-mono uppercase"
                        >
                          Read Article
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-6xs text-foreground-secondary italic leading-normal">
                  * {snapshot.categoryAssessments.news.reason}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "evidence" && (
          <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-6 animate-fadeIn">
            {analysisRunResult.status === "unavailable" || !analysisRunResult.analysis ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-foreground pb-4">
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-tight">7. Evidence Synthesis & Balance</h3>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Qualitative AI synthesis evidence is currently unavailable
                    </p>
                  </div>
                  <span className="px-2 py-0.5 border text-8xs font-mono font-bold uppercase bg-neutral-900 text-white">
                    UNAVAILABLE
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="w-12 h-12 border border-foreground flex items-center justify-center text-foreground">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground uppercase">AI Analysis Synthesis Failed</h4>
                    <p className="text-xs text-foreground-secondary max-w-md mx-auto leading-relaxed font-medium">
                      Orchestrator API requests failed or returned schema discrepancies. Fallbacks are deactivated to protect financial integrity.
                    </p>
                  </div>
                </div>

                {/* Attempt breakdown logs */}
                <div className="border-t border-foreground pt-4 space-y-3">
                  <span className="text-8xs font-bold text-foreground-muted uppercase tracking-widest block font-mono">AI Orchestrator Execution Log</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisRunResult.attempts?.map((attempt: any, idx: number) => (
                      <div key={idx} className="border border-foreground p-3 bg-white text-xs space-y-1.5 font-medium shadow-[2px_2px_0px_0px_#111111]">
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-extrabold text-foreground uppercase">{attempt.provider}</span>
                          <span className={`px-1.5 py-0.5 text-8xs border font-black uppercase ${
                            attempt.status === "success" 
                              ? "bg-neutral-100 text-neutral-900 border-neutral-900" 
                              : "bg-neutral-900 text-white border-neutral-950"
                          }`}>{attempt.status}</span>
                        </div>
                        <div className="text-8xs text-foreground-secondary font-mono">Model: {attempt.model} ({attempt.durationMs}ms)</div>
                        {attempt.message && <div className="text-8xs text-neutral-900 font-mono mt-1 break-all line-clamp-2">{attempt.message}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-foreground pb-4">
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-tight">7. Evidence Synthesis & Balance</h3>
                    <p className="text-2xs text-foreground-secondary mt-0.5 font-mono">
                      Qualitative evidence details compiled by specialist model: <span className="font-bold text-foreground uppercase">{analysisRunResult.model || "Consensus Engine"}</span>
                    </p>
                  </div>
                  <span className="px-2 py-0.5 border text-8xs font-mono font-bold uppercase bg-neutral-100 text-neutral-900 border-neutral-900">
                    Live Synthesis Consensus
                  </span>
                </div>

                {/* Strengths & Concerns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-foreground p-4 bg-white space-y-2 shadow-[3px_3px_0px_0px_#111111]">
                    <span className="font-extrabold text-xs text-foreground uppercase block tracking-wider flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 bg-foreground"></span>
                      Key Strengths
                    </span>
                    <ul className="text-xs text-foreground list-disc list-inside space-y-1.5">
                      {analysisRunResult.analysis.strengths?.slice(0, 4).map((s: string, idx: number) => (
                        <li key={idx} className="leading-snug text-2xs font-medium">{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-foreground p-4 bg-white space-y-2 shadow-[3px_3px_0px_0px_#111111]">
                    <span className="font-extrabold text-xs text-foreground uppercase block tracking-wider flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 bg-foreground"></span>
                      Key Concerns
                    </span>
                    <ul className="text-xs text-foreground list-disc list-inside space-y-1.5">
                      {analysisRunResult.analysis.concerns?.slice(0, 4).map((c: string, idx: number) => (
                        <li key={idx} className="leading-snug text-2xs font-medium">{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Cited Evidence Tags */}
                <div className="border-t border-neutral-200 pt-4 space-y-2.5">
                  <span className="text-8xs font-black text-foreground-muted uppercase tracking-widest block font-mono">Cited Evidence Index</span>
                  <div className="flex flex-wrap gap-2">
                    {analysisRunResult.analysis.citedEvidenceIds?.map((id: string) => {
                      const item = evidenceBundle?.evidenceIndex?.[id];
                      return (
                        <button
                          key={id}
                          onClick={() => handleCitationClick(id)}
                          className="px-2 py-1 bg-white hover:bg-neutral-50 border border-foreground font-mono text-8xs text-foreground flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_#111111] cursor-pointer"
                        >
                          <span className="font-extrabold text-foreground">{id}</span>
                          <span className="text-foreground-secondary border-l border-neutral-200 pl-1.5">
                            {item ? `${item.provider} (${item.endpoint})` : "Factual citation reference"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Interactive developer simulation panel */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Advanced Developer Simulation</h3>
              <p className="text-2xs text-foreground-secondary font-mono">Override LLM query responses or simulate network/auth rate limits on live fetches</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-8xs font-bold text-foreground-muted uppercase tracking-widest font-mono">Simulate Consensus Failures</label>
                  <select
                    value={simulateGroq}
                    onChange={(e) => handleSimulationChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-foreground font-mono focus:outline-none"
                  >
                    <option value="">Live API calls (Normal)</option>
                    <option value="rate_limit">Rate Limit (429)</option>
                    <option value="auth_error">Auth Error (Invalid API Key)</option>
                    <option value="timeout">Timeout</option>
                    <option value="schema_failure">Schema Validation Failure</option>
                    <option value="provider_error">General Provider Error</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={runResearch}
                    className="w-full sm:w-auto px-4 py-2 bg-foreground text-white border border-foreground hover:bg-neutral-800 text-xs font-bold shadow-[2px_2px_0px_0px_#737373] transition-all cursor-pointer font-mono"
                  >
                    RE-RUN WITH SIMULATION SETTINGS
                  </button>
                </div>
              </div>
            </div>

            {/* Provider endpoints logs */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <div className="flex justify-between items-center border-b border-foreground pb-3">
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Diagnostics Endpoint Logs</h3>
                  <p className="text-2xs text-foreground-secondary font-mono">Detailed execution status and latency metrics for each registry call</p>
                </div>
                <div className="flex gap-2 font-mono">
                  <button
                    onClick={() => setActiveProviderFilter(null)}
                    className={`px-2 py-1 text-8xs font-bold border cursor-pointer uppercase ${
                      !activeProviderFilter 
                        ? "bg-foreground text-white border-foreground" 
                        : "bg-white text-foreground border-foreground hover:bg-neutral-50"
                    }`}
                  >
                    All
                  </button>
                  {Array.from(new Set(allEndpoints.map((e: any) => e.provider))).map((providerName: any) => (
                    <button
                      key={providerName}
                      onClick={() => setActiveProviderFilter(providerName)}
                      className={`px-2 py-1 text-8xs font-bold border cursor-pointer uppercase ${
                        activeProviderFilter === providerName 
                          ? "bg-foreground text-white border-foreground" 
                          : "bg-white text-foreground border-foreground hover:bg-neutral-50"
                      }`}
                    >
                      {providerName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-foreground border border-foreground overflow-hidden">
                {allEndpoints
                  .filter((e: any) => !activeProviderFilter || e.provider === activeProviderFilter)
                  .map((e: any) => {
                    const key = `${e.provider}-${e.endpointName}`;
                    const isExpanded = expandedEndpoints[key] || false;
                    return (
                      <div key={key} className="bg-white" id={key}>
                        <button
                          onClick={() => toggleEndpoint(key)}
                          className="w-full px-4 py-3 hover:bg-neutral-50 flex justify-between items-center text-xs transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold uppercase text-foreground shrink-0 font-mono">{e.provider}</span>
                            <span className="text-foreground-secondary font-mono">{e.endpointName}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-8xs text-foreground-muted">{e.durationMs}ms</span>
                            <span className={`px-1.5 py-0.5 text-8xs font-black uppercase border ${getStatusBadgeClass(e.status)}`}>
                              {e.status}
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="bg-neutral-900 border-t border-neutral-800 p-4 font-mono text-8xs text-neutral-300 overflow-x-auto max-h-96">
                            <div className="flex justify-between items-center pb-2 mb-2 border-b border-neutral-800">
                              <span>Raw HTTP Response Contract</span>
                              <span className="text-neutral-500">Status code: {e.httpStatus || "N/A"}</span>
                            </div>
                            <pre className="whitespace-pre-wrap">{JSON.stringify(e.response, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Evidence Index Tracing Section */}
            <div className="bg-white border-2 border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] space-y-4">
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Factual Evidence Index</h3>
              <p className="text-2xs text-foreground-secondary font-mono">Trace citations directly back to parsed evidence bundles</p>
              
              <div className="space-y-3">
                {Object.keys(evidenceBundle.evidenceIndex || {}).map((id) => {
                  const ev = evidenceBundle.evidenceIndex[id];
                  return (
                    <div 
                      key={id}
                      ref={(el) => { evidenceRefs.current[id] = el; }}
                      className="p-4 border border-foreground bg-white shadow-[2px_2px_0px_0px_#111111] transition-all flex flex-col sm:flex-row justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-white bg-foreground px-2 py-0.5 border border-foreground">
                            {id}
                          </span>
                          <span className="text-8xs font-bold text-foreground-secondary uppercase tracking-widest font-mono">
                            {ev.provider} ({ev.endpoint})
                          </span>
                        </div>
                        <div className="text-xs text-foreground leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-48 pt-1.5">
                          {typeof ev.data === "object" ? JSON.stringify(ev.data, null, 2) : String(ev.data)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className="text-8xs text-foreground-muted block font-mono">OBSERVED AT</span>
                        <span className="text-8xs font-semibold text-foreground block font-mono mt-0.5">
                          {ev.observedAt ? new Date(ev.observedAt).toLocaleTimeString() : "N/A"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
