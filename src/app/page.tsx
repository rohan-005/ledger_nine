"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SearchResult {
  name: string;
  ticker: string;
  canonicalTicker: string;
  exchange: string;
  country: string;
}

interface ProviderHealthStatus {
  provider: string;
  status: string;
  message: string;
  capabilities: string[];
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [healthStatus, setHealthStatus] = useState<ProviderHealthStatus[]>([]);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

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

  // Fetch health data on mount
  useEffect(() => {
    async function fetchHealth() {
      setIsCheckingHealth(true);
      try {
        const res = await fetch("/api/providers/health");
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
    }
    fetchHealth();
  }, []);

  // Debounced Search API call
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (query.includes("(") && query.includes(")")) {
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
    }, 250);

    return () => {
      abortController.abort();
      clearTimeout(delayDebounce);
    };
  }, [query]);

  const handleSelectCompany = (item: SearchResult) => {
    setQuery(`${item.name} (${item.ticker})`);
    setShowDropdown(false);
    router.push(`/research/${encodeURIComponent(item.canonicalTicker || item.ticker)}`);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "working":
      case "success":
        return "bg-neutral-100 text-neutral-900 border-neutral-900";
      case "partial":
        return "bg-neutral-50 text-neutral-600 border-neutral-300";
      case "rate_limit":
        return "bg-neutral-100 text-neutral-800 border-neutral-900 border-dashed animate-pulse";
      case "auth_error":
        return "bg-neutral-900 text-white border-neutral-950 font-bold";
      case "plan_limited":
      case "plan_limit":
        return "bg-neutral-50 text-neutral-700 border-neutral-400 font-medium";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-300";
    }
  };

  return (
    <div className="flex-1 bg-background min-h-screen flex flex-col font-sans">
      {/* Editorial Header Hero */}
      <section 
        id="search-section" 
        className="relative bg-white px-6 py-20 md:py-28 text-foreground text-center flex flex-col items-center justify-center border-b-4 border-foreground"
      >
        <div className="max-w-3xl space-y-6">
          <span className="inline-block px-3 py-1 border border-foreground text-foreground text-2xs uppercase tracking-widest font-mono font-bold">
            Autonomous Financial Intelligence
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight uppercase font-sans">
            Ledger Nine Research Report
          </h1>
          <p className="text-sm md:text-base text-foreground-secondary font-medium max-w-2xl mx-auto leading-relaxed">
            Deterministic diagnostics that verify financials across 7 independent registry providers. 
            No hallucinations, no fabricated data, and complete evidence tracing.
          </p>

          {/* Autocomplete Input Container */}
          <div className="w-full max-w-xl mx-auto mt-8 relative" ref={dropdownRef}>
            <div className="relative bg-white border-2 border-foreground p-1 shadow-[4px_4px_0px_0px_#111111]">
              <div className="flex gap-2 bg-white px-3 py-2 items-center">
                <svg className="w-5 h-5 text-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query.trim() && setShowDropdown(true)}
                  placeholder="Enter company name or ticker (e.g. AAPL, RELIANCE)..."
                  className="w-full bg-transparent border-0 text-foreground text-sm focus:ring-0 focus:outline-none placeholder-foreground-muted font-medium"
                />
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin shrink-0" />
                )}
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-foreground shadow-[6px_6px_0px_0px_#111111] z-50 max-h-72 overflow-y-auto divide-y divide-neutral-200 text-left">
                {searchResults.map((item) => (
                  <button
                    key={item.canonicalTicker}
                    onClick={() => handleSelectCompany(item)}
                    className="w-full px-4 py-3 hover:bg-neutral-50 text-left flex justify-between items-center text-sm transition-colors text-foreground"
                  >
                    <div>
                      <span className="font-bold">{item.name}</span>
                      <span className="ml-2 text-xs text-foreground-secondary">({item.country})</span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-neutral-100 text-foreground px-2 py-0.5 border border-foreground">
                        {item.ticker}
                      </span>
                      <span className="text-2xs text-foreground-secondary w-20 truncate text-right">{item.exchange}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Curated Suggestion Chips */}
          <div className="pt-4 flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
            <span className="text-xs text-foreground-secondary self-center font-bold mr-1">Curated List:</span>
            {[
              { name: "Apple", ticker: "AAPL", canonical: "AAPL" },
              { name: "Tesla", ticker: "TSLA", canonical: "TSLA" },
              { name: "Reliance Industries", ticker: "RELIANCE", canonical: "RELIANCE.NS" },
              { name: "TCS", ticker: "TCS", canonical: "TCS.NS" },
              { name: "Tata Steel", ticker: "TATASTEEL", canonical: "TATASTEEL.NS" }
            ].map((chip) => (
              <Link
                key={chip.canonical}
                href={`/research/${encodeURIComponent(chip.canonical)}`}
                className="px-3 py-1.5 border border-foreground text-xs font-bold text-foreground bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_0px_#111111] transition-all"
              >
                <span className="font-mono font-black mr-1">{chip.ticker}</span>
                <span className="text-foreground-secondary font-normal font-sans">({chip.name})</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="max-w-6xl w-full mx-auto px-6 py-16 md:py-24 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight font-sans">
            Methodology & Flow
          </h2>
          <p className="text-xs md:text-sm text-foreground-secondary max-w-lg mx-auto leading-relaxed font-bold font-mono">
            DETERMINISTIC VERIFICATION DAG · LANGGRAPH.JS ORCHESTRATION
          </p>
        </div>

        {/* Structured Horizontal Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 relative">
          {[
            {
              step: "01",
              title: "Symbol Resolution",
              desc: "Maps requested tickers across US & Indian exchanges, generating candidate aliases."
            },
            {
              step: "02",
              title: "Parallel Fetch",
              desc: "Hits FMP, Twelve Data, Alpha Vantage, SEC, Finnhub, Yahoo, and NewsAPI concurrently."
            },
            {
              step: "03",
              title: "Evidence Bundle",
              desc: "Extracts facts into a central registry with strict privacy and api-key redactions."
            },
            {
              step: "04",
              title: "Conflict Check",
              desc: "Compares quotes (e.g. Yahoo vs Twelve Data) and highlights discrepancy deviations."
            },
            {
              step: "05",
              title: "Deterministic Scoring",
              desc: "Runs hardcoded formulas over price length, balance sheets, and operations."
            },
            {
              step: "06",
              title: "LLM Verdict Synthesis",
              desc: "OpenRouter & Groq consensus models assess qualitative thesis inside the bundle constraints."
            }
          ].map((item, index) => (
            <div key={index} className="relative bg-white border border-foreground p-5 shadow-[3px_3px_0px_0px_#111111] flex flex-col justify-between space-y-4">
              <span className="text-2xl font-black text-foreground font-mono block border-b border-foreground pb-2">{item.step}</span>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-tight">{item.title}</h3>
                <p className="text-2xs text-foreground-secondary leading-relaxed font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What We Check Section */}
      <section className="bg-neutral-50 border-y border-foreground py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight">
              Evidence Checked in Each Audit
            </h2>
            <p className="text-xs md:text-sm text-foreground-secondary max-w-lg mx-auto leading-relaxed font-bold font-mono">
              FACTUAL METRIC CATEGORIES FOR BULLETPROOF EVALUATIONS
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              {
                title: "Stock Price History",
                subtitle: "Length & Growth Check",
                desc: "Checks stock history for the last 2-3 years, calculating compound returns and identifying history length sufficiency."
              },
              {
                title: "Financial Capacity",
                subtitle: "Balance Sheet Health",
                desc: "Validates annual revenues, net incomes, assets, liabilities, and debt-to-equity leverage ratios."
              },
              {
                title: "Cash Flow Coverage",
                subtitle: "Liquidity Analysis",
                desc: "Audits operational cash flows, capital expenditures, and free cash flows to verify self-sustainability."
              },
              {
                title: "Recent Market News",
                subtitle: "Headline Sentiment",
                desc: "Synthesizes recent news headlines, sources, and links, rating sentiment as positive, neutral, or concern-heavy."
              },
              {
                title: "Market Valuation",
                subtitle: "Value & Equity Check",
                desc: "Calculates market capitalization, shares outstanding volume, and verifies valuation source transparency."
              }
            ].map((card, idx) => (
              <div key={idx} className="bg-white border border-foreground p-6 shadow-[3px_3px_0px_0px_#111111] flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-8xs font-bold text-foreground-muted uppercase tracking-widest block font-mono">{card.subtitle}</span>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-tight">{card.title}</h3>
                  <p className="text-2xs text-foreground-secondary leading-relaxed font-medium">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency & Health Indicators Section */}
      <section className="max-w-6xl w-full mx-auto px-6 py-16 md:py-24 space-y-8 flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight">
              Transparency & API Provider Health
            </h2>
            <p className="text-xs text-foreground-secondary leading-relaxed mt-1 font-mono font-bold">
              REAL-TIME API STATUS CHECKS AND PROBE LATENCIES
            </p>
          </div>
          <button
            onClick={async () => {
              setIsCheckingHealth(true);
              try {
                const res = await fetch("/api/providers/health?force=true");
                if (res.ok) {
                  const data = await res.json();
                  if (data && Array.isArray(data.details)) {
                    setHealthStatus(data.details);
                  }
                }
              } catch (e) {
                console.error(e);
              } finally {
                setIsCheckingHealth(false);
              }
            }}
            disabled={isCheckingHealth}
            className="px-4 py-2 border border-foreground bg-white text-xs font-bold text-foreground hover:bg-neutral-50 shadow-[3px_3px_0px_0px_#111111] flex items-center gap-2 transition-all cursor-pointer font-mono"
          >
            {isCheckingHealth && (
              <div className="w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            )}
            Force Fresh Probes
          </button>
        </div>

        {healthStatus.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {healthStatus.map((h) => (
              <div 
                key={h.provider} 
                className="bg-white border border-foreground p-4 shadow-[2px_2px_0px_0px_#111111] flex flex-col justify-between space-y-3"
              >
                <div className="flex justify-between items-start">
                  <span className="font-extrabold text-foreground text-xs uppercase font-mono">{h.provider}</span>
                  <span className={`px-2 py-0.5 text-7xs font-black uppercase border ${getStatusBadgeClass(h.status)}`}>
                    {h.status === "working" ? "ONLINE" : h.status}
                  </span>
                </div>
                <p className="text-8xs text-foreground-secondary leading-normal line-clamp-2 font-medium">
                  {h.message}
                </p>
                <div className="flex flex-wrap gap-1 border-t border-neutral-100 pt-2.5">
                  {h.capabilities.map((c, i) => (
                    <span key={i} className="text-8xs font-mono font-bold bg-neutral-100 text-foreground px-1.5 py-0.5 border border-neutral-200">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-foreground-secondary border border-dashed border-foreground font-mono">
            Loading API health statuses...
          </div>
        )}
      </section>

      {/* Final CTA */}
      <section className="bg-foreground px-6 py-16 text-white text-center border-t border-foreground">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl font-black tracking-tight uppercase">Ready to verify a stock candidate?</h2>
          <p className="text-xs text-neutral-400 font-medium">
            Enter any global or Indian exchange symbol in the search input above to initiate a clean, transparent, multi-provider audit.
          </p>
          <button 
            onClick={() => {
              const el = document.getElementById("search-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-2 px-6 py-2.5 bg-white text-foreground border border-foreground font-bold text-xs hover:bg-neutral-100 shadow-[3px_3px_0px_0px_#737373] transition-all cursor-pointer font-mono"
          >
            Start Audit Now
          </button>
        </div>
      </section>
    </div>
  );
}