import "server-only";

export type ProviderEndpointStatus =
  | "success"
  | "partial"
  | "empty"
  | "rate_limit"
  | "auth_error"
  | "unsupported"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "plan_limited"
  | "plan_limit"
  | "malformed_response"
  | "permission_error"
  | "unsupported_market"
  | "unsupported_symbol"
  | "not_applicable";

export interface EndpointResult {
  provider: string;
  endpointName: string;
  status: ProviderEndpointStatus;
  ok: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  httpStatus: number | null;
  request: {
    endpoint: string;
    method: string;
    symbolRequested: string | null;
    symbolUsed: string | null;
    candidatesTried: string[];
    query: string | null;
  };
  response: {
    recordCount: number | null;
    data: unknown; // Normalized data
    raw: unknown;  // Raw data with secrets redacted
  };
  error: {
    code: string | null;
    message: string;
  } | null;
}

export interface ProviderSummary {
  provider: string;
  status: ProviderEndpointStatus;
  durationMs: number;
  endpoints: EndpointResult[];
  symbolUsed: string | null;
  candidatesTried: string[];
}
