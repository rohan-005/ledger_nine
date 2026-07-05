ALTER TABLE "research_scores" ALTER COLUMN "business" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "financial" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "valuation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "news" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "risk" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "evidence_quality" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "contradiction_penalty" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "final_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_scores" ALTER COLUMN "decision" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "outcome" varchar(64);--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "insufficiency_reasons" text;--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "research_limitations" text;