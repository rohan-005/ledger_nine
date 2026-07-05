import { Evidence, EvidenceCategory, EvidenceSourceType } from "./evidence.types";

export class EvidencePool {
  private readonly items: readonly Evidence[];

  constructor(items: readonly Evidence[] = []) {
    this.items = Object.freeze([...items]);
  }

  public append(item: Evidence): EvidencePool {
    const clampedItem = this.clamp(item);
    return new EvidencePool([...this.items, clampedItem]);
  }

  public appendMany(newItems: Evidence[]): EvidencePool {
    const clampedItems = newItems.map(item => this.clamp(item));
    return new EvidencePool([...this.items, ...clampedItems]);
  }

  public list(): readonly Evidence[] {
    return this.items;
  }

  public byCategory(category: EvidenceCategory): Evidence[] {
    return this.items.filter(item => item.category === category);
  }

  public bySourceType(sourceType: EvidenceSourceType): Evidence[] {
    return this.items.filter(item => item.sourceType === sourceType);
  }

  public byAgent(agentId: string): Evidence[] {
    return this.items.filter(item => item.agentId === agentId);
  }

  public findById(id: string): Evidence | undefined {
    return this.items.find(item => item.id === id);
  }

  public deduplicate(): EvidencePool {
    const seenKeys = new Set<string>();
    const deduplicated: Evidence[] = [];

    for (const item of this.items) {
      // Normalize claim for conservative semantic check (lowercase + alphanumeric only)
      const normalizedClaim = item.claim.toLowerCase().replace(/[^a-z0-9]/g, "");
      const dupKey = `${item.category}_${item.sourceType}_${normalizedClaim}`;
      
      if (!seenKeys.has(dupKey)) {
        seenKeys.add(dupKey);
        deduplicated.push(item);
      }
    }

    return new EvidencePool(deduplicated);
  }

  private clamp(item: Evidence): Evidence {
    return {
      ...item,
      confidence: Math.max(0, Math.min(1, item.confidence)),
      sourceQuality: Math.max(0, Math.min(1, item.sourceQuality)),
    };
  }
}
