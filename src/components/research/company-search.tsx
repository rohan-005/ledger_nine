"use client";

import React, { useState, useEffect, useRef } from "react";

export interface StockSuggestion {
  ticker: string;
  name: string;
}

export const CURATED_STOCKS: StockSuggestion[] = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "MSFT", name: "Microsoft Corporation" },
  { ticker: "NVDA", name: "NVIDIA Corporation" },
  { ticker: "TSLA", name: "Tesla, Inc." },
  { ticker: "AMZN", name: "Amazon.com, Inc." },
  { ticker: "GOOGL", name: "Alphabet Inc." },
  { ticker: "META", name: "Meta Platforms, Inc." },
  { ticker: "LLY", name: "Eli Lilly and Company" },
  { ticker: "AVGO", name: "Broadcom Inc." },
  { ticker: "JPM", name: "JPMorgan Chase & Co." },
  { ticker: "V", name: "Visa Inc." },
  { ticker: "UNH", name: "UnitedHealth Group Incorporated" },
];

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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter curated stocks based on user input
  const filteredSuggestions = value.trim()
    ? CURATED_STOCKS.filter(
        (stock) =>
          stock.ticker.toLowerCase().includes(value.toLowerCase()) ||
          stock.name.toLowerCase().includes(value.toLowerCase())
      )
    : CURATED_STOCKS;

  // Reset highlight index when suggestions list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

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
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredSuggestions.length
        ) {
          const selected = filteredSuggestions[highlightedIndex];
          onSelect(selected.ticker);
          setIsOpen(false);
        } else if (filteredSuggestions.length > 0) {
          // If no highlight but suggestions exist, select the first one
          onSelect(filteredSuggestions[0].ticker);
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

  const handleSelect = (ticker: string) => {
    onSelect(ticker);
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
          placeholder="Search by company name or type ticker (e.g. Apple, AAPL)"
          disabled={disabled}
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen && filteredSuggestions.length > 0}
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
      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          id="company-search-suggestions"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-border py-1"
        >
          {filteredSuggestions.map((stock, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={stock.ticker}
                id={`suggestion-item-${index}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(stock.ticker)}
                className={`px-4 py-2.5 flex items-center justify-between text-sm cursor-pointer transition-colors ${
                  isHighlighted ? "bg-blue-50 text-blue-900" : "text-foreground bg-white"
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{stock.name}</span>
                  <span className="text-xs text-foreground-secondary font-mono">{stock.ticker}</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-background border border-border text-foreground-secondary rounded font-mono">
                  {stock.ticker}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
