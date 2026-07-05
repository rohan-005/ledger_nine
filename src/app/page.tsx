import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ledger Nine — Autonomous Investment Research",
  description:
    "Evidence-driven multi-agent investment analysis with deterministic INVEST/PASS scoring.",
};

const FEATURES = [
  {
    title: "Multi-Agent Research",
    body: "Specialist agents analyze business quality, financials, valuation, macro news, and risk in parallel — each grounded in primary-source data.",
  },
  {
    title: "Primary-Source Evidence",
    body: "Research pulls directly from SEC EDGAR filings, Financial Modeling Prep, Alpha Vantage, and live web sources via Tavily. No invented data.",
  },
  {
    title: "Contradiction Detection",
    body: "A consensus engine audits evidence across agents. Conflicting claims are detected, scored by severity, and penalized in the final score.",
  },
  {
    title: "Deterministic INVEST / PASS",
    body: "The final decision is computed by a pure TypeScript scoring engine — not by an LLM. Weights, penalties, and thresholds are transparent and fixed.",
  },
];

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-16">
      {/* Hero */}
      <section className="space-y-6 text-center">
        <div className="inline-block border border-neutral-800 px-3 py-1 rounded text-xs font-mono text-neutral-500 tracking-widest uppercase">
          Multi-Agent · Evidence-Driven · Deterministic
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-neutral-100 leading-tight tracking-tight">
          Autonomous<br />Investment Research
        </h1>
        <p className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Evidence-driven multi-agent investment analysis with deterministic scoring.
          No fabricated data. No black-box opinions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/research/new"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded text-sm hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
          >
            Start Research
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-neutral-900" />

      {/* Features */}
      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border border-neutral-800 rounded-lg p-5 space-y-2 hover:border-neutral-700 transition-colors"
            >
              <h3 className="font-semibold text-neutral-100">{f.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="border border-neutral-800 rounded-lg p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold text-neutral-100">Ready to analyze a position?</h2>
        <p className="text-sm text-neutral-500">
          Enter a ticker, choose your horizon and risk profile, and let the research network run.
        </p>
        <Link
          href="/research/new"
          className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded text-sm hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
        >
          Start Research →
        </Link>
      </section>
    </div>
  );
}