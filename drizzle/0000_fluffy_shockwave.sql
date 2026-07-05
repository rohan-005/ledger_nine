CREATE TABLE "agent_runs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"research_id" varchar(64) NOT NULL,
	"agent_id" varchar(128) NOT NULL,
	"provider" varchar(64),
	"model" varchar(128),
	"status" varchar(32) NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"latency_ms" integer,
	"error_message" text,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(64) NOT NULL,
	"cache_key" varchar(256) NOT NULL,
	"request_fingerprint" varchar(256) NOT NULL,
	"payload" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contradictions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"research_id" varchar(64) NOT NULL,
	"evidence_id_a" varchar(64) NOT NULL,
	"evidence_id_b" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(32) NOT NULL,
	"confidence" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"research_id" varchar(64) NOT NULL,
	"claim" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_url" text,
	"source_title" text,
	"raw_value" text,
	"normalized_value" numeric,
	"confidence" numeric NOT NULL,
	"source_quality" numeric NOT NULL,
	"agent_id" varchar(128) NOT NULL,
	"observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"research_id" varchar(64) NOT NULL,
	"thesis" text NOT NULL,
	"bull_case" text NOT NULL,
	"bear_case" text NOT NULL,
	"key_risks" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_reports_research_id_unique" UNIQUE("research_id")
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ticker" varchar(16) NOT NULL,
	"company_name" varchar(256),
	"investment_horizon" varchar(64) NOT NULL,
	"risk_tolerance" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"current_node" varchar(128),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_scores" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"research_id" varchar(64) NOT NULL,
	"business" numeric NOT NULL,
	"financial" numeric NOT NULL,
	"valuation" numeric NOT NULL,
	"news" numeric NOT NULL,
	"risk" numeric NOT NULL,
	"evidence_quality" numeric NOT NULL,
	"contradiction_penalty" numeric NOT NULL,
	"final_score" numeric NOT NULL,
	"decision" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_scores_research_id_unique" UNIQUE("research_id")
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_research_id_research_runs_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradictions" ADD CONSTRAINT "contradictions_research_id_research_runs_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_research_id_research_runs_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_research_id_research_runs_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_scores" ADD CONSTRAINT "research_scores_research_id_research_runs_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_research_id_idx" ON "agent_runs" USING btree ("research_id");--> statement-breakpoint
CREATE INDEX "api_cache_cache_key_idx" ON "api_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "api_cache_expires_at_idx" ON "api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contradictions_research_id_idx" ON "contradictions" USING btree ("research_id");--> statement-breakpoint
CREATE INDEX "evidence_research_id_idx" ON "evidence" USING btree ("research_id");--> statement-breakpoint
CREATE INDEX "evidence_category_idx" ON "evidence" USING btree ("category");--> statement-breakpoint
CREATE INDEX "evidence_source_type_idx" ON "evidence" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "research_runs_ticker_idx" ON "research_runs" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "research_runs_status_idx" ON "research_runs" USING btree ("status");