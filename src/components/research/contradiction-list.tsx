import { Contradiction, EvidenceItem } from "@/src/types/frontend";

function SeverityBadge({ severity }: { severity: string }) {
  const classes =
    severity === "high"
      ? "bg-red-900/50 text-red-300 border-red-800"
      : severity === "medium"
      ? "bg-amber-900/50 text-amber-300 border-amber-800"
      : "bg-neutral-800 text-neutral-300 border-neutral-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}>
      {severity}
    </span>
  );
}

interface ContradictionListProps {
  contradictions: Contradiction[];
  evidenceMap: Map<string, EvidenceItem>;
}

export default function ContradictionList({ contradictions, evidenceMap }: ContradictionListProps) {
  return (
    <section id="contradictions" aria-labelledby="contradictions-heading" className="space-y-4">
      <h2 id="contradictions-heading" className="text-lg font-bold text-neutral-100 border-b border-neutral-800 pb-2">
        Contradictions
      </h2>

      {contradictions.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-400">
          No material contradictions detected in evidence.{" "}
          <span className="text-neutral-500">
            (Absence of contradictions does not imply the investment is safe.)
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {contradictions.map((ct) => {
            const evA = evidenceMap.get(ct.evidenceIdA);
            const evB = evidenceMap.get(ct.evidenceIdB);
            const conf = parseFloat(ct.confidence);

            return (
              <div key={ct.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-neutral-100 text-sm leading-relaxed flex-1">{ct.description}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={ct.severity} />
                    <span className="text-xs text-neutral-500 font-mono">
                      conf {isNaN(conf) ? "—" : (conf * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Evidence A", ev: evA, id: ct.evidenceIdA },
                    { label: "Evidence B", ev: evB, id: ct.evidenceIdB },
                  ].map(({ label, ev, id }) => (
                    <div key={id} className="bg-neutral-950 rounded border border-neutral-800 p-2 space-y-0.5">
                      <p className="text-neutral-500 font-semibold">{label}</p>
                      {ev ? (
                        <>
                          <p className="text-neutral-200 leading-snug">{ev.claim}</p>
                          <p className="text-neutral-500 font-mono">{ev.sourceType} · {ev.agentId}</p>
                        </>
                      ) : (
                        <p className="text-neutral-600 font-mono">{id}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
