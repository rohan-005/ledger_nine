"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createResearch } from "@/src/lib/api/research";
import { RiskTolerance, ApiError } from "@/src/types/frontend";

const HORIZON_OPTIONS = [
  { value: "1-2 years", label: "Short Term (1–2 years)" },
  { value: "3-5 years", label: "Medium Term (3–5 years)" },
  { value: "5+ years", label: "Long Term (5+ years)" },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string }[] = [
  { value: "low", label: "Low — Capital preservation priority" },
  { value: "moderate", label: "Moderate — Balanced approach" },
  { value: "high", label: "High — Growth-oriented" },
];

interface FieldError {
  ticker?: string;
}

function isApiError(err: unknown): err is ApiError {
  return typeof err === "object" && err !== null && "error" in err;
}

export default function ResearchForm() {
  const router = useRouter();

  const [ticker, setTicker] = useState("");
  const [horizon, setHorizon] = useState("3-5 years");
  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errors: FieldError = {};
    const t = ticker.trim();
    if (!t) {
      errors.ticker = "Ticker symbol is required.";
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
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="New research form">
      {submitError && (
        <div
          role="alert"
          id="form-error"
          className="border border-red-800 bg-red-950/40 text-red-200 rounded-lg px-4 py-3 text-sm"
        >
          <span className="font-semibold">Error: </span>{submitError}
        </div>
      )}

      {/* Ticker */}
      <div className="space-y-1">
        <label htmlFor="ticker" className="block text-sm font-medium text-neutral-300">
          Ticker Symbol <span className="text-red-500" aria-hidden>*</span>
        </label>
        <input
          id="ticker"
          type="text"
          name="ticker"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          placeholder="e.g. AAPL, TSLA, INTC"
          disabled={isSubmitting}
          value={ticker}
          onChange={(e) => {
            setTicker(e.target.value);
            if (fieldErrors.ticker) setFieldErrors({});
          }}
          aria-invalid={!!fieldErrors.ticker}
          aria-describedby={fieldErrors.ticker ? "ticker-error" : undefined}
          className={`w-full bg-neutral-950 border rounded px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600
            focus:outline-none focus:ring-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${fieldErrors.ticker
              ? "border-red-700 focus:ring-red-700"
              : "border-neutral-800 focus:ring-neutral-600"
            }`}
        />
        {fieldErrors.ticker && (
          <p id="ticker-error" role="alert" className="text-xs text-red-400">
            {fieldErrors.ticker}
          </p>
        )}
      </div>

      {/* Investment Horizon */}
      <div className="space-y-1">
        <label htmlFor="horizon" className="block text-sm font-medium text-neutral-300">
          Investment Horizon <span className="text-red-500" aria-hidden>*</span>
        </label>
        <select
          id="horizon"
          name="horizon"
          value={horizon}
          disabled={isSubmitting}
          onChange={(e) => setHorizon(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2.5 text-sm text-neutral-100
            focus:outline-none focus:ring-2 focus:ring-neutral-600
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {HORIZON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Risk Tolerance */}
      <div className="space-y-1">
        <label htmlFor="risk" className="block text-sm font-medium text-neutral-300">
          Risk Tolerance <span className="text-red-500" aria-hidden>*</span>
        </label>
        <select
          id="risk"
          name="risk"
          value={risk}
          disabled={isSubmitting}
          onChange={(e) => setRisk(e.target.value as RiskTolerance)}
          className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2.5 text-sm text-neutral-100
            focus:outline-none focus:ring-2 focus:ring-neutral-600
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {RISK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-white hover:bg-neutral-100 active:bg-neutral-200 text-black font-semibold
          rounded px-4 py-3 text-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-neutral-500
          disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? "Initiating research pipeline…" : "Run Research"}
      </button>
    </form>
  );
}
