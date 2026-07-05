import { pgTable, varchar, text, timestamp, boolean, integer, numeric, index } from "drizzle-orm/pg-core";

// A. research_runs
export const researchRuns = pgTable(
  "research_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ticker: varchar("ticker", { length: 16 }).notNull(),
    companyName: varchar("company_name", { length: 256 }),
    investmentHorizon: varchar("investment_horizon", { length: 64 }).notNull(),
    riskTolerance: varchar("risk_tolerance", { length: 32 }).notNull(), // "low" | "moderate" | "high"
    status: varchar("status", { length: 32 }).notNull(), // "queued" | "running" | "completed" | "failed"
    currentNode: varchar("current_node", { length: 128 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("research_runs_ticker_idx").on(table.ticker),
    index("research_runs_status_idx").on(table.status),
  ]
);

// B. agent_runs
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    researchId: varchar("research_id", { length: 64 })
      .notNull()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    agentId: varchar("agent_id", { length: 128 }).notNull(),
    provider: varchar("provider", { length: 64 }),
    model: varchar("model", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull(), // "started" | "completed" | "failed"
    fallbackUsed: boolean("fallback_used").default(false).notNull(),
    fallbackReason: text("fallback_reason"),
    latencyMs: integer("latency_ms"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_runs_research_id_idx").on(table.researchId),
  ]
);

// C. evidence
export const evidence = pgTable(
  "evidence",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    researchId: varchar("research_id", { length: 64 })
      .notNull()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    claim: text("claim").notNull(),
    category: varchar("category", { length: 64 }).notNull(), // "business" | "financial" | "valuation" | "news" | "risk"
    sourceType: varchar("source_type", { length: 64 }).notNull(), // "sec" | "fmp" | "tavily" | "alpha_vantage" | "llm_inference"
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    rawValue: text("raw_value"), // Store as stringified JSON or text
    normalizedValue: numeric("normalized_value"),
    confidence: numeric("confidence").notNull(), // Clamp 0..1
    sourceQuality: numeric("source_quality").notNull(), // Clamp 0..1
    agentId: varchar("agent_id", { length: 128 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("evidence_research_id_idx").on(table.researchId),
    index("evidence_category_idx").on(table.category),
    index("evidence_source_type_idx").on(table.sourceType),
  ]
);

// D. contradictions
export const contradictions = pgTable(
  "contradictions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    researchId: varchar("research_id", { length: 64 })
      .notNull()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    evidenceIdA: varchar("evidence_id_a", { length: 64 }).notNull(),
    evidenceIdB: varchar("evidence_id_b", { length: 64 }).notNull(),
    description: text("description").notNull(),
    severity: varchar("severity", { length: 32 }).notNull(), // "low" | "medium" | "high"
    confidence: numeric("confidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("contradictions_research_id_idx").on(table.researchId),
  ]
);

// E. research_scores
export const researchScores = pgTable(
  "research_scores",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    researchId: varchar("research_id", { length: 64 })
      .notNull()
      .unique()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    business: numeric("business").notNull(),
    financial: numeric("financial").notNull(),
    valuation: numeric("valuation").notNull(),
    news: numeric("news").notNull(),
    risk: numeric("risk").notNull(),
    evidenceQuality: numeric("evidence_quality").notNull(),
    contradictionPenalty: numeric("contradiction_penalty").notNull(),
    finalScore: numeric("final_score").notNull(),
    decision: varchar("decision", { length: 32 }).notNull(), // "INVEST" | "PASS"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

// F. research_reports
export const researchReports = pgTable(
  "research_reports",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    researchId: varchar("research_id", { length: 64 })
      .notNull()
      .unique()
      .references(() => researchRuns.id, { onDelete: "cascade" }),
    thesis: text("thesis").notNull(),
    bullCase: text("bull_case").notNull(), // Stringified JSON array
    bearCase: text("bear_case").notNull(), // Stringified JSON array
    keyRisks: text("key_risks").notNull(), // Stringified JSON array
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

// G. api_cache
export const apiCache = pgTable(
  "api_cache",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    cacheKey: varchar("cache_key", { length: 256 }).notNull(),
    requestFingerprint: varchar("request_fingerprint", { length: 256 }).notNull(),
    payload: text("payload").notNull(), // Stringified JSON response
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("api_cache_cache_key_idx").on(table.cacheKey),
    index("api_cache_expires_at_idx").on(table.expiresAt),
  ]
);
