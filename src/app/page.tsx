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

    // Ignore if input matches a suggestion we selected (e.g. ends with parentheses)
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
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "partial":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
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

  return (
    <div className="flex-1 bg-background min-h-screen flex flex-col">
      {/* Hero Section */}
      <section 
        id="search-section" 
        className="relative bg-linear-to-b from-slate-900 to-primary px-6 py-20 md:py-28 text-white text-center flex flex-col items-center justify-center border-b border-border shadow-xs"
      >
        <div className="max-w-3xl space-y-6">
          <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wider text-amber-300">
            Autonomous Financial Intelligence
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Evidence-Driven Investment Research
          </h1>
          <p className="text-base md:text-lg text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
            Deterministic diagnostics that verify financials across 7 independent registry providers. 
            No hallucinations, no fabricated data, and complete evidence tracing.
          </p>

          {/* Autocomplete Input Container */}
          <div className="w-full max-w-xl mx-auto mt-8 relative" ref={dropdownRef}>
            <div className="relative shadow-xl rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md p-1.5 border border-white/20">
              <div className="flex gap-2 bg-white rounded-xl shadow-inner px-3 py-2 items-center">
                <svg className="w-5 h-5 text-foreground-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query.trim() && setShowDropdown(true)}
                  placeholder="Search by name or ticker (e.g. AAPL, RELIANCE, TCS...)"
                  className="w-full bg-transparent border-0 text-foreground text-sm focus:ring-0 focus:outline-none placeholder-foreground-secondary font-medium"
                />
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                )}
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-border rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-border text-left">
                {searchResults.map((item) => (
                  <button
                    key={item.canonicalTicker}
                    onClick={() => handleSelectCompany(item)}
                    className="w-full px-4 py-3 hover:bg-slate-50 text-left flex justify-between items-center text-sm transition-colors text-foreground"
                  >
                    <div>
                      <span className="font-semibold">{item.name}</span>
                      <span className="ml-2 text-xs text-foreground-secondary">({item.country})</span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-foreground-secondary px-2.5 py-0.5 rounded border border-border">
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
            <span className="text-xs text-slate-400 self-center font-semibold mr-1">Suggestions:</span>
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
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/35 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-2xs"
              >
                <span className="font-bold mr-1">{chip.ticker}</span>
                <span className="text-slate-400 font-normal font-sans">({chip.name})</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 md:py-24 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
            How Ledger Nine Company Research Works
          </h2>
          <p className="text-sm text-foreground-secondary max-w-lg mx-auto leading-relaxed font-medium">
            A deterministic verification engine that replaces model hallucination with auditable raw evidence.
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
              desc: "Groq Llama model assesses qualitative thesis strictly inside the bundle constraints."
            }
          ].map((item, index) => (
            <div key={index} className="relative bg-surface border border-border p-5 rounded-2xl shadow-3xs flex flex-col justify-between space-y-4">
              <span className="text-3xl font-black text-slate-200 font-mono block">{item.step}</span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground leading-snug">{item.title}</h3>
                <p className="text-xs text-foreground-secondary leading-relaxed font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What We Check Section */}
      <section className="bg-slate-50 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              Evidence Checked in Each Audit
            </h2>
            <p className="text-sm text-foreground-secondary max-w-lg mx-auto leading-relaxed font-medium">
              We compile factual metrics across five key categories to prevent data gaps or fabrications.
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
              <div key={idx} className="bg-white border border-border p-6 rounded-2xl shadow-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-6xs font-bold text-orange-600 uppercase tracking-wider block">{card.subtitle}</span>
                  <h3 className="text-sm font-bold text-foreground leading-snug">{card.title}</h3>
                  <p className="text-xs text-foreground-secondary leading-relaxed font-medium">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency & Health Indicators Section */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 space-y-8 flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              Transparency & API Provider Health
            </h2>
            <p className="text-sm text-foreground-secondary leading-relaxed mt-1 font-medium">
              Real-time API probe check for auth, availability, and response latency.
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
            className="px-4 py-2 border border-border bg-white text-xs font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-2 transition-all shadow-2xs text-foreground cursor-pointer"
          >
            {isCheckingHealth && (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            Force Fresh Probes
          </button>
        </div>

        {healthStatus.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {healthStatus.map((h) => (
              <div 
                key={h.provider} 
                className="bg-white border border-border rounded-xl p-4 space-y-3 shadow-3xs flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <span className="font-extrabold text-foreground text-xs">{h.provider}</span>
                  <span className={`px-2 py-0.5 rounded text-7xs font-black uppercase border ${getStatusBadgeClass(h.status)}`}>
                    {h.status === "working" ? "ONLINE" : h.status}
                  </span>
                </div>
                <p className="text-5xs text-foreground-secondary leading-normal line-clamp-2 font-medium">
                  {h.message}
                </p>
                <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2.5">
                  {h.capabilities.map((c, i) => (
                    <span key={i} className="text-8xs font-semibold bg-slate-100 text-foreground-secondary px-1.5 py-0.5 rounded">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-foreground-secondary border border-dashed border-border rounded-2xl">
            Loading API health statuses...
          </div>
        )}
      </section>

      {/* Final CTA */}
      <section className="bg-slate-900 px-6 py-16 text-white text-center border-t border-border shadow-inner">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl font-black tracking-tight">Ready to verify a stock candidate?</h2>
          <p className="text-xs text-slate-400 font-medium">
            Enter any global or Indian exchange symbol in the search input above to initiate a clean, transparent, multi-provider audit.
          </p>
          <button 
            onClick={() => {
              const el = document.getElementById("search-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-2 px-6 py-2.5 bg-white text-slate-900 font-bold text-xs rounded-lg hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
          >
            Start Audit Now
          </button>
        </div>
      </section>
    </div>
  );
}