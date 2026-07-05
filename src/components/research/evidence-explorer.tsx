"use client";

import React, { useState, useMemo } from "react";
import { EvidenceItem, EvidenceCategory, EvidenceSourceType } from "@/src/types/frontend";
import { getFriendlySourceName } from "@/src/lib/presentation/helpers";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";
import { EvidenceSourceMixChart, EvidenceCategoryMixChart } from "./charts";

const CATEGORY_OPTIONS: Array<"all" | EvidenceCategory> = [
  "all",
  "business",
  "financial",
  "valuation",
  "news",
  "risk",
];
const SOURCE_OPTIONS: Array<"all" | EvidenceSourceType> = [
  "all",
  "sec",
  "fmp",
  "tavily",
  "alpha_vantage",
  "llm_inference",
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
      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        active
          ? "bg-primary text-white border-primary shadow-xs"
          : "bg-white text-foreground-secondary border-border hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function MetricBadge({ label, value }: { label: string; value: number }) {
  let colorClass = "bg-red-50 text-red-700 border-red-100";
  if (value >= 75) {
    colorClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
  } else if (value >= 50) {
    colorClass = "bg-amber-50 text-amber-700 border-amber-100";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${colorClass}`}>
      {label}: {value}%
    </span>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const conf = parseFloat(item.confidence);
  const qual = parseFloat(item.sourceQuality);
  const friendlySource = getFriendlySourceName(item.sourceType);

  return (
    <Card className="hover:border-foreground-secondary/40 transition-colors p-5 space-y-3 bg-white">
      <p className="text-foreground text-sm font-medium leading-relaxed">
        {item.claim}
      </p>

      <div className="flex flex-wrap gap-2 text-xs items-center">
        <span className="px-2 py-0.5 rounded-md bg-background border border-border text-foreground-secondary text-[10px] font-bold uppercase tracking-wider">
          {item.category}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-background border border-border text-foreground-secondary text-[10px] font-bold">
          {friendlySource}
        </span>
        {!isNaN(conf) && <MetricBadge label="Confidence" value={Math.round(conf * 100)} />}
        {!isNaN(qual) && <MetricBadge label="Quality" value={Math.round(qual * 100)} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2 text-[10px] text-foreground-muted">
        <span>
          Collected by: <span className="font-mono text-foreground-secondary">{item.agentId}</span>
        </span>
        {item.observedAt && (
          <span>
            Observed: {new Date(item.observedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {item.sourceTitle && (
        <p className="text-[11px] text-foreground-secondary italic truncate" title={item.sourceTitle}>
          Document title: {item.sourceTitle}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
            aria-label={`Open source document: ${item.sourceTitle ?? item.sourceUrl}`}
          >
            View Source Document ↗
          </a>
        ) : (
          <span className="text-[11px] text-foreground-muted">
            {item.sourceType === "sec" && "Source: SEC Regulatory Filing"}
            {item.sourceType === "fmp" && "Source: Financial Data Provider"}
            {item.sourceType === "tavily" && "Source: Web Research"}
            {item.sourceType === "alpha_vantage" && "Source: Market Data Provider"}
            {item.sourceType === "llm_inference" && "Source: Analytical Context"}
            {!["sec", "fmp", "tavily", "alpha_vantage", "llm_inference"].includes(item.sourceType) && "Source: External research"}
          </span>
        )}
      </div>
    </Card>
  );
}

export default function EvidenceExplorer({ evidence, hideCharts = false }: { evidence: EvidenceItem[]; hideCharts?: boolean }) {
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
    <section id="evidence" aria-labelledby="evidence-heading" className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-2 flex-wrap gap-2">
        <h2 id="evidence-heading" className="text-xl font-bold text-foreground">
          Sources behind this report
        </h2>
        <span className="text-xs font-bold px-2 py-0.5 bg-background border border-border text-foreground-secondary rounded-md">
          {filtered.length} of {evidence.length} facts showing
        </span>
      </div>

      <p className="text-sm text-foreground-secondary max-w-2xl leading-relaxed">
        The table below lists all distinct facts gathered by our specialist research agents, along with confidence ratings, source metrics, and links to verified SEC or web source material.
      </p>

      {/* Visual Mix Charts */}
      {!hideCharts && evidence.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white">
            <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-2">
              Evidence Source Distribution
            </h3>
            <EvidenceSourceMixChart evidence={evidence} />
          </Card>
          <Card className="bg-white">
            <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-2">
              Evidence Category Concentration
            </h3>
            <EvidenceCategoryMixChart evidence={evidence} />
          </Card>
        </div>
      )}

      {/* Filters Panel */}
      <Card className="bg-white space-y-4">
        <div>
          <p className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-2">
            Filter by Category
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {CATEGORY_OPTIONS.map((cat) => (
              <FilterButton
                key={cat}
                label={cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat as "all" | EvidenceCategory)}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-2">
            Filter by Source Provider
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
            {SOURCE_OPTIONS.map((src) => (
              <FilterButton
                key={src}
                label={src === "all" ? "All Sources" : getFriendlySourceName(src)}
                active={sourceFilter === src}
                onClick={() => setSourceFilter(src as "all" | EvidenceSourceType)}
              />
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground-secondary py-8 text-center bg-white border border-border rounded-2xl">
          No facts match the selected filters. Change filters to view evidence.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <EvidenceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
