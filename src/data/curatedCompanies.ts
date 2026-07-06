import { INDIAN_COMPANIES } from "./indianCompanies";

export interface CompanyCatalogItem {
  name: string;
  ticker: string;
  canonicalTicker: string;
  exchange: string;
  country: string;
  aliases: string[];
}

export const US_COMPANIES: CompanyCatalogItem[] = [
  { name: "Apple Inc.", ticker: "AAPL", canonicalTicker: "AAPL", exchange: "NASDAQ", country: "US", aliases: ["Apple", "Mac", "iPhone"] },
  { name: "Microsoft Corporation", ticker: "MSFT", canonicalTicker: "MSFT", exchange: "NASDAQ", country: "US", aliases: ["Microsoft", "Windows", "Xbox"] },
  { name: "NVIDIA Corporation", ticker: "NVDA", canonicalTicker: "NVDA", exchange: "NASDAQ", country: "US", aliases: ["Nvidia", "Geforce"] },
  { name: "Tesla, Inc.", ticker: "TSLA", canonicalTicker: "TSLA", exchange: "NASDAQ", country: "US", aliases: ["Tesla", "Elon Musk"] },
  { name: "Amazon.com, Inc.", ticker: "AMZN", canonicalTicker: "AMZN", exchange: "NASDAQ", country: "US", aliases: ["Amazon", "AWS"] },
  { name: "Alphabet Inc.", ticker: "GOOGL", canonicalTicker: "GOOGL", exchange: "NASDAQ", country: "US", aliases: ["Google", "Alphabet", "YouTube"] },
  { name: "Meta Platforms, Inc.", ticker: "META", canonicalTicker: "META", exchange: "NASDAQ", country: "US", aliases: ["Meta", "Facebook", "Instagram", "WhatsApp"] },
  { name: "Eli Lilly and Company", ticker: "LLY", canonicalTicker: "LLY", exchange: "NYSE", country: "US", aliases: ["Eli Lilly", "Lilly"] },
  { name: "Broadcom Inc.", ticker: "AVGO", canonicalTicker: "AVGO", exchange: "NASDAQ", country: "US", aliases: ["Broadcom", "Avgo"] },
  { name: "JPMorgan Chase & Co.", ticker: "JPM", canonicalTicker: "JPM", exchange: "NYSE", country: "US", aliases: ["JPMorgan", "Chase", "JPM"] },
  { name: "Visa Inc.", ticker: "V", canonicalTicker: "V", exchange: "NYSE", country: "US", aliases: ["Visa", "V"] },
  { name: "UnitedHealth Group Incorporated", ticker: "UNH", canonicalTicker: "UNH", exchange: "NYSE", country: "US", aliases: ["UnitedHealth", "United Health", "UNH"] }
];

export const CURATED_COMPANIES: CompanyCatalogItem[] = [
  ...US_COMPANIES,
  ...INDIAN_COMPANIES
];
