import type { Metadata } from "next";
import ResearchForm from "@/src/components/research/research-form";

export const metadata: Metadata = {
  title: "New Research — Ledger Nine",
  description: "Submit a ticker and research parameters to start an autonomous investment analysis.",
};

export default function NewResearchPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-neutral-100 tracking-tight">New Research</h1>
        <p className="text-sm text-neutral-500">
          Enter a ticker symbol and research parameters. The pipeline typically completes in 30–90 seconds.
        </p>
      </div>

      <ResearchForm />

      <div className="border border-neutral-900 rounded-lg p-4 text-xs text-neutral-600 space-y-1">
        <p className="font-semibold text-neutral-500">What happens next</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>A research run is created and queued</li>
          <li>Specialist agents collect evidence from SEC, FMP, Tavily and Alpha Vantage</li>
          <li>A consensus engine detects contradictions across agent findings</li>
          <li>A deterministic scoring engine computes the INVEST / PASS decision</li>
          <li>The investment committee synthesizes a written report</li>
        </ol>
      </div>
    </div>
  );
}
