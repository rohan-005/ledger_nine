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
  { endpointName: "Overview", querySuffix: "overview core business model and products" },
  { endpointName: "Developments", querySuffix: "recent developments key news events last 30 days" },
  { endpointName: "Outlook", querySuffix: "future outlook growth drivers strategic expansion" },
  { endpointName: "Risks", querySuffix: "core investment risks major challenges threats audit" },
  { endpointName: "Competitors", querySuffix: "industry competitors peers competitive advantage" },
];

export const tavilyProvider = {
  name: "Tavily",

  /**
   * Executes 5 specialized parallel queries for a company.
   */
  async getDiagnostics(companyName: string): Promise<EndpointResult[]> {
    const key = getApiKey();

    const tasks = TOPICS.map(async (topic) => {
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
          search_depth: "advanced",
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

      return result;
    });

    return Promise.all(tasks);
  },
};
