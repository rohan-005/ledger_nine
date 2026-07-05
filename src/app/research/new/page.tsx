import type { Metadata } from "next";
import ResearchForm from "@/src/components/research/research-form";
import { Suspense } from "react";
import { Card } from "@/src/components/ui/card";

export const metadata: Metadata = {
  title: "New Research — Ledger Nine",
  description: "Submit a ticker and research parameters to start an autonomous investment analysis.",
};

export default function NewResearchPage() {
  return (
    <div className="max-w-xl mx-auto px-6 py-12 space-y-8 flex-1 flex flex-col justify-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">New Research</h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Enter a company or stock ticker to analyze. The autonomous agent pipeline typically completes the entire research run in 30–90 seconds.
        </p>
      </div>

      <Card>
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-foreground-muted">Loading research parameters...</div>}>
          <ResearchForm />
        </Suspense>
      </Card>

      <div className="border border-border bg-white rounded-xl p-5 text-xs text-foreground-secondary space-y-2.5 shadow-xs">
        <p className="font-bold text-foreground">Pipeline workflow breakdown:</p>
        <ul className="space-y-1.5 list-inside list-disc">
          <li>A unique research run is created and queued in the execution engine.</li>
          <li>Specialist agents extract primary facts from SEC filings, financial databases, and news articles.</li>
          <li>A consensus engine detects contradictions across agent findings, applying penalties.</li>
          <li>A deterministic scoring engine computes the final investment metrics and verdict.</li>
        </ul>
      </div>
    </div>
  );
}
