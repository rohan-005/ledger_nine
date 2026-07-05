import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ledger Nine — Autonomous Investment Research",
  description:
    "Evidence-driven investment analysis with deterministic scoring. Calm, professional, and research-focused.",
};

const SUGGESTIONS = [
  { ticker: "AAPL", name: "Apple" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "NVDA", name: "Nvidia" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "GOOGL", name: "Alphabet" },
];

const STEPS = [
  {
    num: "1",
    title: "Choose a company",
    desc: "Enter a stock symbol or name. Select your investment timeline and risk preference.",
    color: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    num: "2",
    title: "We gather evidence",
    desc: "Specialist agents extract primary facts from SEC filings, financial databases, and news articles.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    num: "3",
    title: "Audit contradictions",
    desc: "A consensus engine verifies claims across sources, detecting conflicts and applying scoring penalties.",
    color: "bg-amber-50 text-amber-700 border-amber-100",
  },
  {
    num: "4",
    title: "Get a clear report",
    desc: "Review a plain-English synthesis, balanced scorecards, and the deterministic investment verdict.",
    color: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
];

export default function HomePage() {
  return (
    <div className="flex-1 bg-background">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-border text-xs font-semibold text-foreground-secondary shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Autonomous Investment Analysis
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
          Understand a company<br />before you invest
        </h1>
        <p className="text-lg text-foreground-secondary max-w-2xl mx-auto leading-relaxed">
          Get a clear, evidence-backed view of a company’s financial health, valuation, business strength, risks, and recent developments.
        </p>
        <div className="flex flex-col items-center gap-4 pt-4">
          <Link
            href="/research/new"
            className="inline-flex items-center justify-center px-8 py-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl text-base shadow-sm transition-all hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Research a Company
          </Link>
          <p className="text-xs text-foreground-muted max-w-md">
            Built from financial data, company filings, recent developments, and multiple independent analysis steps.
          </p>
        </div>
      </section>

      {/* Suggested Companies */}
      <section className="max-w-4xl mx-auto px-6 pb-16 text-center">
        <h2 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4">
          Popular companies to research
        </h2>
        <div className="flex flex-wrap gap-2 justify-center">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.ticker}
              href={`/research/new?ticker=${s.ticker}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-border hover:border-foreground-muted/50 text-sm font-medium text-foreground hover:text-primary transition-all shadow-xs"
            >
              <span className="font-mono font-bold text-foreground-secondary">{s.ticker}</span>
              <span className="text-foreground-muted text-xs">({s.name})</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Process Section */}
      <section className="border-t border-border bg-white py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
              Our Research Process
            </h2>
            <p className="text-sm text-foreground-secondary max-w-lg mx-auto">
              How Ledger Nine builds a trustworthy, objective investment analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="relative bg-background border border-border rounded-2xl p-6 space-y-4 shadow-xs"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border ${s.color}`}>
                  {s.num}
                </div>
                <h3 className="font-bold text-foreground text-base tracking-tight">{s.title}</h3>
                <p className="text-xs text-foreground-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}