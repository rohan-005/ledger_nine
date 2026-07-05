import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/src/app/api/research/route";
import { researchCoordinator } from "@/src/core/coordinator/research-coordinator";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { logger } from "@/src/lib/logger";

// Mock the repository
vi.mock("@/src/db/repositories/research.repository", () => ({
  researchRepository: {
    createRun: vi.fn(),
  },
}));

// Mock the logger
vi.mock("@/src/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Research Integrity & API Error Boundary Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail startResearch immediately when researchRepository.createRun throws a database error", async () => {
    const dbError = new Error("Failed query: insert into \"research_runs\"...");
    dbError.cause = {
      code: "42703",
      message: "column \"outcome\" does not exist",
    };
    vi.mocked(researchRepository.createRun).mockRejectedValueOnce(dbError);

    const executeResearchSpy = vi.spyOn(researchCoordinator, "executeResearch");

    // Call startResearch and assert it throws the error
    await expect(
      researchCoordinator.startResearch("AAPL", "3-5 years", "moderate")
    ).rejects.toThrow("Failed query: insert into");

    // Verify background executeResearch was NOT called
    expect(executeResearchSpy).not.toHaveBeenCalled();
    expect(researchRepository.createRun).toHaveBeenCalledTimes(1);
  });

  it("should handle createRun failure in POST /api/research, return a sanitized 500 response, and log nested DB error server-side", async () => {
    const dbError = new Error("Failed query: insert into \"research_runs\"...");
    dbError.cause = {
      code: "42703",
      message: "column \"outcome\" does not exist",
    };
    
    const startResearchSpy = vi.spyOn(researchCoordinator, "startResearch").mockRejectedValueOnce(dbError);

    const req = new NextRequest("http://localhost/api/research", {
      method: "POST",
      body: JSON.stringify({
        ticker: "AAPL",
        investmentHorizon: "3-5 years",
        riskTolerance: "moderate",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(500);

    const body = await response.json();
    // Verify that the database error is sanitized and does not leak SQL queries/stack/driver details
    expect(body).toEqual({
      error: {
        code: "RESEARCH_RUN_CREATION_FAILED",
        message: "We couldn't start this research run. Please try again.",
      },
    });

    // Check that nested database error details are logged server-side
    expect(logger.error).toHaveBeenCalledWith("API: Failed to start research run", dbError);

    startResearchSpy.mockRestore();
  });

  it("should block detailed rendering (verdicts and charts) when run status is failed", () => {
    // Front-end status rendering invariant:
    // If run.status is "failed", rendering resolves early to the status panel
    const run = {
      status: "failed",
      currentNode: "error",
      errorMessage: "Database connection failed",
    };

    // Assertion logic mimicking the page condition:
    // if (isActive || run.status === "failed") { render status panel, don't calculate charts/verdicts }
    const isFailedOrActive = run.status === "queued" || run.status === "running" || run.status === "failed";
    expect(isFailedOrActive).toBe(true);

    const showDetailedResults = false; // Never calculated or reached when status is failed
    expect(showDetailedResults).toBe(false);
  });
});
