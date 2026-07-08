"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import ResearchLoadingExperience from "@/src/components/research/ResearchLoadingExperience";

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
  const [showFullJson, setShowFullJson] = useState(false);
  const [showEvidenceBundleJson, setShowEvidenceBundleJson] = useState(false);
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
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "moderate":
      case "mixed":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "neutral":
        return "bg-slate-500/10 text-slate-700 border-slate-500/20";
      case "insufficient":
      case "weak":
      case "negative":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      case "unavailable":
      default:
        return "bg-slate-500/10 text-slate-700 border-slate-500/20";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "working":
      case "success":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "partial":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "empty":
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
      case "rate_limit":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse";
      case "auth_error":
        return "bg-red-500/10 text-red-600 border-red-500/20 font-bold";
      case "plan_limited":
      case "plan_limit":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20 font-medium";
      default:
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    }
  };

  const getVerdictStyle = (v: string) => {
    switch (v) {
      case "INVEST":
        return "bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-500/25";
      case "PASS":
        return "bg-rose-600 text-white border-rose-700 shadow-sm shadow-rose-500/25";
      default:
        return "bg-rose-600 text-white border-rose-700";
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

  // Click citation to scroll and highlight the raw diagnostic evidence item
  const handleCitationClick = (id: string) => {
    setActiveTab("audit");
    setTimeout(() => {
      const target = evidenceRefs.current[id];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("ring-2", "ring-orange-500", "scale-101");
        setTimeout(() => {
          target.classList.remove("ring-2", "ring-orange-500", "scale-101");
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

  // Loading indicator panel
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
        <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-md p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-foreground">Pipeline Fetch Failed</h2>
          <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
            Could not retrieve data points or complete analysis runs for symbol. Ensure provider connections are active.
          </p>
          <div className="pt-2">
            <button
              onClick={runResearch}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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

  // Scroll target shortcuts
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "price-trend", label: "Price Trend" },
    { id: "financials", label: "Balance & Cash" },
    { id: "news", label: "News Sentiment" },
    { id: "evidence", label: "Evidence Balance" },
    { id: "audit", label: "Provider Audit" }
  ];

  const hasAnalysis = analysisRunResult && analysisRunResult.status !== "unavailable" && analysisRunResult.analysis;
  const verdictStr = hasAnalysis ? analysisRunResult.analysis.verdict : "UNAVAILABLE";
  const finalScore = hasAnalysis ? analysisRunResult.analysis.finalScore : null;
  const overallSummary = hasAnalysis 
    ? (analysisRunResult.analysis.overallSummary || analysisRunResult.analysis.companySummary) 
    : "AI synthesis verdict is currently unavailable. No qualitative thesis could be generated.";
  const marketCapFormatted = formatLargeNumber(snapshot.market.marketCap, true, currency);

  return (
    <div className="w-full flex-1 bg-background flex flex-col animate-fadeIn">
      {/* Top Overview & Final Verdict Section (First Viewport) */}
      <div className="border-b border-border bg-slate-50/50 py-8">
        <div className="max-w-6xl w-full mx-auto px-6">
          <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-6">
            
            {/* Desktop Layout (Two Column) */}
            <div className="hidden md:grid grid-cols-12 gap-8 items-stretch">
              {/* Left Column: Company Overview */}
              <div className="col-span-7 flex flex-col justify-between space-y-4 border-r border-slate-100 pr-8">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-foreground text-xs uppercase tracking-tight bg-slate-100 border border-border px-2.5 py-0.5 rounded-lg font-mono">
                      {snapshot.company.ticker}
                    </span>
                    <span className="text-2xs text-foreground-secondary font-mono">
                      {snapshot.company.exchange || "US Exchange"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-foreground mt-1.5 leading-tight">
                    {snapshot.company.name}
                  </h2>
                  
                  {/* Sector, CEO, Founded */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-foreground-secondary font-medium mt-2">
                    <span>{snapshot.company.sector || "N/A"} / {snapshot.company.industry || "N/A"}</span>
                    {(() => {
                      const { ceo, founded } = extractMetadata(snapshot.company.description);
                      return (
                        <>
                          {ceo && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>CEO: {ceo}</span>
                            </>
                          )}
                          {founded && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>Founded: {founded}</span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Price & Market Cap Row */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100/80">
                  <div>
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Latest Stock Price</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-foreground font-mono">
                        {formatCurrency(snapshot.market.price, currency)}
                      </span>
                      {snapshot.market.changePercent !== null && (
                        <span className={`text-8xs font-black font-mono px-1.5 py-0.5 rounded border ${
                          snapshot.market.changePercent >= 0 
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                        }`}>
                          {snapshot.market.changePercent >= 0 ? "+" : ""}
                          {snapshot.market.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Market Cap</span>
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
                    <span className="text-8xs font-bold text-foreground-muted uppercase tracking-wider block">Investment Verdict</span>
                    <div className={`px-5 py-2.5 rounded-xl border text-center font-black text-2xl tracking-widest ${getVerdictStyle(verdictStr)}`}>
                      {verdictStr}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="text-8xs font-bold text-foreground-muted uppercase tracking-wider block">Confidence Score</span>
                    <div className="bg-slate-50 border border-border rounded-xl px-4 py-2 flex flex-col items-center justify-center shadow-inner">
                      <span className="text-lg font-black text-foreground font-mono">
                        {finalScore !== null ? finalScore : "N/A"}
                      </span>
                      <span className="text-8xs text-foreground-muted uppercase tracking-wider font-bold">out of 100</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5 flex-1 flex flex-col justify-center">
                  <span className="text-8xs font-black text-foreground-muted uppercase tracking-wider block">Thesis Summary:</span>
                  <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                    {overallSummary}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Layout (Stacked) */}
            <div className="block md:hidden space-y-4">
              {/* 1. Company Identity */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-foreground text-9xs uppercase bg-slate-100 border border-border px-2 py-0.5 rounded font-mono">
                    {snapshot.company.ticker}
                  </span>
                  <span className="text-9xs text-foreground-secondary font-mono">
                    {snapshot.company.exchange || "US Exchange"}
                  </span>
                </div>
                <h2 className="text-lg font-black text-foreground mt-1">
                  {snapshot.company.name}
                </h2>
                <p className="text-9xs text-foreground-secondary font-medium mt-0.5">
                  {snapshot.company.sector || "N/A"} · {snapshot.company.industry || "N/A"}
                </p>
              </div>

              {/* 2. Key Metrics */}
              <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-100">
                <div>
                  <span className="text-9xs text-foreground-muted uppercase tracking-wider block font-bold">Price</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-base font-black text-foreground font-mono">
                      {formatCurrency(snapshot.market.price, currency)}
                    </span>
                    {snapshot.market.changePercent !== null && (
                      <span className={`text-9xs font-bold font-mono px-1 rounded ${
                        snapshot.market.changePercent >= 0 
                          ? "bg-emerald-500/10 text-emerald-700" 
                          : "bg-rose-500/10 text-rose-700"
                      }`}>
                        {snapshot.market.changePercent >= 0 ? "+" : ""}{snapshot.market.changePercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-9xs text-foreground-muted uppercase tracking-wider block font-bold">Market Cap</span>
                  <span className="text-base font-black text-foreground font-mono block mt-0.5">
                    {marketCapFormatted}
                  </span>
                </div>
              </div>

              {/* 3. Final Verdict */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-9xs font-bold text-foreground-muted uppercase tracking-wider block mb-1">Verdict</span>
                  <div className={`py-2 rounded-xl border text-center font-black text-lg tracking-widest ${getVerdictStyle(verdictStr)}`}>
                    {verdictStr}
                  </div>
                </div>
                <div>
                  <span className="text-9xs font-bold text-foreground-muted uppercase tracking-wider block mb-1">Score</span>
                  <div className="bg-slate-50 border border-border rounded-xl px-3 py-1 text-center font-mono">
                    <span className="text-base font-black text-foreground">
                      {finalScore !== null ? finalScore : "N/A"}
                    </span>
                    <span className="text-9xs text-foreground-muted block font-sans font-bold uppercase">/ 100</span>
                  </div>
                </div>
              </div>

              {/* 4. Short Overview */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                <span className="text-9xs font-black text-foreground-muted uppercase tracking-wider block">Thesis Summary:</span>
                <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                  {overallSummary}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Sticky Tab Navigation Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-border z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-foreground text-sm uppercase tracking-tight bg-slate-100 border border-border px-2.5 py-1 rounded-lg font-mono">
              {snapshot.company.ticker}
            </span>
            <h1 className="text-sm font-bold text-foreground hidden sm:block">{snapshot.company.name}</h1>
          </div>
          
          <nav aria-label="Page section navigation" className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "text-foreground-secondary hover:text-foreground hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={runResearch}
            className="px-3.5 py-1.5 border border-border bg-white text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all shadow-2xs text-foreground cursor-pointer shrink-0"
          >
            Re-run Diagnostic
          </button>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
        
        {/* Tab content area */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Core Ticker info */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">1. Company Details</h3>
                  <p className="text-2xs text-foreground-secondary">Listing metadata and profile details extracted from registry providers</p>
                </div>
                <span className="text-2xs text-foreground-secondary font-mono bg-slate-50 px-2.5 py-0.5 rounded border border-border">
                  Exchange: {snapshot.company.exchange || "US"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Company Name</span>
                  <span className="text-xs font-bold text-foreground block mt-1">{snapshot.company.name}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Exchange / Country</span>
                  <span className="text-xs font-bold text-foreground block mt-1">
                    {snapshot.company.exchange || "N/A"} ({snapshot.company.country || "N/A"})
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Sector / Industry</span>
                  <span className="text-xs font-bold text-foreground block mt-1 truncate">
                    {snapshot.company.sector || "N/A"} / {snapshot.company.industry || "N/A"}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Reporting Currency</span>
                  <span className="text-xs font-mono font-bold text-foreground block mt-1">
                    {snapshot.company.currency || "USD"}
                  </span>
                </div>
              </div>

              {snapshot.company.description && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold mb-1">Company Description</span>
                  <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                    {snapshot.company.description}
                  </p>
                </div>
              )}
            </div>

            {/* Price Quote & Session Analytics */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">2. Current Stock Price</h3>
                  <p className="text-2xs text-foreground-secondary">Live/latest market price quote and session analytics</p>
                </div>
                <span className="text-2xs text-foreground-secondary font-mono bg-slate-50 px-2.5 py-0.5 rounded border border-border">
                  Source: {snapshot.provenance?.market || "Provider Quotes"}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-3xl font-black text-foreground font-mono">
                    {formatCurrency(snapshot.market.price, currency)}
                  </span>
                  {snapshot.market.changePercent !== null && (
                    <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg border ${
                      snapshot.market.changePercent >= 0 
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                    }`}>
                      {snapshot.market.changePercent >= 0 ? "+" : ""}
                      {snapshot.market.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 flex-1 w-full">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Prev Close</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatCurrency(snapshot.market.previousClose, currency)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Session High</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatCurrency(snapshot.market.high, currency)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Session Low</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatCurrency(snapshot.market.low, currency)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Volume</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {formatLargeNumber(snapshot.market.volume)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">P/E Ratio</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {snapshot.market.pe !== null ? snapshot.market.pe.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">P/B Ratio</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {snapshot.market.pb !== null ? snapshot.market.pb.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">EPS</span>
                    <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                      {snapshot.market.eps !== null ? snapshot.market.eps.toFixed(2) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cross provider comparison alert */}
              {snapshot.validation && snapshot.validation.status !== "unchecked" && (
                <div className="bg-slate-50 border border-border/80 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold mb-0.5">Cross-Provider Quote Verification Alert</span>
                    <p className="text-xs text-foreground-secondary font-medium leading-relaxed">
                      Primary provider <span className="font-bold text-foreground">{snapshot.validation.primarySource}</span> was compared against secondary reference <span className="font-bold text-foreground">{snapshot.validation.comparedSource}</span>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {snapshot.validation.deviationPercent !== null && (
                      <span className="text-2xs text-foreground-secondary font-mono bg-white px-2 py-0.5 rounded border border-border">
                        Deviation: {snapshot.validation.deviationPercent.toFixed(4)}%
                      </span>
                    )}
                    <span className={`text-8xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                      snapshot.validation.status === "consistent"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 border-amber-500/20"
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
          <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">3. Price History (Last 2–3 Years)</h3>
                <p className="text-2xs text-foreground-secondary">Factual daily historical closing prices and compound returns over the length</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.priceHistory.status)}`}>
                {snapshot.categoryAssessments.priceHistory.status}
              </span>
            </div>

            {points.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
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

                  const strokeColor = totalReturn >= 0 ? "#10b981" : "#f43f5e";
                  const fillGradient = totalReturn >= 0 ? "url(#emeraldGradient)" : "url(#roseGradient)";

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
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Start Price ({points[0].date})</span>
                          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(startPrice, currency)}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">End Price ({points[points.length - 1].date})</span>
                          <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(endPrice, currency)}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">Period Return</span>
                          <span className={`text-sm font-black font-mono ${totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <span className="text-8xs text-foreground-muted uppercase tracking-wider block font-bold">High / Low Peaks</span>
                          <span className="text-xs font-bold text-foreground font-mono">
                            {formatCurrency(minPrice, currency)} - {formatCurrency(maxPrice, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Line Chart */}
                      <div className="relative border border-border/80 rounded-xl bg-slate-50 p-4 overflow-hidden">
                        <svg viewBox="0 0 1000 240" className="w-full h-56 overflow-visible" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15"/>
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                            </linearGradient>
                            <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15"/>
                              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0"/>
                            </linearGradient>
                          </defs>
                          
                          {/* Grid Lines */}
                          <line x1="0" y1="60" x2="1000" y2="60" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                          <line x1="0" y1="120" x2="1000" y2="120" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                          <line x1="0" y1="180" x2="1000" y2="180" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />

                          {/* Fill */}
                          <path d={areaPath} fill={fillGradient} />

                          {/* Path line */}
                          <path d={chartPath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>

                        {/* Labels */}
                        <div className="flex justify-between text-8xs text-foreground-secondary font-mono mt-2 uppercase">
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
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">4. Financial Capacity & Strength</h3>
                  <p className="text-2xs text-foreground-secondary">Annual balance sheet strength, leverage capacities, and equity returns</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.financialCapacity.status)}`}>
                  {snapshot.categoryAssessments.financialCapacity.status}
                </span>
              </div>

              {snapshot.financials.length === 0 ? (
                <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                  No fundamental financial statements resolved.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-border text-foreground-secondary font-bold">
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
                      <tbody className="divide-y divide-border">
                        {snapshot.financials.map((f: any) => {
                          const equity = (f.totalAssets !== null && f.totalLiabilities !== null) ? (f.totalAssets - f.totalLiabilities) : null;
                          return (
                            <tr key={f.year} className="hover:bg-slate-50/50 text-foreground-secondary font-mono font-medium">
                              <td className="p-3 font-sans font-bold text-foreground">{f.year}</td>
                              <td className="p-3">{formatLargeNumber(f.revenue, true, currency)}</td>
                              <td className={`p-3 font-bold ${f.netIncome >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
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
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">5. Cash Flow Analysis</h3>
                  <p className="text-2xs text-foreground-secondary">Operational liquidity generation and calculated free cash flow values</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.cashFlow.status)}`}>
                  {snapshot.categoryAssessments.cashFlow.status}
                </span>
              </div>

              {snapshot.financials.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-border rounded-xl">
                  No cash flow statements resolved.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-border text-foreground-secondary font-bold">
                          <th className="p-3">Year</th>
                          <th className="p-3">Operating Cash Flow</th>
                          <th className="p-3">Capex (Calculated)</th>
                          <th className="p-3">Free Cash Flow</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {snapshot.financials.map((f: any) => {
                          const capex = (f.operatingCashFlow !== null && f.freeCashFlow !== null) ? (f.operatingCashFlow - f.freeCashFlow) : null;
                          return (
                            <tr key={f.year} className="hover:bg-slate-50/50 text-foreground-secondary font-mono font-medium">
                              <td className="p-3 font-sans font-bold text-foreground">{f.year}</td>
                              <td className={`p-3 ${f.operatingCashFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {formatLargeNumber(f.operatingCashFlow, true, currency)}
                              </td>
                              <td className="p-3">{formatLargeNumber(capex, true, currency)}</td>
                              <td className={`p-3 font-bold ${f.freeCashFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
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
          <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">6. Market News & Mentions</h3>
                <p className="text-2xs text-foreground-secondary">Recent aggregated news headlines, articles, and references</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-8xs border font-extrabold uppercase ${getCategoryStatusClass(snapshot.categoryAssessments.news.status)}`}>
                Sentiment: {snapshot.categoryAssessments.news.status}
              </span>
            </div>

            {snapshot.news.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                No recent news headlines fetched.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {snapshot.news.slice(0, 6).map((item: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="border border-border/80 rounded-xl p-4 bg-slate-50 hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-8xs text-foreground-muted font-mono uppercase font-bold">
                          <span>{item.source || "Unknown Source"}</span>
                          <span>{item.date ? new Date(item.date).toLocaleDateString() : "Recent"}</span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">{item.title}</h4>
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
                          className="text-2xs font-bold text-primary hover:underline self-start flex items-center gap-1"
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
          <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-6 animate-fadeIn">
            {analysisRunResult.status === "unavailable" || !analysisRunResult.analysis ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">7. Evidence Synthesis & Balance</h3>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Qualitative AI synthesis evidence is currently unavailable
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg border text-8xs font-mono font-bold uppercase bg-rose-500/10 text-rose-600 border-rose-500/20">
                    UNAVAILABLE
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">AI Analysis Synthesis Failed</h4>
                    <p className="text-xs text-foreground-secondary max-w-md mx-auto leading-relaxed font-medium">
                      Groq API requests failed or returned schema discrepancies. Deterministic fallbacks are deactivated to protect financial integrity.
                    </p>
                  </div>
                </div>

                {/* Attempt breakdown logs */}
                <div className="border-t border-border pt-4 space-y-3">
                  <span className="text-8xs font-bold text-foreground-muted uppercase tracking-wider block">AI Orchestrator Execution Log</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisRunResult.attempts?.map((attempt: any, idx: number) => (
                      <div key={idx} className="border border-slate-100 rounded-xl p-3 bg-slate-50 text-xs space-y-1.5 font-medium">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-foreground uppercase">{attempt.provider}</span>
                          <span className={`px-1.5 py-0.5 rounded text-8xs border font-black uppercase ${
                            attempt.status === "success" 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }`}>{attempt.status}</span>
                        </div>
                        <div className="text-8xs text-foreground-secondary font-mono">Model: {attempt.model} ({attempt.durationMs}ms)</div>
                        {attempt.message && <div className="text-8xs text-rose-500 font-mono mt-1 break-all line-clamp-2">{attempt.message}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">7. Evidence Synthesis & Balance</h3>
                    <p className="text-2xs text-foreground-secondary mt-0.5">
                      Qualitative evidence details compiled by specialist model: <span className="font-bold text-foreground uppercase">Groq{analysisRunResult.model ? ` (${analysisRunResult.model})` : ""}</span>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg border text-8xs font-mono font-bold uppercase bg-orange-500/10 text-orange-600 border-orange-500/20">
                    Groq Live Synthesis
                  </span>
                </div>

                {/* Strengths & Concerns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-emerald-500/10 rounded-xl p-4 bg-emerald-500/5 space-y-2">
                    <span className="font-extrabold text-xs text-emerald-800 uppercase block tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Key Strengths
                    </span>
                    <ul className="text-xs text-emerald-950 list-disc list-inside space-y-1.5">
                      {analysisRunResult.analysis.strengths?.slice(0, 4).map((s: string, idx: number) => (
                        <li key={idx} className="leading-snug text-2xs font-medium">{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-rose-500/10 rounded-xl p-4 bg-rose-500/5 space-y-2">
                    <span className="font-extrabold text-xs text-rose-800 uppercase block tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                      Key Concerns
                    </span>
                    <ul className="text-xs text-rose-950 list-disc list-inside space-y-1.5">
                      {analysisRunResult.analysis.concerns?.slice(0, 4).map((c: string, idx: number) => (
                        <li key={idx} className="leading-snug text-2xs font-medium">{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Cited Evidence Tags (Interlinks down to diagnostics) */}
                <div className="border-t border-slate-100 pt-4 space-y-2.5">
                  <span className="text-8xs font-black text-foreground-muted uppercase tracking-wider block">Cited Evidence Index</span>
                  <div className="flex flex-wrap gap-2">
                    {analysisRunResult.analysis.citedEvidenceIds?.map((id: string) => {
                      const item = evidenceBundle?.evidenceIndex?.[id];
                      return (
                        <button
                          key={id}
                          onClick={() => handleCitationClick(id)}
                          className="px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-border font-mono text-8xs text-foreground flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                        >
                          <span className="font-extrabold text-primary">{id}</span>
                          <span className="text-foreground-secondary border-l border-slate-200 pl-1.5">
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
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-foreground">Advanced Developer Simulation</h3>
              <p className="text-2xs text-foreground-secondary">Override LLM query responses or simulate network/auth rate limits on live fetches</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-8xs font-bold text-foreground-muted uppercase tracking-wider">Simulate Groq Failures</label>
                  <select
                    value={simulateGroq}
                    onChange={(e) => handleSimulationChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-border rounded-lg focus:outline-none"
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
                    className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Re-run with Simulation Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Provider endpoints logs */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">Diagnostics Endpoint Logs</h3>
                  <p className="text-2xs text-foreground-secondary">Detailed execution status and latency metrics for each registry call</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveProviderFilter(null)}
                    className={`px-2.5 py-1 text-8xs font-bold rounded-md ${
                      !activeProviderFilter ? "bg-slate-900 text-white" : "bg-slate-50 text-foreground-secondary border border-border"
                    }`}
                  >
                    All
                  </button>
                  {Array.from(new Set(allEndpoints.map((e: any) => e.provider))).map((providerName: any) => (
                    <button
                      key={providerName}
                      onClick={() => setActiveProviderFilter(providerName)}
                      className={`px-2.5 py-1 text-8xs font-bold rounded-md uppercase ${
                        activeProviderFilter === providerName ? "bg-slate-900 text-white" : "bg-slate-50 text-foreground-secondary border border-border"
                      }`}
                    >
                      {providerName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {allEndpoints
                  .filter((e: any) => !activeProviderFilter || e.provider === activeProviderFilter)
                  .map((e: any) => {
                    const key = `${e.provider}-${e.endpointName}`;
                    const isExpanded = expandedEndpoints[key] || false;
                    return (
                      <div key={key} className="bg-white" id={key}>
                        <button
                          onClick={() => toggleEndpoint(key)}
                          className="w-full px-4 py-3 hover:bg-slate-50 flex justify-between items-center text-xs transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold uppercase text-foreground shrink-0">{e.provider}</span>
                            <span className="text-foreground-secondary font-mono">{e.endpointName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-8xs text-foreground-muted font-mono">{e.durationMs}ms</span>
                            <span className={`px-1.5 py-0.5 rounded text-8xs font-black uppercase border ${getStatusBadgeClass(e.status)}`}>
                              {e.status}
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="bg-slate-900 border-t border-slate-800 p-4 font-mono text-8xs text-slate-300 overflow-x-auto max-h-96">
                            <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800">
                              <span>Raw HTTP Response Contract</span>
                              <span className="text-slate-500">Status code: {e.httpStatus || "N/A"}</span>
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
            <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-foreground">Factual Evidence Index</h3>
              <p className="text-2xs text-foreground-secondary">Trace citations directly back to parsed evidence bundles</p>
              
              <div className="space-y-3">
                {Object.keys(evidenceBundle.evidenceIndex || {}).map((id) => {
                  const ev = evidenceBundle.evidenceIndex[id];
                  return (
                    <div 
                      key={id}
                      ref={(el) => { evidenceRefs.current[id] = el; }}
                      className="p-4 border border-border hover:border-slate-300 rounded-xl bg-slate-50 transition-all flex flex-col sm:flex-row justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-primary bg-slate-200/60 px-2 py-0.5 rounded">
                            {id}
                          </span>
                          <span className="text-8xs font-bold text-foreground-secondary uppercase tracking-wider">
                            {ev.provider} ({ev.endpoint})
                          </span>
                        </div>
                        <div className="text-xs text-foreground leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-48 pt-1.5">
                          {typeof ev.data === "object" ? JSON.stringify(ev.data, null, 2) : String(ev.data)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
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
