import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getNewsApiKey } from "@/src/lib/env";

const BASE_URL = "https://newsapi.org/v2";

const getApiKey = () => {
  try {
    return getNewsApiKey();
  } catch {
    return null;
  }
};

export const newsApiProvider = {
  name: "NewsAPI",

  async getRecentArticles(companyName: string): Promise<EndpointResult> {
    const key = getApiKey();
    
    // 30 days window
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const toStr = toDate.toISOString().split("T")[0];
    const fromStr = fromDate.toISOString().split("T")[0];

    // Quote name query for exact matches where possible
    const query = `"${companyName}"`;

    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&from=${fromStr}&sortBy=publishedAt&pageSize=10&apiKey=${key}`;
    const result = await fetchJson({
      provider: "NewsAPI",
      endpointName: "Recent Articles",
      url,
      query,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (Array.isArray(rawObj.articles)) {
        result.response.data = rawObj.articles.map((item: any) => ({
          title: item.title,
          source: item.source?.name,
          author: item.author,
          publishedAt: item.publishedAt,
          description: item.description,
          url: item.url,
        }));
      }
    }
    return result;
  },
};
