"use client";

import React from "react";
import { Contradiction, EvidenceItem } from "@/src/types/frontend";
import { getFriendlySourceName } from "@/src/lib/presentation/helpers";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

function SeverityBadge({ severity }: { severity: string }) {
  let classes = "bg-gray-50 text-gray-700 border-gray-200";
  if (severity === "high") {
    classes = "bg-red-50 text-red-700 border-red-200";
  } else if (severity === "medium") {
    classes = "bg-amber-50 text-amber-750 border-amber-200";
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border capitalize ${classes}`}>
      {severity} severity
    </span>
  );
}

interface ContradictionListProps {
  contradictions: Contradiction[];
  evidenceMap: Map<string, EvidenceItem>;
}

export default function ContradictionList({
  contradictions,
  evidenceMap,
}: ContradictionListProps) {
  return (
    <section id="contradictions" aria-labelledby="contradictions-heading" className="space-y-6">
      <div className="border-b border-border pb-2 flex items-center justify-between">
        <h2 id="contradictions-heading" className="text-xl font-bold text-foreground">
          Where the evidence disagrees
        </h2>
        {contradictions.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 rounded-md">
            {contradictions.length} conflict{contradictions.length > 1 ? "s" : ""} detected
          </span>
        )}
      </div>

      <p className="text-sm text-foreground-secondary max-w-2xl leading-relaxed">
        Our consensus engine cross-references all statements gathered by our agents. When statements are found to be conflicting (e.g. mismatched financial ratios, opposing news summaries, conflicting revenue numbers), they are flagged below and a scoring penalty is automatically subtracted from the final rating.
      </p>

      {contradictions.length === 0 ? (
        <Card className="bg-white text-sm text-foreground-secondary py-6 text-center">
          ✓ No conflicting facts or contradictions detected. The data gathered across different channels is consistent.
          <p className="text-xs text-foreground-muted mt-1.5 font-normal">
            (Note: The absence of contradictions does not guarantee that the business has zero risks.)
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {contradictions.map((ct) => {
            const evA = evidenceMap.get(ct.evidenceIdA);
            const evB = evidenceMap.get(ct.evidenceIdB);
            const conf = parseFloat(ct.confidence);

            return (
              <Card key={ct.id} className="bg-white border border-border p-6 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-border/60">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-bold text-foreground leading-relaxed">
                      {ct.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SeverityBadge severity={ct.severity} />
                    <span className="text-xs text-foreground-secondary font-mono font-semibold">
                      Audit confidence: {isNaN(conf) ? "—" : (conf * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Claim A", ev: evA, id: ct.evidenceIdA },
                    { label: "Claim B", ev: evB, id: ct.evidenceIdB },
                  ].map(({ label, ev, id }) => (
                    <div
                      key={id}
                      className="bg-background rounded-xl border border-border p-4 space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                          {label}
                        </span>
                        {ev ? (
                          <p className="text-xs font-semibold text-foreground leading-relaxed">
                            "{ev.claim}"
                          </p>
                        ) : (
                          <p className="text-xs font-mono text-foreground-muted">
                            Evidence ID: {id} (Not found in filtered list)
                          </p>
                        )}
                      </div>
                      
                      {ev && (
                        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-foreground-muted font-mono">
                          <span>Source: {getFriendlySourceName(ev.sourceType)}</span>
                          <span>Agent: {ev.agentId}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
