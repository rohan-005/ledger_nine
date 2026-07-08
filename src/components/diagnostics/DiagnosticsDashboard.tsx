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
    setLoadingStep("1. Validating symbol candidates sequentially across FMP, Finnhub, Twelve Data, Yahoo Finance, Alpha Vantage...");
    
    try {
      await new Promise((r) => setTimeout(r, 600));
      setLoadingStep("2. Initiating parallel fetches for resolved tickers across 7 data providers...");
      
      await new Promise((r) => setTimeout(r, 600));
      setLoadingStep("3. Fetching raw metrics, financial statements, time series, news and Yahoo Finance chart...");

      await new Promise((r) => setTimeout(r, 400));
      setLoadingStep("4. Compiling factual evidence bundle and redacting sensitive parameters...");

      await new Promise((r) => setTimeout(r, 400));
      setLoadingStep("5. Running Groq AI qualitative analysis...");

      const bodyPayload: any = { company: selectedCompany };
      if (simulateGroq) {
        bodyPayload.simulate = {};
        bodyPayload.simulate.groq = simulateGroq;
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

  const getHistoricalPrices = () => {
    if (!pipelineResult?.evidenceBundle?.historicalPrices) return [];
    const historicalItem = pipelineResult.evidenceBundle.historicalPrices[0];
    if (!historicalItem || !Array.isArray(historicalItem.data)) return [];
    
    const rawList = historicalItem.data as any[];
    const points = rawList.map(d => {
      const dateStr = d.date || d.datetime || d.timestamp || "";
      const priceVal = parseFloat(d.close || d.price || d.open || 0);
      return { date: dateStr, price: priceVal };
    }).filter(p => p.price > 0 && p.date);

    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
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
      case "plan_limit":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20 font-medium";
      case "malformed_response":
        return "bg-red-500/10 text-red-600 border-red-500/20 font-medium";
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
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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

        {/* Global Auth Health Grid (right 1 col) */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-500 block"></span>
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
          
          {/* Step 1: Company Details */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">1. Company Details</h3>
                <p className="text-2xs text-foreground-muted">Profile and listing directory details from active registry providers</p>
              </div>
              <span className="text-xs text-foreground-muted font-mono bg-background px-2.5 py-0.5 rounded border border-border">
                {pipelineResult.snapshot.company.exchange || "US"}: {pipelineResult.snapshot.company.ticker}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-background border border-border/80 rounded-xl p-3">
                <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Company Name</span>
                <span className="text-xs font-bold text-foreground block mt-1">{pipelineResult.snapshot.company.name}</span>
              </div>
              <div className="bg-background border border-border/80 rounded-xl p-3">
                <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Exchange / Country</span>
                <span className="text-xs font-bold text-foreground block mt-1">
                  {pipelineResult.snapshot.company.exchange || "N/A"} ({pipelineResult.snapshot.company.country || "N/A"})
                </span>
              </div>
              <div className="bg-background border border-border/80 rounded-xl p-3">
                <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Sector / Industry</span>
                <span className="text-xs font-bold text-foreground block mt-1 truncate">
                  {pipelineResult.snapshot.company.sector || "N/A"} / {pipelineResult.snapshot.company.industry || "N/A"}
                </span>
              </div>
              <div className="bg-background border border-border/80 rounded-xl p-3">
                <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Reporting Currency</span>
                <span className="text-xs font-mono font-bold text-foreground block mt-1">
                  {pipelineResult.snapshot.company.currency || "USD"}
                </span>
              </div>
            </div>

            {pipelineResult.snapshot.company.description && (
              <div className="bg-background border border-border/80 rounded-xl p-4">
                <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold mb-1">Company Description</span>
                <p className="text-xs text-foreground-secondary leading-relaxed font-medium">
                  {pipelineResult.snapshot.company.description}
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Current Stock Price */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">2. Current Stock Price</h3>
                <p className="text-2xs text-foreground-muted">Live/latest market price quote and session analytics</p>
              </div>
              <span className="text-xs text-foreground-muted font-mono bg-background px-2.5 py-0.5 rounded border border-border">
                Source: {pipelineResult.snapshot.provenance?.market || "Provider Quotes"}
              </span>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground font-mono">
                  {formatCurrency(pipelineResult.snapshot.market.price, pipelineResult.snapshot.company.currency || "USD")}
                </span>
                {pipelineResult.snapshot.market.changePercent !== null && (
                  <span className={`text-sm font-black font-mono px-2 py-0.5 rounded-lg border ${
                    pipelineResult.snapshot.market.changePercent >= 0 
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" 
                      : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                  }`}>
                    {pipelineResult.snapshot.market.changePercent >= 0 ? "+" : ""}
                    {pipelineResult.snapshot.market.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 flex-1 w-full">
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Prev Close</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {formatCurrency(pipelineResult.snapshot.market.previousClose, pipelineResult.snapshot.company.currency || "USD")}
                  </span>
                </div>
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Session High</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {formatCurrency(pipelineResult.snapshot.market.high, pipelineResult.snapshot.company.currency || "USD")}
                  </span>
                </div>
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Session Low</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {formatCurrency(pipelineResult.snapshot.market.low, pipelineResult.snapshot.company.currency || "USD")}
                  </span>
                </div>
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Volume</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {formatLargeNumber(pipelineResult.snapshot.market.volume)}
                  </span>
                </div>
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">P/E Ratio</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {pipelineResult.snapshot.market.pe !== null ? pipelineResult.snapshot.market.pe.toFixed(2) : "N/A"}
                  </span>
                </div>
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">P/B Ratio</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {pipelineResult.snapshot.market.pb !== null ? pipelineResult.snapshot.market.pb.toFixed(2) : "N/A"}
                  </span>
                </div>
                <div className="bg-background border border-border/80 rounded-xl p-2.5 text-center">
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">EPS</span>
                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">
                    {pipelineResult.snapshot.market.eps !== null ? pipelineResult.snapshot.market.eps.toFixed(2) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
            
            {pipelineResult.snapshot.validation && pipelineResult.snapshot.validation.status !== "unchecked" && (
              <div className="bg-background border border-border/80 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold mb-0.5">Data Quality & Validation Report</span>
                  <p className="text-2xs text-foreground-secondary font-medium leading-relaxed">
                    Compared primary quote from <span className="font-bold text-foreground">{pipelineResult.snapshot.validation.primarySource}</span> against <span className="font-bold text-foreground">{pipelineResult.snapshot.validation.comparedSource}</span> as part of cross-provider validation check.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pipelineResult.snapshot.validation.deviationPercent !== null && (
                    <span className="text-2xs text-foreground-muted font-mono bg-white px-2 py-0.5 rounded border border-border">
                      Deviation: {pipelineResult.snapshot.validation.deviationPercent.toFixed(4)}%
                    </span>
                  )}
                  <span className={`text-5xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                    pipelineResult.snapshot.validation.status === "consistent"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                  }`}>
                    {pipelineResult.snapshot.validation.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Stock Price History (Last 2-3 Years) */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">3. Stock Price History (Last 2–3 Years)</h3>
                <p className="text-2xs text-foreground-muted">Historical daily closing prices and calculated return over the period</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-5xs border font-extrabold uppercase ${getCategoryStatusClass(pipelineResult.snapshot.categoryAssessments.priceHistory.status)}`}>
                {pipelineResult.snapshot.categoryAssessments.priceHistory.status}
              </span>
            </div>

            {(() => {
              const points = getHistoricalPrices();
              if (points.length === 0) {
                return (
                  <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                    No historical price data available.
                  </div>
                );
              }

              const startPrice = points[0].price;
              const endPrice = points[points.length - 1].price;
              const minPrice = Math.min(...points.map(p => p.price));
              const maxPrice = Math.max(...points.map(p => p.price));
              const totalReturn = ((endPrice - startPrice) / startPrice) * 100;
              const currency = pipelineResult.snapshot.company.currency || "USD";

              const strokeColor = totalReturn >= 0 ? "#10b981" : "#f43f5e";
              const fillGradient = totalReturn >= 0 ? "url(#emeraldGradient)" : "url(#roseGradient)";

              // Calculate SVG points
              const priceRange = maxPrice - minPrice || 1;
              const padding = priceRange * 0.05;
              const chartMin = minPrice - padding;
              const chartMax = maxPrice + padding;
              const chartRange = chartMax - chartMin;

              const width = 1000;
              const height = 200;

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
                    <div className="bg-background border border-border/80 rounded-xl p-3">
                      <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Start Price ({points[0].date})</span>
                      <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(startPrice, currency)}</span>
                    </div>
                    <div className="bg-background border border-border/80 rounded-xl p-3">
                      <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Latest Price ({points[points.length - 1].date})</span>
                      <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(endPrice, currency)}</span>
                    </div>
                    <div className="bg-background border border-border/80 rounded-xl p-3">
                      <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Period Return</span>
                      <span className={`text-sm font-black font-mono ${totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
                      </span>
                    </div>
                    <div className="bg-background border border-border/80 rounded-xl p-3">
                      <span className="text-6xs text-foreground-muted uppercase tracking-wider block font-bold">Price Range (Low / High)</span>
                      <span className="text-xs font-bold text-foreground font-mono">
                        {formatCurrency(minPrice, currency)} - {formatCurrency(maxPrice, currency)}
                      </span>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="relative border border-border/80 rounded-xl bg-background p-4 overflow-hidden">
                    <svg viewBox="0 0 1000 200" className="w-full h-48 overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                        </linearGradient>
                        <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0"/>
                        </linearGradient>
                      </defs>
                      
                      {/* Grid Lines */}
                      <line x1="0" y1="50" x2="1000" y2="50" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="0" y1="100" x2="1000" y2="100" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="0" y1="150" x2="1000" y2="150" stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />

                      {/* Area Fill */}
                      <path d={areaPath} fill={fillGradient} />

                      {/* Line Path */}
                      <path d={chartPath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* Chart Timeline Labels */}
                    <div className="flex justify-between text-6xs text-foreground-muted font-mono mt-2 uppercase">
                      <span>{points[0].date}</span>
                      <span>{points[Math.floor(points.length / 2)].date}</span>
                      <span>{points[points.length - 1].date}</span>
                    </div>
                  </div>
                  <p className="text-6xs text-foreground-muted italic leading-none">
                    * {pipelineResult.snapshot.categoryAssessments.priceHistory.reason}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Step 4: Financial Capacity & Financial Strength */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">4. Financial Capacity / Financial Strength</h3>
                <p className="text-2xs text-foreground-muted">Balance sheet health, debt loads, and earnings consistency</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-5xs border font-extrabold uppercase ${getCategoryStatusClass(pipelineResult.snapshot.categoryAssessments.financialCapacity.status)}`}>
                {pipelineResult.snapshot.categoryAssessments.financialCapacity.status}
              </span>
            </div>

            {pipelineResult.snapshot.financials.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                No financial statement data available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-background border-b border-border text-foreground-secondary font-bold">
                        <th className="p-3">Financial Year</th>
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
                      {pipelineResult.snapshot.financials.map((f: any) => {
                        const equity = (f.totalAssets !== null && f.totalLiabilities !== null) ? (f.totalAssets - f.totalLiabilities) : null;
                        const currency = pipelineResult.snapshot.company.currency || "USD";
                        return (
                          <tr key={f.year} className="hover:bg-surface-hover/30 text-foreground-secondary font-mono">
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
                <p className="text-6xs text-foreground-muted italic leading-none">
                  * {pipelineResult.snapshot.categoryAssessments.financialCapacity.reason}
                </p>
              </div>
            )}
          </div>

          {/* Step 5: Cash Flow */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">5. Cash Flow</h3>
                <p className="text-2xs text-foreground-muted">Cash generated from operations and free cash flow generation</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-5xs border font-extrabold uppercase ${getCategoryStatusClass(pipelineResult.snapshot.categoryAssessments.cashFlow.status)}`}>
                {pipelineResult.snapshot.categoryAssessments.cashFlow.status}
              </span>
            </div>

            {pipelineResult.snapshot.financials.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                No cash flow statement data available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-background border-b border-border text-foreground-secondary font-bold">
                        <th className="p-3">Financial Year</th>
                        <th className="p-3">Operating Cash Flow</th>
                        <th className="p-3">Capital Expenditures (Calculated)</th>
                        <th className="p-3">Free Cash Flow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pipelineResult.snapshot.financials.map((f: any) => {
                        const currency = pipelineResult.snapshot.company.currency || "USD";
                        const capex = (f.operatingCashFlow !== null && f.freeCashFlow !== null) ? (f.operatingCashFlow - f.freeCashFlow) : null;
                        return (
                          <tr key={f.year} className="hover:bg-surface-hover/30 text-foreground-secondary font-mono">
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
                <p className="text-6xs text-foreground-muted italic leading-none">
                  * {pipelineResult.snapshot.categoryAssessments.cashFlow.reason}
                </p>
              </div>
            )}
          </div>

          {/* Step 6: Recent Market News */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">6. Most Recent Relevant Market News</h3>
                <p className="text-2xs text-foreground-muted">Top headlines and sentiment analysis of recent market mentions</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-5xs border font-extrabold uppercase ${getCategoryStatusClass(pipelineResult.snapshot.categoryAssessments.news.status)}`}>
                Sentiment: {pipelineResult.snapshot.categoryAssessments.news.status}
              </span>
            </div>

            {pipelineResult.snapshot.news.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted border border-dashed border-border rounded-xl">
                No recent news articles found.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pipelineResult.snapshot.news.slice(0, 6).map((item: any, idx: number) => (
                    <div key={idx} className="border border-border/80 rounded-xl p-4 bg-background hover:shadow-2xs transition-shadow flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-6xs text-foreground-muted font-mono uppercase font-bold">
                          <span>{item.source || "Unknown Source"}</span>
                          <span>{item.date ? new Date(item.date).toLocaleDateString() : "Recent"}</span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">{item.title}</h4>
                        {item.summary && (
                          <p className="text-4xs text-foreground-secondary leading-relaxed line-clamp-3 font-medium">
                            {item.summary}
                          </p>
                        )}
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-4xs font-bold text-primary hover:underline self-start flex items-center gap-1"
                        >
                          Read Article
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-6xs text-foreground-muted italic leading-none">
                  * {pipelineResult.snapshot.categoryAssessments.news.reason}
                </p>
              </div>
            )}
          </div>

          {/* Step 7: Market Value & Market Cap */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">7. Market Value / Market Cap</h3>
                <p className="text-2xs text-foreground-muted">Overall valuation metrics and outstanding equity volume</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-5xs border font-extrabold uppercase ${getCategoryStatusClass(pipelineResult.snapshot.categoryAssessments.marketValue.status)}`}>
                {pipelineResult.snapshot.categoryAssessments.marketValue.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-background border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-20">
                <span className="text-5xs text-foreground-muted uppercase tracking-wider font-extrabold">Market Capitalization</span>
                <span className="text-xl font-black text-foreground font-mono mt-2">
                  {formatLargeNumber(pipelineResult.snapshot.categoryAssessments.marketValue.marketCap, true, pipelineResult.snapshot.company.currency || "USD")}
                </span>
              </div>
              <div className="bg-background border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-20">
                <span className="text-5xs text-foreground-muted uppercase tracking-wider font-extrabold">Shares Outstanding</span>
                <span className="text-xl font-black text-foreground font-mono mt-2">
                  {formatLargeNumber(pipelineResult.snapshot.market.sharesOutstanding)}
                </span>
              </div>
              <div className="bg-background border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-20">
                <span className="text-5xs text-foreground-muted uppercase tracking-wider font-extrabold">Valuation Source</span>
                <span className="text-xs font-bold text-foreground-secondary mt-2 block truncate">
                  {pipelineResult.snapshot.provenance?.market || "Data Provider"}
                </span>
              </div>
            </div>
            <p className="text-6xs text-foreground-muted italic leading-none">
              * {pipelineResult.snapshot.categoryAssessments.marketValue.reason}
            </p>
          </div>

          {/* Step 8: Final Verdict */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-6">
            {pipelineResult.analysisRunResult.status === "unavailable" || !pipelineResult.analysisRunResult.analysis ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-black text-foreground">8. Final Investment Verdict</h3>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Qualitative AI synthesis verdict is currently unavailable
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg border text-4xs font-mono font-bold uppercase bg-rose-500/10 text-rose-600 border-rose-500/20">
                    UNAVAILABLE
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">AI Analysis Synthesis Failed</h4>
                    <p className="text-xs text-foreground-secondary max-w-md mx-auto leading-relaxed">
                      Groq AI analysis failed or returned an invalid schema. No deterministic or mock verdict has been calculated as fallbacks are disabled to prevent key financial risks.
                    </p>
                  </div>
                </div>

                {/* Execution Log */}
                <div className="border-t border-border pt-4 space-y-2">
                  <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">AI Orchestrator Execution Log</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pipelineResult.analysisRunResult.attempts?.map((attempt: any, idx: number) => (
                      <div key={idx} className="border border-border/80 rounded-xl p-3 bg-background text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground uppercase">{attempt.provider}</span>
                          <span className={`px-1.5 py-0.5 rounded text-5xs border font-bold uppercase ${
                            attempt.status === "success" 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          }`}>{attempt.status}</span>
                        </div>
                        <div className="text-4xs text-foreground-secondary font-medium font-mono">Model: {attempt.model} ({attempt.durationMs}ms)</div>
                        {attempt.message && <div className="text-5xs text-rose-500 font-mono mt-1 break-all line-clamp-2">{attempt.message}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-black text-foreground">8. Final Investment Verdict</h3>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Qualitative synthesis compiled by specialist model: <span className="font-bold text-foreground uppercase">Groq</span>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg border text-4xs font-mono font-bold uppercase bg-orange-500/10 text-orange-600 border-orange-500/20">
                    Groq Primary
                  </span>
                </div>

                {/* Main Verdict Row */}
                <div className="flex flex-col sm:flex-row gap-6 items-center py-2">
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

                  <div className="text-center space-y-2">
                    <div className="w-32 h-20 bg-background border border-border rounded-2xl flex flex-col justify-center items-center">
                      <span className="text-2xl font-black text-foreground font-mono">{pipelineResult.analysisRunResult.analysis.finalScore}</span>
                      <span className="text-5xs text-foreground-muted uppercase tracking-wider font-bold">out of 100</span>
                    </div>
                    <span className="text-5xs font-bold text-foreground-muted uppercase tracking-wider block">Synthesized Score</span>
                  </div>

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
                      {pipelineResult.analysisRunResult.analysis.strengths?.slice(0, 4).map((s: string, idx: number) => (
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
                      {pipelineResult.analysisRunResult.analysis.concerns?.slice(0, 4).map((c: string, idx: number) => (
                        <li key={idx} className="leading-snug text-4xs font-medium">{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Detailed Model Interpretations */}
                <div className="border-t border-border pt-4 space-y-4">
                  <span className="font-bold text-xs text-foreground block">Detailed Model Insights</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 bg-background p-3 rounded-lg border border-border">
                      <span className="text-6xs text-foreground-muted font-bold uppercase tracking-wider block">Financial Trend Interpretation</span>
                      <div className="text-foreground-secondary leading-relaxed mt-1">
                        {pipelineResult.analysisRunResult.analysis.financialInterpretation}
                      </div>
                    </div>
                    <div className="space-y-1 bg-background p-3 rounded-lg border border-border">
                      <span className="text-6xs text-foreground-muted font-bold uppercase tracking-wider block">Market Data Interpretation</span>
                      <div className="text-foreground-secondary leading-relaxed mt-1">
                        {pipelineResult.analysisRunResult.analysis.marketInterpretation}
                      </div>
                    </div>
                    <div className="space-y-1 bg-background p-3 rounded-lg border border-border">
                      <span className="text-6xs text-foreground-muted font-bold uppercase tracking-wider block">News Sentiment Interpretation</span>
                      <div className="text-foreground-secondary leading-relaxed mt-1">
                        {pipelineResult.analysisRunResult.analysis.newsInterpretation}
                      </div>
                    </div>
                    <div className="space-y-1 bg-background p-3 rounded-lg border border-border">
                      <span className="text-6xs text-foreground-muted font-bold uppercase tracking-wider block">Conflicts & Gaps Identified</span>
                      <div className="text-foreground-secondary leading-relaxed mt-1 space-y-2">
                        {pipelineResult.analysisRunResult.analysis.conflicts?.length > 0 && (
                          <div>
                            <span className="font-bold text-rose-700 text-5xs block uppercase">Conflicts:</span>
                            <ul className="list-disc list-inside text-rose-900 mt-0.5 space-y-0.5">
                              {pipelineResult.analysisRunResult.analysis.conflicts.map((co: string, i: number) => (
                                <li key={i} className="text-5xs font-medium">{co}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {pipelineResult.analysisRunResult.analysis.evidenceGaps?.length > 0 && (
                          <div>
                            <span className="font-bold text-amber-700 text-5xs block uppercase">Evidence Gaps:</span>
                            <ul className="list-disc list-inside text-amber-900 mt-0.5 space-y-0.5">
                              {pipelineResult.analysisRunResult.analysis.evidenceGaps.map((g: string, i: number) => (
                                <li key={i} className="text-5xs font-medium">{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(!pipelineResult.analysisRunResult.analysis.conflicts?.length && !pipelineResult.analysisRunResult.analysis.evidenceGaps?.length) && (
                          <span className="text-foreground-muted italic">No conflicts or significant gaps resolved.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cited Evidence Sources */}
                <div className="border-t border-border pt-4 space-y-2">
                  <span className="text-6xs font-black text-foreground-muted uppercase tracking-wider block">Cited Evidence Sources</span>
                  <div className="flex flex-wrap gap-2">
                    {pipelineResult.analysisRunResult.analysis.citedEvidenceIds.map((id: string) => {
                      const item = pipelineResult.evidenceBundle?.evidenceIndex?.[id];
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            if (item) {
                              const key = `${item.provider}-${item.endpoint}`;
                              setExpandedEndpoints(prev => ({ ...prev, [key]: true }));
                              const elem = document.getElementById(key);
                              if (elem) elem.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          className="px-2 py-1 rounded bg-background hover:bg-surface-hover border border-border font-mono text-4xs text-foreground flex items-center gap-1.5 transition-all shadow-3xs"
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
            )}
          </div>

          {/* Collapsible Developer Diagnostics Section */}
          <div className="bg-background rounded-2xl border border-dashed border-border p-6 mt-8 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-foreground">Developer Transparency & Audit Logs</h4>
                <p className="text-5xs text-foreground-muted uppercase tracking-wider">Raw endpoint responses, candidates resolution, and credentials probes</p>
              </div>
              <button
                onClick={() => setExpandedEndpoints(prev => {
                  const isDevOpen = !!prev["__dev_section__"];
                  return { ...prev, "__dev_section__": !isDevOpen };
                })}
                className="px-3 py-1.5 bg-white border border-border hover:bg-surface-hover text-xs font-semibold rounded-lg transition-colors shadow-3xs"
              >
                {expandedEndpoints["__dev_section__"] ? "Hide Developer Details" : "Expand Developer Details"}
              </button>
            </div>

            {expandedEndpoints["__dev_section__"] && (
              <div className="space-y-8 pt-4 border-t border-border/80 border-dashed animate-fadeIn">
                
                {/* Company Capability Grid */}
                <div className="space-y-4">
                  <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider block">Registry Candidates & Resolution status</span>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                    {pipelineResult.providers.map((p: ProviderSummary) => {
                      const total = p.endpoints.length;
                      const success = p.endpoints.filter((e) => e.ok).length;
                      const isFiltered = activeProviderFilter === p.provider;
                      
                      return (
                        <button
                          key={p.provider}
                          onClick={() => setActiveProviderFilter(isFiltered ? null : p.provider)}
                          className={`text-left bg-white rounded-xl border p-3.5 flex flex-col justify-between min-h-24 hover:shadow-3xs transition-all group ${
                            isFiltered ? "border-primary ring-2 ring-primary/10" : "border-border/80"
                          }`}
                        >
                          <span className="font-extrabold text-foreground text-xs group-hover:text-primary block truncate">
                            {p.provider}
                          </span>

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
                </div>

                {/* Accordion endpoint logs */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider block">Live Endpoint Diagnostics</span>
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

                          {isExpanded && (
                            <div className="border-t border-border bg-background p-4 space-y-4">
                              {e.error && (
                                <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs space-y-1">
                                  <div className="font-bold uppercase tracking-wider text-3xs">
                                    Error Code: {e.error.code || "UNKNOWN"}
                                  </div>
                                  <div>{e.error.message}</div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1 bg-white p-3 rounded-lg border border-border">
                                  <span className="font-bold text-foreground block uppercase text-3xs tracking-wider">
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
                                  <span className="font-bold text-foreground block uppercase text-3xs tracking-wider">
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

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-foreground-secondary block font-sans">
                                    Normalized Response Contract
                                  </span>
                                  <div className="bg-white border border-border rounded-lg p-3 max-h-60 overflow-auto font-mono text-3xs text-foreground-secondary scrollbar-thin">
                                    {e.response.data ? (
                                      <pre>{JSON.stringify(e.response.data, null, 2)}</pre>
                                    ) : (
                                      <span className="text-foreground-muted italic font-sans">No normalized data compiled (Endpoint status: {e.status})</span>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-foreground-secondary block font-sans">
                                    Raw Redacted JSON Response
                                  </span>
                                  <div className="bg-white border border-border rounded-lg p-3 max-h-60 overflow-auto font-mono text-3xs text-foreground-secondary scrollbar-thin">
                                    {e.response.raw ? (
                                      <pre>{JSON.stringify(e.response.raw, null, 2)}</pre>
                                    ) : (
                                      <span className="text-foreground-muted italic font-sans">No raw payload returned</span>
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

                {/* Sanitized cross-provider evidence bundle passed directly to LLM context window */}
                {pipelineResult.evidenceBundle && (
                  <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
                    <button
                      onClick={() => setShowEvidenceBundleJson(!showEvidenceBundleJson)}
                      className="w-full px-5 py-4 bg-surface hover:bg-surface-hover flex justify-between items-center text-left transition-colors font-sans"
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

                {/* Entire JSON payload returned by the unified diagnostics POST handler */}
                <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
                  <button
                    onClick={() => setShowFullJson(!showFullJson)}
                    className="w-full px-5 py-4 bg-surface hover:bg-surface-hover flex justify-between items-center text-left transition-colors font-sans"
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

        </div>
      )}
    </div>
  );
}
