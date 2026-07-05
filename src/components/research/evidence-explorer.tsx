"use client";

import { useState, useMemo } from "react";
import { EvidenceItem, EvidenceCategory, EvidenceSourceType } from "@/src/types/frontend";

const SOURCE_LABELS: Record<string, string> = {
  sec: "Primary (SEC Filing)",
  fmp: "Parsed Financial (FMP)",
  tavily: "Web / News (Tavily)",
  alpha_vantage: "Supplemental (Alpha Vantage)",
  llm_inference: "LLM Inference",
};

const CATEGORY_OPTIONS: Array<"all" | EvidenceCategory> = [
  "all", "business", "financial", "valuation", "news", "risk",
];
const SOURCE_OPTIONS: Array<"all" | EvidenceSourceType> = [
  "all", "sec", "fmp", "tavily", "alpha_vantage", "llm_inference",
];

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-600 ${
        active
          ? "bg-white text-black border-white"
          : "bg-transparent text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const conf = parseFloat(item.confidence);
  const qual = parseFloat(item.sourceQuality);

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-2 hover:border-neutral-700 transition-colors">
      <p className="text-neutral-100 text-sm leading-relaxed">{item.claim}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>
          <span className="text-neutral-400 font-medium">Category:</span>{" "}
          <span className="capitalize">{item.category}</span>
        </span>
        <span>
          <span className="text-neutral-400 font-medium">Source:</span>{" "}
          {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
        </span>
        {!isNaN(conf) && (
          <span>
            <span className="text-neutral-400 font-medium">Confidence:</span>{" "}
            {(conf * 100).toFixed(0)}%
          </span>
        )}
        {!isNaN(qual) && (
          <span>
            <span className="text-neutral-400 font-medium">Quality:</span>{" "}
            {(qual * 100).toFixed(0)}%
          </span>
        )}
        <span>
          <span className="text-neutral-400 font-medium">Agent:</span>{" "}
          <span className="font-mono">{item.agentId}</span>
        </span>
        {item.observedAt && (
          <span>
            <span className="text-neutral-400 font-medium">Observed:</span>{" "}
            {new Date(item.observedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {item.sourceTitle && (
        <p className="text-xs text-neutral-500 italic truncate" title={item.sourceTitle}>
          {item.sourceTitle}
        </p>
      )}

      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
          aria-label={`Open source: ${item.sourceTitle ?? item.sourceUrl}`}
        >
          View Source ↗
        </a>
      ) : (
        <span className="text-xs text-neutral-600">No external source link</span>
      )}
    </div>
  );
}

export default function EvidenceExplorer({ evidence }: { evidence: EvidenceItem[] }) {
  const [categoryFilter, setCategoryFilter] = useState<"all" | EvidenceCategory>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | EvidenceSourceType>("all");

  const filtered = useMemo(() => {
    return evidence.filter((item) => {
      const catOk = categoryFilter === "all" || item.category === categoryFilter;
      const srcOk = sourceFilter === "all" || item.sourceType === sourceFilter;
      return catOk && srcOk;
    });
  }, [evidence, categoryFilter, sourceFilter]);

  return (
    <section id="evidence" aria-labelledby="evidence-heading" className="space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2 flex-wrap gap-2">
        <h2 id="evidence-heading" className="text-lg font-bold text-neutral-100">
          Evidence Explorer
        </h2>
        <span className="text-sm text-neutral-500">
          {filtered.length} / {evidence.length} items
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1.5 font-medium">Category</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {CATEGORY_OPTIONS.map((cat) => (
              <FilterButton
                key={cat}
                label={cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat as "all" | EvidenceCategory)}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1.5 font-medium">Source</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
            {SOURCE_OPTIONS.map((src) => (
              <FilterButton
                key={src}
                label={src === "all" ? "All" : src.replace("_", " ").toUpperCase()}
                active={sourceFilter === src}
                onClick={() => setSourceFilter(src as "all" | EvidenceSourceType)}
              />
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4">
          No evidence matches the selected filters.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <EvidenceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
