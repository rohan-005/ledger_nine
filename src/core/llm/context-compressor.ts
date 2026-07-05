import { Evidence } from "../evidence/evidence.types";

interface CompressOptions {
  maxCharacters?: number;
  relevantCategory?: string;
}

/**
 * Deterministically compresses the evidence pool to fit within token/character limits.
 * Sorting priority:
 * 1. SEC > FMP > Tavily > Alpha Vantage > LLM inference
 * 2. Matches target agent's research category
 * 3. High confidence and source quality
 */
export function compressContext(evidence: readonly Evidence[], options: CompressOptions = {}): Evidence[] {
  const maxChars = options.maxCharacters ?? 8000;
  const category = options.relevantCategory;

  const scored = evidence.map((item) => {
    let sourceScore = 0;
    if (item.sourceType === "sec") sourceScore = 100;
    else if (item.sourceType === "fmp") sourceScore = 80;
    else if (item.sourceType === "tavily") sourceScore = 60;
    else if (item.sourceType === "alpha_vantage") sourceScore = 40;
    else if (item.sourceType === "llm_inference") sourceScore = 20;

    let categoryScore = 0;
    if (category && item.category === category) {
      categoryScore = 50;
    }

    const priorityScore = sourceScore + categoryScore + item.confidence * 10 + item.sourceQuality * 10;

    return { item, priorityScore };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  const selected: Evidence[] = [];
  let currentLength = 0;

  for (const entry of scored) {
    const serialized = JSON.stringify(entry.item);
    if (currentLength + serialized.length > maxChars) {
      continue; // Skip to see if a smaller item fits
    }
    selected.push(entry.item);
    currentLength += serialized.length;
  }

  return selected;
}
