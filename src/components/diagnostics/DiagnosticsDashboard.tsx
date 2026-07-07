"use client";

import React, { useState, useEffect, useRef } from "react";
import { CompanyIdentity, ProviderCandidates, getProviderCandidates } from "@/src/lib/company/symbolCandidates";
import { EndpointResult, ProviderSummary, ProviderEndpointStatus } from "@/src/lib/providers/shared/types";
import { ProviderHealthStatus } from "@/src/lib/providers/healthCheck";

interface SearchResult {
  name: string;
  ticker: string;
  canonicalTicker: string;
  exchange: string;
  country: string;
  aliases: string[];
}

export default function DiagnosticsDashboard() {
  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected company state
  const [selectedCompany, setSelectedCompany] = useState<CompanyIdentity | null>(null);
  const [candidates, setCandidates] = useState<ProviderCandidates | null>(null);

  // Pipeline execution state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [pipelineResult, setPipelineResult] = useState<any | null>(null);
  const [activeProviderFilter, setActiveProviderFilter] = useState<string | null>(null);
  
  // Collapse control
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});
  const [showFullJson, setShowFullJson] = useState(false);
  const [showEvidenceBundleJson, setShowEvidenceBundleJson] = useState(false);

  // Health check state (Global Auth Health)
  const [healthStatus, setHealthStatus] = useState<ProviderHealthStatus[]>([]);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Fallback Simulation state
  const [simulateGemini, setSimulateGemini] = useState<string>("");
  const [simulateGroq, setSimulateGroq] = useState<string>("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchHealth = async (force = false) => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch(`/api/providers/health${force ? "?force=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.details)) {
          setHealthStatus(data.details);
        }
      }
    } catch (err) {
      console.error("Failed to fetch provider health:", err);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Fetch provider health on mount
  useEffect(() => {
    fetchHealth(false);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const abortController = new AbortController();
    setIsSearching(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      abortController.abort();
      clearTimeout(delayDebounce);
    };
  }, [query]);

  // Select a company from list
  const handleSelectCompany = (item: SearchResult) => {
    const identity: CompanyIdentity = {
      name: item.name,
      displayTicker: item.ticker,
      canonicalTicker: item.canonicalTicker || item.ticker,
      exchange: item.exchange || null,
      country: item.country || null,
      currency: item.country === "India" ? "INR" : "USD",
      isin: null,
    };
    setSelectedCompany(identity);
    setCandidates(getProviderCandidates(identity));
    setQuery(`${item.name} (${item.ticker})`);
    setShowDropdown(false);
    setPipelineResult(null); // Clear previous results
  };

  // Run the full parallel diagnostics pipeline and LLM analysis
  const runDiagnostics = async () => {
    if (!selectedCompany) return;

    setLoading(true);
    setPipelineResult(null);
    
    // Step 1: candidates validation
    setLoadingStep("1. Validating symbol candidates sequentially across FMP, Finnhub, Twelve Data, EODHD, Alpha Vantage...");
    
    try {
      await new Promise((r) => setTimeout(r, 600));
      setLoadingStep("2. Initiating parallel fetches for resolved tickers across 7 API providers...");
      
      await new Promise((r) => setTimeout(r, 600));
      setLoadingStep("3. Fetching raw metrics, financial statements, time series, news and Tavily research...");

      await new Promise((r) => setTimeout(r, 400));
      setLoadingStep("4. Compiling factual evidence bundle and redacting sensitive parameters...");

      await new Promise((r) => setTimeout(r, 400));
      setLoadingStep("5. Running LLM analysis fallback chain (Gemini -> Groq -> Deterministic)...");

      const bodyPayload: any = { company: selectedCompany };
      if (simulateGemini || simulateGroq) {
        bodyPayload.simulate = {};
        if (simulateGemini) bodyPayload.simulate.gemini = simulateGemini;
        if (simulateGroq) bodyPayload.simulate.groq = simulateGroq;
      }

      const res = await fetch("/api/research/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setPipelineResult(data);
        // Refresh health checking status after a run to update caches
        fetchHealth(false);
      } else {
        const errText = await res.text();
        alert(`Diagnostics failed: ${errText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Diagnostics pipeline error: ${err.message || err}`);
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Status Badge styling helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "working":
      case "success":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "partial":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "empty":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "rate_limit":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse";
      case "auth_error":
        return "bg-red-500/10 text-red-600 border-red-500/20 font-bold";
      case "plan_limited":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20 font-medium";
      case "unsupported":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "timeout":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "network_error":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      case "not_called":
        return "bg-gray-100 text-gray-400 border-gray-200";
      default:
        return "bg-red-500/10 text-red-600 border-red-500/20";
    }
  };

  // Verdict style helpers
  const getVerdictStyle = (v: string) => {
    switch (v) {
      case "INVEST":
        return "bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-500/25";
      case "WATCH":
        return "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/25";
      case "PASS":
        return "bg-slate-600 text-white border-slate-700 shadow-sm shadow-slate-500/25";
      default:
        return "bg-gray-600 text-white border-gray-700";
    }
  };

  const getVerdictBadgeBorder = (v: string) => {
    switch (v) {
      case "INVEST":
        return "border-emerald-500/20 bg-emerald-50 text-emerald-700";
      case "WATCH":
        return "border-amber-500/20 bg-amber-50 text-amber-700";
      case "PASS":
        return "border-slate-500/20 bg-slate-50 text-slate-700";
      default:
        return "border-gray-500/20 bg-gray-50 text-gray-700";
    }
  };

  const filteredEndpoints = pipelineResult
    ? pipelineResult.allEndpoints.filter(
        (e: EndpointResult) => !activeProviderFilter || e.provider === activeProviderFilter
      )
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <span className="p-2 bg-primary text-white rounded-lg text-sm font-mono">L9</span>
            Ledger Nine Diagnostics Dashboard
          </h1>
          <p className="text-sm text-foreground-secondary leading-relaxed mt-1">
            Transparent multi-provider company search, real-time diagnostic audits, and investment verdict synthesis.
          </p>
        </div>
        <div className="pt-4 md:pt-0">
          <button
            onClick={() => fetchHealth(true)}
            disabled={isCheckingHealth}
            className="px-4 py-2 border border-border bg-white text-xs font-semibold rounded-lg hover:bg-surface-hover flex items-center gap-2 transition-all shadow-2xs"
          >
            {isCheckingHealth ? (
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : null}
            Refresh Auth Health Probes
          </button>
        </div>
      </div>

      {/* Main Grid: Search & Live Auth Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Panel (left 2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-foreground">1. Select Company & Run Audit</h2>
          
          <div className="relative" ref={dropdownRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query.trim() && setShowDropdown(true)}
                  placeholder="Type company name or ticker (e.g. AAPL, Reliance, TCS...)"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {selectedCompany && (
                <button
                  onClick={runDiagnostics}
                  disabled={loading}
                  className="px-6 py-3 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-semibold rounded-xl text-sm transition-all shadow-xs"
                >
                  {loading ? "Researching..." : "Start Research Run"}
                </button>
              )}
            </div>

            {/* Dropdown suggestions */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-border rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto divide-y divide-border">
                {searchResults.map((item) => (
                  <button
                    key={item.canonicalTicker}
                    onClick={() => handleSelectCompany(item)}
                    className="w-full px-4 py-3 hover:bg-surface-hover text-left flex justify-between items-center text-sm transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <span className="ml-2 text-xs text-foreground-muted">({item.country})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-foreground-secondary bg-background px-2 py-0.5 rounded border border-border text-xs">
                        {item.ticker}
                      </span>
                      <span className="ml-2 text-xs text-foreground-muted">{item.exchange}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Suggestions shortcut chips */}
          <div className="pt-2">
            <span className="text-2xs font-bold text-foreground-muted uppercase tracking-wider block mb-2">
              Curated Catalog Suggestions:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "Apple", ticker: "AAPL", canonicalTicker: "AAPL", exchange: "NASDAQ", country: "US", aliases: [] },
                { name: "Reliance Industries", ticker: "RELIANCE", canonicalTicker: "RELIANCE.NS", exchange: "NSE", country: "India", aliases: [] },
                { name: "TCS", ticker: "TCS", canonicalTicker: "TCS.NS", exchange: "NSE", country: "India", aliases: [] },
                { name: "Tesla", ticker: "TSLA", canonicalTicker: "TSLA", exchange: "NASDAQ", country: "US", aliases: [] },
                { name: "Tata Steel", ticker: "TATASTEEL", canonicalTicker: "TATASTEEL.NS", exchange: "NSE", country: "India", aliases: [] },
              ].map((s) => (
                <button
                  key={s.canonicalTicker}
                  onClick={() => handleSelectCompany(s)}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-surface-hover border border-border hover:border-foreground-muted/50 text-xs font-medium text-foreground transition-all"
                >
                  <span className="font-bold mr-1">{s.ticker}</span>
                  <span className="text-foreground-muted font-normal font-sans">({s.name})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fallback Simulation Settings Panel */}
          <div className="pt-3 border-t border-border/80">
            <span className="text-2xs font-bold text-foreground-secondary uppercase tracking-wider block mb-2">
              Developer LLM Fallback Simulation:
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-5xs font-bold text-foreground-muted uppercase">Simulate Gemini Status</label>
                <select
                  value={simulateGemini}
                  onChange={(e) => setSimulateGemini(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 bg-background border border-border rounded-lg focus:outline-none"
                >
                  <option value="">Normal (Live API calls)</option>
                  <option value="rate_limit">Rate Limit (429)</option>
                  <option value="auth_error">Auth Error (Invalid API Key)</option>
                  <option value="timeout">Timeout</option>
                  <option value="schema_failure">Schema Validation Failure</option>
                  <option value="provider_error">General Provider Error</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-5xs font-bold text-foreground-muted uppercase">Simulate Groq Status</label>
                <select
                  value={simulateGroq}
                  onChange={(e) => setSimulateGroq(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 bg-background border border-border rounded-lg focus:outline-none"
                >
                  <option value="">Normal (Live API calls)</option>
                  <option value="rate_limit">Rate Limit (429)</option>
                  <option value="auth_error">Auth Error (Invalid API Key)</option>
                  <option value="timeout">Timeout</option>
                  <option value="schema_failure">Schema Validation Failure</option>
                  <option value="provider_error">General Provider Error</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Global Auth Health Grid (right 1 col) */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 block"></span>
              AUTH HEALTH
            </h2>
            <p className="text-5xs text-foreground-muted uppercase tracking-wider mt-1">
              Global API Credential Probes
            </p>
          </div>
          <div className="mt-4 flex-1">
            {healthStatus.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {healthStatus.map((h) => (
                  <div key={h.provider} className="border border-border/80 rounded-lg p-2 space-y-1.5 bg-background shadow-3xs flex flex-col justify-between min-h-16">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-foreground text-5xs">{h.provider}</span>
                      <span className={`px-1 rounded text-6xs font-extrabold uppercase border ${getStatusBadgeClass(h.status)}`}>
                        {h.status === "working" ? "OK" : h.status === "auth_error" ? "AUTH" : h.status}
                      </span>
                    </div>
                    <div className="text-6xs text-foreground-muted leading-tight truncate">
                      {h.message}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                Loading Auth Health Probes...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Progress State */}
      {loading && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4 animate-pulse">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Executing Diagnostics & Synthesis Pipeline...
          </h2>
          <div className="space-y-2 text-sm text-foreground-secondary">
            <div className="p-3 bg-background rounded-lg font-mono text-xs border border-border">
              {loadingStep}
            </div>
            <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full animate-pulse w-2/3" />
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Diagnostic Results Output */}
      {pipelineResult && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Top Panel: Investment Verdict & Calculated Signals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Investment Verdict (2/3 width) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-6 shadow-sm space-y-6 flex flex-col justify-between">
              
              {/* Verdict Header */}
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-black text-foreground">INVESTMENT ASSESSMENT</h2>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    Qualitative synthesis compiled by specialist model: <span className="font-bold text-foreground uppercase">{pipelineResult.analysisRunResult.activeProvider}</span>
                  </p>
                </div>
                
                {/* Active model badge */}
                <div className={`px-2.5 py-1 rounded-lg border text-4xs font-mono font-bold uppercase ${
                  pipelineResult.analysisRunResult.activeProvider === "gemini"
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : pipelineResult.analysisRunResult.activeProvider === "groq"
                    ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                    : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                }`}>
                  {pipelineResult.analysisRunResult.activeProvider}
                </div>
              </div>

              {/* Main Verdict Row */}
              <div className="flex flex-col sm:flex-row gap-6 items-center py-2">
                {/* Large Verdict Badge */}
                <div className="text-center space-y-2">
                  <div className={`w-36 py-4 rounded-2xl text-center border font-black text-xl flex flex-col justify-center items-center gap-1 ${getVerdictStyle(pipelineResult.analysisRunResult.analysis.verdict)}`}>
                    <span className="tracking-wider">{pipelineResult.analysisRunResult.analysis.verdict}</span>
                    <span className="text-5xs opacity-85 font-normal tracking-normal font-sans">
                      {pipelineResult.analysisRunResult.analysis.verdict === "INVEST" && "Attractive Setup"}
                      {pipelineResult.analysisRunResult.analysis.verdict === "WATCH" && "Monitor Setup"}
                      {pipelineResult.analysisRunResult.analysis.verdict === "PASS" && "Avoid Setup"}
                    </span>
                  </div>
                  <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">Model Synthesis Verdict</span>
                </div>

                {/* Speedometer Score representation */}
                <div className="text-center space-y-2">
                  <div className="w-32 h-20 bg-background border border-border rounded-2xl flex flex-col justify-center items-center">
                    <span className="text-2xl font-black text-foreground font-mono">{pipelineResult.analysisRunResult.analysis.finalScore}</span>
                    <span className="text-5xs text-foreground-muted uppercase tracking-wider font-bold">out of 100</span>
                  </div>
                  <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">Synthesized Score</span>
                </div>

                {/* Qualitative Overall Thesis */}
                <div className="flex-1 bg-background p-4 rounded-xl border border-border/80 space-y-1">
                  <span className="text-6xs font-black text-foreground-muted uppercase tracking-wider block">Synthesized Investment Thesis:</span>
                  <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                    {pipelineResult.analysisRunResult.analysis.overallSummary || pipelineResult.analysisRunResult.analysis.companySummary}
                  </p>
                </div>
              </div>

              {/* Strengths & Concerns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
                <div className="border border-emerald-500/10 rounded-xl p-4 bg-emerald-500/5 space-y-2">
                  <span className="font-extrabold text-xs text-emerald-800 uppercase block tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Key Strengths
                  </span>
                  <ul className="text-xs text-emerald-950 list-disc list-inside space-y-1.5">
                    {pipelineResult.analysisRunResult.analysis.strengths.slice(0, 4).map((s: string, idx: number) => (
                      <li key={idx} className="leading-snug text-4xs font-medium">{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="border border-rose-500/10 rounded-xl p-4 bg-rose-500/5 space-y-2">
                  <span className="font-extrabold text-xs text-rose-800 uppercase block tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    Key Concerns
                  </span>
                  <ul className="text-xs text-rose-950 list-disc list-inside space-y-1.5">
                    {pipelineResult.analysisRunResult.analysis.concerns.slice(0, 4).map((c: string, idx: number) => (
                      <li key={idx} className="leading-snug text-4xs font-medium">{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Resolved Specialist models details */}
              <div className="grid grid-cols-2 gap-2 text-6xs text-foreground-muted border-t border-border pt-4">
                <div>
                  Gemini status: <span className="font-bold">{pipelineResult.analysisRunResult.gemini.status}</span> ({pipelineResult.analysisRunResult.gemini.durationMs}ms)
                </div>
                <div className="text-right">
                  Groq status: <span className="font-bold">{pipelineResult.analysisRunResult.groq.status}</span> ({pipelineResult.analysisRunResult.groq.durationMs}ms)
                </div>
              </div>

            </div>

            {/* Calculated Mathematical Signals (1/3 width) */}
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between space-y-5">
              <div>
                <h2 className="text-base font-bold text-foreground">MATHEMATICAL SIGNALS</h2>
                <p className="text-5xs text-foreground-muted uppercase tracking-wider mt-0.5">
                  Local Deterministic Engine Ratings
                </p>
              </div>

              {/* Signals Progress Bars */}
              {pipelineResult.signals && (
                <div className="space-y-3.5 flex-1">
                  
                  {/* Signal 1: Price Momentum */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground-secondary">Price Momentum</span>
                      <span className="font-bold text-foreground font-mono">{pipelineResult.signals.priceMomentum}%</span>
                    </div>
                    <div className="w-full bg-background border border-border/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pipelineResult.signals.priceMomentum}%` }} />
                    </div>
                  </div>

                  {/* Signal 2: Valuation */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground-secondary">Valuation</span>
                      <span className="font-bold text-foreground font-mono">{pipelineResult.signals.valuation}%</span>
                    </div>
                    <div className="w-full bg-background border border-border/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pipelineResult.signals.valuation}%` }} />
                    </div>
                  </div>

                  {/* Signal 3: Financial Quality */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground-secondary">Financial Quality</span>
                      <span className="font-bold text-foreground font-mono">{pipelineResult.signals.financialQuality}%</span>
                    </div>
                    <div className="w-full bg-background border border-border/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pipelineResult.signals.financialQuality}%` }} />
                    </div>
                  </div>

                  {/* Signal 4: News Context */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground-secondary">News Sentiment</span>
                      <span className="font-bold text-foreground font-mono">{pipelineResult.signals.newsContext}%</span>
                    </div>
                    <div className="w-full bg-background border border-border/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pipelineResult.signals.newsContext}%` }} />
                    </div>
                  </div>

                  {/* Signal 5: Data Confidence */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground-secondary">Data Confidence</span>
                      <span className="font-bold text-foreground font-mono">{pipelineResult.signals.dataConfidence}%</span>
                    </div>
                    <div className="w-full bg-background border border-border/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pipelineResult.signals.dataConfidence}%` }} />
                    </div>
                  </div>

                </div>
              )}

              {/* Deterministic comparison box */}
              {pipelineResult.signals && (
                <div className="border border-border/80 bg-background rounded-xl p-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-foreground block text-4xs uppercase tracking-wider">Deterministic Verdict</span>
                    <span className="text-foreground-secondary font-medium">Score: <span className="font-bold font-mono text-foreground">{pipelineResult.signals.finalDeterministicScore}</span></span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-5xs border font-extrabold uppercase ${getVerdictBadgeBorder(pipelineResult.signals.deterministicVerdict)}`}>
                    {pipelineResult.signals.deterministicVerdict}
                  </span>
                </div>
              )}

            </div>
          </div>

          {/* COMPANY CAPABILITY Grid Panel */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span>
                COMPANY CAPABILITY
              </h2>
              <p className="text-5xs text-foreground-muted uppercase tracking-wider mt-0.5">
                Provider retrieval and resolution status for {pipelineResult.evidenceBundle?.company?.name || "selected company"}
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              {pipelineResult.providers.map((p: ProviderSummary) => {
                const total = p.endpoints.length;
                const success = p.endpoints.filter((e) => e.ok).length;
                const isFiltered = activeProviderFilter === p.provider;
                
                return (
                  <button
                    key={p.provider}
                    onClick={() => setActiveProviderFilter(isFiltered ? null : p.provider)}
                    className={`text-left bg-background rounded-xl border p-3.5 flex flex-col justify-between min-h-24 hover:shadow-3xs transition-all group ${
                      isFiltered ? "border-primary ring-2 ring-primary/10" : "border-border/80"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-extrabold text-foreground text-xs group-hover:text-primary block truncate">
                        {p.provider}
                      </span>
                    </div>

                    <div className="text-6xs text-foreground-secondary space-y-1 mt-2">
                      <span className={`px-1 py-0.5 rounded text-7xs font-extrabold uppercase border block text-center w-full ${getStatusBadgeClass(p.status)}`}>
                        {p.status}
                      </span>
                      <div className="flex justify-between mt-1 text-7xs">
                        <span>Resolved:</span>
                        <span className="font-mono font-bold truncate max-w-[50px]">{p.symbolUsed || "None"}</span>
                      </div>
                      <div className="flex justify-between text-7xs">
                        <span>Endpoints:</span>
                        <span className="font-bold text-foreground">{success}/{total}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-6xs text-foreground-muted italic">
              * Click on any provider box above to filter the detailed endpoint diagnostics below.
            </div>
          </div>

          {/* Section: Factual Interpretation details */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-foreground border-b border-border pb-4">Detailed Model Interpretations</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">Financial Trend Interpretation</span>
                <div className="text-xs text-foreground-secondary leading-relaxed bg-background p-4 rounded-xl border border-border min-h-24">
                  {pipelineResult.analysisRunResult.analysis.financialInterpretation}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">Market Data Interpretation</span>
                <div className="text-xs text-foreground-secondary leading-relaxed bg-background p-4 rounded-xl border border-border min-h-24">
                  {pipelineResult.analysisRunResult.analysis.marketInterpretation}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">News & Sentiment Synthesis</span>
                <div className="text-xs text-foreground-secondary leading-relaxed bg-background p-4 rounded-xl border border-border min-h-24">
                  {pipelineResult.analysisRunResult.analysis.newsInterpretation}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">Web Research Insights</span>
                <div className="text-xs text-foreground-secondary leading-relaxed bg-background p-4 rounded-xl border border-border min-h-24">
                  {pipelineResult.analysisRunResult.analysis.webResearchInterpretation}
                </div>
              </div>
            </div>

            {/* Cited Evidence index references */}
            <div className="border-t border-border pt-4 space-y-2">
              <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider block">Cited Evidence Sources</span>
              <div className="flex flex-wrap gap-2">
                {pipelineResult.analysisRunResult.analysis.citedEvidenceIds.map((id: string) => {
                  const item = pipelineResult.evidenceBundle?.evidenceIndex?.[id];
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (item) {
                          const key = `${item.provider}-${item.endpoint}`;
                          // Open endpoint details accordion
                          setExpandedEndpoints(prev => ({ ...prev, [key]: true }));
                          const elem = document.getElementById(key);
                          if (elem) elem.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className="px-2 py-1 rounded bg-background hover:bg-surface-hover border border-border font-mono text-3xs text-foreground flex items-center gap-1.5 transition-all shadow-3xs"
                    >
                      <span className="font-extrabold text-primary">{id}</span>
                      <span className="text-foreground-muted border-l border-border/60 pl-1.5">
                        {item ? `${item.provider} (${item.endpoint})` : "Factual reference"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section: Live Endpoint Diagnostic Outputs */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
                Developer Live Endpoint Diagnostics
              </h3>
              {activeProviderFilter && (
                <button
                  onClick={() => setActiveProviderFilter(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Clear Filter ({activeProviderFilter})
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filteredEndpoints.map((e: EndpointResult) => {
                const key = `${e.provider}-${e.endpointName}`;
                const isExpanded = !!expandedEndpoints[key];
                
                return (
                  <div
                    key={key}
                    id={key}
                    className="bg-white rounded-xl border border-border overflow-hidden shadow-2xs hover:shadow-xs transition-shadow"
                  >
                    {/* Panel Header */}
                    <button
                      onClick={() => toggleEndpoint(key)}
                      className="w-full px-5 py-4 flex flex-col sm:flex-row justify-between sm:items-center text-left gap-2 hover:bg-surface-hover transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-foreground text-sm">{e.provider}</span>
                          <span className="text-xs text-foreground-muted bg-background px-1.5 py-0.5 rounded border border-border font-sans">
                            {e.endpointName}
                          </span>
                          {e.request.symbolUsed && (
                            <span className="font-mono text-2xs text-foreground bg-background px-1 py-0.5 rounded border border-border">
                              {e.request.symbolUsed}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-3xs text-foreground-muted truncate max-w-lg">
                          {e.request.method} {e.request.endpoint}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-medium self-end sm:self-auto">
                        <span className="text-foreground-secondary">{e.durationMs} ms</span>
                        <div className={`px-2 py-0.5 rounded text-2xs font-bold uppercase border ${getStatusBadgeClass(e.status)}`}>
                          {e.status}
                        </div>
                        <span className="text-foreground-muted">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Panel Body */}
                    {isExpanded && (
                      <div className="border-t border-border bg-background p-4 space-y-4">
                        {/* Error info if failed */}
                        {e.error && (
                          <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs space-y-1 font-sans">
                            <div className="font-bold uppercase tracking-wider text-3xs">
                              Error Code: {e.error.code || "UNKNOWN"}
                            </div>
                            <div>{e.error.message}</div>
                          </div>
                        )}

                        {/* Request metadata breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1 bg-white p-3 rounded-lg border border-border">
                            <span className="font-bold text-foreground block uppercase text-2xs tracking-wider text-3xs">
                              Diagnostics Request
                            </span>
                            <div className="font-mono text-4xs space-y-1">
                              <div><span className="text-foreground-secondary font-bold">Method:</span> {e.request.method}</div>
                              <div><span className="text-foreground-secondary font-bold">Endpoint URL:</span> {e.request.endpoint}</div>
                              <div><span className="text-foreground-secondary font-bold">Requested Symbol:</span> {e.request.symbolRequested || "None"}</div>
                              <div><span className="text-foreground-secondary font-bold">Confirmed Ticker:</span> {e.request.symbolUsed || "None"}</div>
                              <div><span className="text-foreground-secondary font-bold">Candidates Checked:</span> {e.request.candidatesTried.join(" → ") || "None"}</div>
                              {e.request.query && <div><span className="text-foreground-secondary font-bold">Query Parameter:</span> {e.request.query}</div>}
                            </div>
                          </div>
                          
                          <div className="space-y-1 bg-white p-3 rounded-lg border border-border">
                            <span className="font-bold text-foreground block uppercase text-2xs tracking-wider text-3xs">
                              Response Meta
                            </span>
                            <div className="font-mono text-4xs space-y-1">
                              <div><span className="text-foreground-secondary font-bold">HTTP Status Code:</span> {e.httpStatus ?? "N/A"}</div>
                              <div><span className="text-foreground-secondary font-bold">Response Date:</span> {e.completedAt}</div>
                              <div><span className="text-foreground-secondary font-bold">Record Count:</span> {e.response.recordCount ?? "N/A"}</div>
                              <div><span className="text-foreground-secondary font-bold">Duration Measured:</span> {e.durationMs} ms</div>
                            </div>
                          </div>
                        </div>

                        {/* Tab outputs: Normalized vs Raw json */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-foreground-secondary block">
                              Normalized Response Contract
                            </span>
                            <div className="bg-white border border-border rounded-lg p-3 max-h-60 overflow-auto font-mono text-3xs text-foreground-secondary scrollbar-thin">
                              {e.response.data ? (
                                <pre>{JSON.stringify(e.response.data, null, 2)}</pre>
                              ) : (
                                <span className="text-foreground-muted italic">No normalized data compiled (Endpoint status: {e.status})</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs font-bold text-foreground-secondary block">
                              Raw Redacted JSON Response
                            </span>
                            <div className="bg-white border border-border rounded-lg p-3 max-h-60 overflow-auto font-mono text-3xs text-foreground-secondary scrollbar-thin">
                              {e.response.raw ? (
                                <pre>{JSON.stringify(e.response.raw, null, 2)}</pre>
                              ) : (
                                <span className="text-foreground-muted italic">No raw payload returned</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Factual Evidence Bundle Inspector */}
          {pipelineResult.evidenceBundle && (
            <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
              <button
                onClick={() => setShowEvidenceBundleJson(!showEvidenceBundleJson)}
                className="w-full px-5 py-4 bg-surface hover:bg-surface-hover flex justify-between items-center text-left transition-colors"
              >
                <div className="space-y-1">
                  <span className="font-extrabold text-foreground text-sm">Factual Evidence Bundle Payload</span>
                  <p className="text-3xs text-foreground-muted">
                    Sanitized cross-provider evidence bundle passed directly to LLM context window.
                  </p>
                </div>
                <span className="text-xs text-foreground-secondary">{showEvidenceBundleJson ? "Hide Bundle" : "Inspect Bundle"}</span>
              </button>

              {showEvidenceBundleJson && (
                <div className="border-t border-border p-4 bg-background">
                  <div className="bg-white border border-border rounded-lg p-4 max-h-96 overflow-auto font-mono text-3xs text-foreground-secondary scrollbar-thin">
                    <pre>{JSON.stringify(pipelineResult.evidenceBundle, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: Full Combined JSON Inspector */}
          <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
            <button
              onClick={() => setShowFullJson(!showFullJson)}
              className="w-full px-5 py-4 bg-surface hover:bg-surface-hover flex justify-between items-center text-left transition-colors"
            >
              <div className="space-y-1">
                <span className="font-extrabold text-foreground text-sm">Full Diagnostics Run Output</span>
                <p className="text-3xs text-foreground-muted">
                  Entire JSON payload returned by the unified diagnostics POST handler.
                </p>
              </div>
              <span className="text-xs text-foreground-secondary">{showFullJson ? "Hide Full JSON" : "Inspect Full JSON"}</span>
            </button>

            {showFullJson && (
              <div className="border-t border-border p-4 bg-background">
                <div className="bg-white border border-border rounded-lg p-4 max-h-96 overflow-auto font-mono text-3xs text-foreground-secondary scrollbar-thin">
                  <pre>{JSON.stringify(pipelineResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
