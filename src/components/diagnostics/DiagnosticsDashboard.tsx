"use client";

import React, { useState, useEffect, useRef } from "react";
import { CompanyIdentity, ProviderCandidates, getProviderCandidates } from "@/src/lib/company/symbolCandidates";
import { EndpointResult, ProviderSummary, ProviderEndpointStatus } from "@/src/lib/providers/shared/types";

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

  // Run the full parallel diagnostics pipeline
  const runDiagnostics = async () => {
    if (!selectedCompany) return;

    setLoading(true);
    setPipelineResult(null);
    
    // Step 1: candidates validation
    setLoadingStep("1. Validating symbol candidates sequentially across FMP, Finnhub, Twelve Data, EODHD...");
    
    try {
      // Simulate/wait for execution step labels
      await new Promise((r) => setTimeout(r, 800));
      setLoadingStep("2. Initiating parallel fetches for resolved tickers across 6 API providers...");
      
      await new Promise((r) => setTimeout(r, 600));
      setLoadingStep("3. Fetching raw metrics, financial statements, time series, news and Tavily research...");

      const res = await fetch("/api/research/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company: selectedCompany }),
      });

      setLoadingStep("4. Normalizing response payloads and redacting keys...");
      await new Promise((r) => setTimeout(r, 400));

      if (res.ok) {
        const data = await res.json();
        setPipelineResult(data);
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
  const getStatusBadgeClass = (status: ProviderEndpointStatus) => {
    switch (status) {
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
      case "unsupported":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "timeout":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "network_error":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      default:
        return "bg-red-500/10 text-red-600 border-red-500/20";
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
      <div className="border-b border-border pb-6 space-y-2">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <span className="p-2 bg-primary text-white rounded-lg text-sm">L9</span>
          Ledger Nine Diagnostics Dashboard
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Transparent multi-provider financial data diagnostic runner. Evaluates live endpoints, handles candidate resolution, and returns redacted raw outputs.
        </p>
      </div>

      {/* Grid: Search & Selected Company Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Search Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-foreground">1. Search Company</h2>
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
                  {loading ? "Running..." : "Fetch All APIs"}
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
            <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider block mb-2">
              Curated Catalog Suggestions:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "Apple", ticker: "AAPL", canonicalTicker: "AAPL", exchange: "NASDAQ", country: "US", aliases: [] },
                { name: "Reliance", ticker: "RELIANCE", canonicalTicker: "RELIANCE.NS", exchange: "NSE", country: "India", aliases: [] },
                { name: "TCS", ticker: "TCS", canonicalTicker: "TCS.NS", exchange: "NSE", country: "India", aliases: [] },
                { name: "Tesla", ticker: "TSLA", canonicalTicker: "TSLA", exchange: "NASDAQ", country: "US", aliases: [] },
                { name: "Infosys", ticker: "INFY", canonicalTicker: "INFY.NS", exchange: "NSE", country: "India", aliases: [] },
              ].map((s) => (
                <button
                  key={s.canonicalTicker}
                  onClick={() => handleSelectCompany(s)}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-surface-hover border border-border hover:border-foreground-muted/50 text-xs font-medium text-foreground transition-all"
                >
                  <span className="font-bold mr-1">{s.ticker}</span>
                  <span className="text-foreground-muted font-normal">({s.name})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Company Identity details card */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-foreground">2. Company Identity</h2>
          {selectedCompany ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground-secondary">Name</span>
                <span className="font-semibold text-foreground text-right">{selectedCompany.name}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground-secondary">Display Ticker</span>
                <span className="font-mono font-bold text-foreground">{selectedCompany.displayTicker}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground-secondary">Canonical Ticker</span>
                <span className="font-mono text-foreground">{selectedCompany.canonicalTicker || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground-secondary">Exchange</span>
                <span className="text-foreground font-semibold">{selectedCompany.exchange || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-foreground-secondary">Country</span>
                <span className="text-foreground">{selectedCompany.country || "N/A"}</span>
              </div>
              
              {/* Provider candidates breakdown */}
              {candidates && (
                <div className="pt-2 space-y-2">
                  <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider block">
                    Generated Ticker Candidates:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background p-2 rounded border border-border">
                      <span className="font-bold text-foreground-secondary block">FMP</span>
                      <span className="font-mono">{candidates.fmp.join(", ") || "None"}</span>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <span className="font-bold text-foreground-secondary block">Finnhub</span>
                      <span className="font-mono">{candidates.finnhub.join(", ") || "None"}</span>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <span className="font-bold text-foreground-secondary block">Twelve Data</span>
                      <span className="font-mono">{candidates.twelveData.join(", ") || "None"}</span>
                    </div>
                    <div className="bg-background p-2 rounded border border-border">
                      <span className="font-bold text-foreground-secondary block">EODHD</span>
                      <span className="font-mono">{candidates.eodhd.join(", ") || "None"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-40 flex flex-col items-center justify-center text-foreground-muted text-xs text-center border-2 border-dashed border-border rounded-xl">
              <span>No company selected.</span>
              <span>Search or click a suggestion chip above.</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading Progress State */}
      {loading && (
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Executing Diagnostics Pipeline...
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
          
          {/* Section: Overall Summary Panel */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">3. Pipeline Diagnostic Summary</h2>
                <p className="text-xs text-foreground-muted">
                  Overall status: <span className="font-bold text-foreground">{pipelineResult.overallStatus.toUpperCase()}</span>
                </p>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase ${getStatusBadgeClass(pipelineResult.overallStatus)}`}>
                {pipelineResult.overallStatus}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-background p-3 rounded-xl border border-border">
                <span className="text-xs text-foreground-secondary block">Total Duration</span>
                <span className="text-lg font-extrabold text-foreground">{pipelineResult.durationMs} ms</span>
              </div>
              <div className="bg-background p-3 rounded-xl border border-border">
                <span className="text-xs text-foreground-secondary block">Total Endpoints</span>
                <span className="text-lg font-extrabold text-foreground">{pipelineResult.allEndpoints.length}</span>
              </div>
              <div className="bg-background p-3 rounded-xl border border-border">
                <span className="text-xs text-foreground-secondary block">Successful Calls</span>
                <span className="text-lg font-extrabold text-emerald-600">
                  {pipelineResult.allEndpoints.filter((e: any) => e.ok).length}
                </span>
              </div>
              <div className="bg-background p-3 rounded-xl border border-border">
                <span className="text-xs text-foreground-secondary block">Failed Calls</span>
                <span className="text-lg font-extrabold text-rose-600">
                  {pipelineResult.allEndpoints.filter((e: any) => !e.ok).length}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Provider Status Cards Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground-muted uppercase tracking-wider">
              4. Provider Status Grid
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pipelineResult.providers.map((p: ProviderSummary) => {
                const total = p.endpoints.length;
                const success = p.endpoints.filter((e) => e.ok).length;
                const isFiltered = activeProviderFilter === p.provider;
                
                return (
                  <button
                    key={p.provider}
                    onClick={() => setActiveProviderFilter(isFiltered ? null : p.provider)}
                    className={`text-left bg-white rounded-2xl border p-6 shadow-xs hover:shadow transition-all group flex flex-col justify-between space-y-4 ${
                      isFiltered ? "border-primary ring-2 ring-primary/10" : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div>
                        <span className="font-extrabold text-foreground text-lg group-hover:text-primary block">
                          {p.provider}
                        </span>
                        {p.symbolUsed ? (
                          <span className="font-mono text-xs text-foreground-secondary bg-background px-1.5 py-0.5 rounded border border-border">
                            Symbol: {p.symbolUsed}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground-muted">No symbol resolved</span>
                        )}
                      </div>
                      <div className={`px-2 py-1 rounded text-2xs font-bold uppercase border ${getStatusBadgeClass(p.status)}`}>
                        {p.status}
                      </div>
                    </div>

                    <div className="text-xs text-foreground-secondary space-y-1">
                      <div className="flex justify-between">
                        <span>Endpoints Succeeded</span>
                        <span className="font-bold text-foreground">
                          {success} / {total}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Duration</span>
                        <span className="text-foreground">{p.durationMs} ms</span>
                      </div>
                      {p.candidatesTried && p.candidatesTried.length > 0 && (
                        <div className="pt-2 border-t border-border mt-2">
                          <span className="text-2xs font-bold text-foreground-muted uppercase block">
                            Candidates Checked
                          </span>
                          <span className="font-mono text-2xs text-foreground-secondary">
                            {p.candidatesTried.join(" → ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Individual Endpoint Results Panels */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground-muted uppercase tracking-wider">
                5. Live Endpoint Diagnostic Outputs
              </h3>
              {activeProviderFilter && (
                <button
                  onClick={() => setActiveProviderFilter(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filter ({activeProviderFilter})
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
                          <span className="text-xs text-foreground-muted bg-background px-1.5 py-0.5 rounded border border-border">
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
                            <span className="font-bold text-foreground block uppercase text-2xs tracking-wider">
                              Diagnostics Request
                            </span>
                            <div className="font-mono text-3xs space-y-1">
                              <div><span className="text-foreground-secondary">Method:</span> {e.request.method}</div>
                              <div><span className="text-foreground-secondary">Endpoint URL:</span> {e.request.endpoint}</div>
                              <div><span className="text-foreground-secondary">Requested Symbol:</span> {e.request.symbolRequested || "None"}</div>
                              <div><span className="text-foreground-secondary">Confirmed Ticker:</span> {e.request.symbolUsed || "None"}</div>
                              <div><span className="text-foreground-secondary">Candidates Checked:</span> {e.request.candidatesTried.join(" → ") || "None"}</div>
                              {e.request.query && <div><span className="text-foreground-secondary">Query Parameter:</span> {e.request.query}</div>}
                            </div>
                          </div>
                          
                          <div className="space-y-1 bg-white p-3 rounded-lg border border-border">
                            <span className="font-bold text-foreground block uppercase text-2xs tracking-wider">
                              Response Meta
                            </span>
                            <div className="font-mono text-3xs space-y-1">
                              <div><span className="text-foreground-secondary">HTTP Status Code:</span> {e.httpStatus ?? "N/A"}</div>
                              <div><span className="text-foreground-secondary">Response Date:</span> {e.completedAt}</div>
                              <div><span className="text-foreground-secondary">Record Count:</span> {e.response.recordCount ?? "N/A"}</div>
                              <div><span className="text-foreground-secondary">Duration Measured:</span> {e.durationMs} ms</div>
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

          {/* Section: Full Combined JSON Inspector */}
          <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
            <button
              onClick={() => setShowFullJson(!showFullJson)}
              className="w-full px-5 py-4 bg-surface hover:bg-surface-hover flex justify-between items-center text-left transition-colors"
            >
              <div className="space-y-1">
                <span className="font-extrabold text-foreground text-sm">6. Combined Pipeline Output</span>
                <p className="text-3xs text-foreground-muted">
                  Raw JSON output returned by the unified /api/research/fetch handler.
                </p>
              </div>
              <span className="text-xs text-foreground-secondary">{showFullJson ? "Hide JSON" : "Inspect JSON"}</span>
            </button>

            {showFullJson && (
              <div className="border-t border-border p-4 bg-background">
                <div className="bg-white border border-border rounded-lg p-4 max-h-96 overflow-auto font-mono text-3xs text-foreground-secondary">
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
