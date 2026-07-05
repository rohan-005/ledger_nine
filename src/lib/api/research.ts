import { apiFetch } from "./client";
import {
  ResearchRequest,
  CreateResearchResponse,
  ResearchSummary,
  ResearchStatusResponse,
  EvidenceItem,
  AgentRun,
  Contradiction,
} from "@/src/types/frontend";

export async function createResearch(
  input: ResearchRequest,
  signal?: AbortSignal
): Promise<CreateResearchResponse> {
  return apiFetch<CreateResearchResponse>("/api/research", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
}

export async function getResearch(
  id: string,
  signal?: AbortSignal
): Promise<ResearchSummary> {
  return apiFetch<ResearchSummary>(`/api/research/${id}`, { signal });
}

export async function getResearchStatus(
  id: string,
  signal?: AbortSignal
): Promise<ResearchStatusResponse> {
  return apiFetch<ResearchStatusResponse>(`/api/research/${id}/status`, {
    signal,
  });
}

export async function getResearchEvidence(
  id: string,
  signal?: AbortSignal
): Promise<{ evidence: EvidenceItem[] }> {
  return apiFetch<{ evidence: EvidenceItem[] }>(
    `/api/research/${id}/evidence`,
    { signal }
  );
}

export async function getResearchAgents(
  id: string,
  signal?: AbortSignal
): Promise<{ agentRuns: AgentRun[] }> {
  return apiFetch<{ agentRuns: AgentRun[] }>(`/api/research/${id}/agents`, {
    signal,
  });
}

export async function getResearchContradictions(
  id: string,
  signal?: AbortSignal
): Promise<{ contradictions: Contradiction[] }> {
  return apiFetch<{ contradictions: Contradiction[] }>(
    `/api/research/${id}/contradictions`,
    { signal }
  );
}
