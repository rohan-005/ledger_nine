"use client";

import React, { useState, useEffect, useRef } from "react";
import { CompanyCatalogItem } from "@/src/data/curatedCompanies";

interface CompanySearchProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (ticker: string) => void;
  disabled?: boolean;
  error?: string;
}

export default function CompanySearch({
  value,
  onChange,
  onSelect,
  disabled = false,
  error,
}: CompanySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<CompanyCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch search results (local curated + dynamic FMP) with debouncing
  useEffect(() => {
    let active = true;
    
    if (!isOpen) {
      return;
    }

    const trimmed = value.trim();
    // Debounce remote searches, fetch curated lists instantly if empty
    const delay = trimmed ? 250 : 0;
    
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok && active) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, isOpen]);

  // Reset highlight index when suggestions list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < suggestions.length
        ) {
          const selected = suggestions[highlightedIndex];
          onSelect(selected.canonicalTicker);
          setIsOpen(false);
        } else if (suggestions.length > 0) {
          // If no highlight but suggestions exist, select the first one
          onSelect(suggestions[0].canonicalTicker);
          setIsOpen(false);
        } else {
          // No suggestions, submit the raw text typed by user
          onSelect(value.trim().toUpperCase());
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelect = (canonicalTicker: string) => {
    onSelect(canonicalTicker);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1">
      <label htmlFor="company-search" className="block text-sm font-semibold text-foreground">
        Company or Stock Symbol <span className="text-red-500" aria-hidden>*</span>
      </label>
      <div className="relative">
        <input
          id="company-search"
          ref={inputRef}
          type="text"
          name="ticker"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={50}
          placeholder="Search by company name or type ticker (e.g. Apple, AAPL, Reliance)"
          disabled={disabled}
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen && suggestions.length > 0}
          aria-autocomplete="list"
          aria-controls="company-search-suggestions"
          aria-invalid={!!error}
          aria-describedby={error ? "company-search-error" : undefined}
          className={`w-full bg-white border rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground-muted
            focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-blue-500"}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onSelect("");
              setIsOpen(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground-muted hover:text-foreground rounded-full hover:bg-surface-hover focus:outline-none"
            aria-label="Clear input"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <p id="company-search-error" role="alert" className="text-xs text-red-500 font-medium">
          {error}
        </p>
      )}

      {/* Suggestion list */}
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <ul
          id="company-search-suggestions"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-border py-1"
        >
          {isLoading && suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-foreground-secondary text-center">
              Searching...
            </li>
          )}
          
          {suggestions.map((stock, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={stock.canonicalTicker}
                id={`suggestion-item-${index}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(stock.canonicalTicker)}
                className={`px-4 py-2.5 flex items-center justify-between text-sm cursor-pointer transition-colors ${
                  isHighlighted ? "bg-blue-50 text-blue-900" : "text-foreground bg-white"
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-left">{stock.name}</span>
                  <span className="text-xs text-foreground-secondary text-left font-mono">
                    {stock.ticker} · {stock.exchange} · {stock.country}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-background border border-border text-foreground-secondary rounded font-mono">
                  {stock.exchange}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
