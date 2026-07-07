import type { Metadata } from "next";
import DiagnosticsDashboard from "@/src/components/diagnostics/DiagnosticsDashboard";

export const metadata: Metadata = {
  title: "Ledger Nine — Multi-Provider Diagnostics Dashboard",
  description: "Transparent multi-provider company data diagnostics platform. Resolve symbols, validate candidates, and fetch live financial data.",
};

export default function HomePage() {
  return (
    <div className="flex-1 bg-background min-h-screen">
      <main className="py-6">
        <DiagnosticsDashboard />
      </main>
    </div>
  );
}