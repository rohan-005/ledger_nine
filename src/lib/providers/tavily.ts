import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getTavilyApiKey } from "@/src/lib/env";

const BASE_URL = "https://api.tavily.com/search";

const getApiKey = () => {
  try {
    return getTavilyApiKey();
  } catch {
    return null;
  }
};

interface TavilyTopicConfig {
  endpointName: string;
  querySuffix: string;
}

const TOPICS: TavilyTopicConfig[] = [
  { endpointName: "Web Context", querySuffix: "recent business developments risks outlook" },
];

export const tavilyProvider = {
  name: "Tavily",

  /**
   * Executes a single basic query for a company to avoid rate limits.
   */
  async getDiagnostics(companyName: string): Promise<EndpointResult[]> {
    const key = getApiKey();
    const topic = TOPICS[0];
    const fullQuery = `"${companyName}" ${topic.querySuffix}`;
    
    const result = await fetchJson({
      provider: "Tavily",
      endpointName: topic.endpointName,
      url: BASE_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: key,
        query: fullQuery,
        search_depth: "basic",
        include_answer: true,
        max_results: 5,
      }),
      query: fullQuery,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      result.response.data = {
        answer: rawObj.answer || "",
        results: Array.isArray(rawObj.results)
          ? rawObj.results.map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.content,
            }))
          : [],
      };
    }

    return [result];
  },
};
