"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createResearch } from "@/src/lib/api/research";
import { RiskTolerance, ApiError } from "@/src/types/frontend";
import CompanySearch from "./company-search";

const HORIZON_OPTIONS = [
  { value: "1-2 years", label: "Short term (1–2 years)" },
  { value: "3-5 years", label: "Medium term (3–5 years)" },
  { value: "5+ years", label: "Long term (5+ years)" },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string }[] = [
  { value: "low", label: "Cautious (Prefer stability)" },
  { value: "moderate", label: "Balanced (Accept some risk)" },
  { value: "high", label: "Aggressive (Comfortable with swings)" },
];

interface FieldError {
  ticker?: string;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === "object" && err !== null && "error" in err;
}

export default function ResearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ticker, setTicker] = useState("");
  const [horizon, setHorizon] = useState("3-5 years");
  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill ticker from search params
  useEffect(() => {
    const tParam = searchParams.get("ticker");
    if (tParam) {
      setTicker(tParam.trim().toUpperCase());
    }
  }, [searchParams]);

  function validate(): boolean {
    const errors: FieldError = {};
    const t = ticker.trim();
    if (!t) {
      errors.ticker = "Ticker symbol or company search is required.";
    } else if (!/^[A-Za-z0-9.\-]{1,16}$/.test(t)) {
      errors.ticker = "Must be 1–16 alphanumeric characters (dots/dashes allowed).";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await createResearch({
        ticker: ticker.trim().toUpperCase(),
        investmentHorizon: horizon,
        riskTolerance: risk,
      });
      router.push(`/research/${res.researchId}`);
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.error : "Unexpected error. Please try again.";
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-label="New research form">
      {submitError && (
        <div
          role="alert"
          id="form-error"
          className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm font-medium"
        >
          <span className="font-bold">Error: </span>
          {submitError}
        </div>
      )}

      {/* Company Search Component */}
      <CompanySearch
        value={ticker}
        onChange={(val) => {
          setTicker(val);
          if (fieldErrors.ticker) setFieldErrors({});
        }}
        onSelect={(selectedTicker) => {
          setTicker(selectedTicker);
          if (fieldErrors.ticker) setFieldErrors({});
        }}
        disabled={isSubmitting}
        error={fieldErrors.ticker}
      />

      {/* Investment Horizon */}
      <div className="space-y-1">
        <label htmlFor="horizon" className="block text-sm font-semibold text-foreground">
          Investment Horizon <span className="text-red-500" aria-hidden>*</span>
        </label>
        <select
          id="horizon"
          name="horizon"
          value={horizon}
          disabled={isSubmitting}
          onChange={(e) => setHorizon(e.target.value)}
          className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-foreground
            focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {HORIZON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Risk Tolerance */}
      <div className="space-y-1">
        <label htmlFor="risk" className="block text-sm font-semibold text-foreground">
          Risk Tolerance <span className="text-red-500" aria-hidden>*</span>
        </label>
        <select
          id="risk"
          name="risk"
          value={risk}
          disabled={isSubmitting}
          onChange={(e) => setRisk(e.target.value as RiskTolerance)}
          className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-foreground
            focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {RISK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-bold
          rounded-xl px-4 py-3.5 text-sm transition-all shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? "Initiating research pipeline…" : "Run Research"}
      </button>
    </form>
  );
}
