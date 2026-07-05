import { ApiError } from "@/src/types/frontend";

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw { error: "Network request failed. Check your connection." } as ApiError;
  }

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    let details: unknown = null;
    try {
      const json = await response.json();
      if (json) {
        if (typeof json.error === "string") {
          errorMsg = json.error;
        } else if (json.error && typeof json.error.message === "string") {
          errorMsg = json.error.message;
        }
        if (json.details) details = json.details;
      }
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    throw { error: errorMsg, details } as ApiError;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw { error: "Received malformed response from server." } as ApiError;
  }
}
