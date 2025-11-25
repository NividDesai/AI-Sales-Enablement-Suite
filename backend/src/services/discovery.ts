import validUrl from "valid-url";
import pLimit from "p-limit";
import { config } from "../config";
import { httpGet } from "../utils/scrape";
import { logger } from "../utils/logger";

/**
 * ⚠️ LEGAL WARNING: Scraping search engines (Google, Bing) violates their Terms of Service.
 * 
 * This function is provided for educational purposes only. In production, you should:
 * 1. Use official search APIs (Google Custom Search API, Bing Search API)
 * 2. Obtain proper authorization before scraping
 * 3. Consider using lead generation APIs (Apollo, Hunter.io) instead
 * 
 * Using this function may result in:
 * - IP bans from search engines
 * - Legal action for ToS violations
 * - CFAA violations in the US
 * 
 * RECOMMENDATION: Replace this with official APIs or remove entirely.
 */
// OpenCorporates removed per request

function toSearchUrl(engine: "google" | "bing", query: string): string {
  const q = encodeURIComponent(query);
  if (engine === "google") return `https://www.google.com/search?q=${q}`;
  return `https://www.bing.com/search?q=${q}`;
}

function normalizeAndFilter(urls: string[]): string[] {
  const blacklist = new Set([
    "google.com", "www.google.com", "bing.com", "www.bing.com", "r.bing.com", "th.bing.com",
    "schemas.live.com", "www.w3.org", "microsoft.com", "www.microsoft.com", "youtube.com", "www.youtube.com",
    "webcache.googleusercontent.com", "accounts.google.com"
  ]);
  const uniq = Array.from(new Set(urls));
  const normalized = uniq
    .map((u) => {
      try {
        const url = new URL(u);
        if (blacklist.has(url.hostname)) return null;
        return url.origin;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => !!u);
  return Array.from(new Set(normalized)).slice(0, 50);
}

function extractResultLinks(html: string): string[] {
  // Heuristic extraction for pages with direct links (e.g., Bing)
  const linkRegex = /https?:\/\/[\w.-]+(?:\/[\w\-.\/?%&=]*)?/gi;
  const candidates = html.match(linkRegex) || [];
  const filtered = candidates.filter((u) => {
    if (!/https?:\/\//i.test(u)) return false;
    if (/webcache|google\.com\/search|bing\.com\/search|accounts\.google|microsoft\.com\/translator/i.test(u)) return false;
    if (/\.(png|jpg|jpeg|gif|svg|css|js)(\?|$)/i.test(u)) return false;
    if (/^https?:\/\/r\.bing\.com|^https?:\/\/th\.bing\.com/i.test(u)) return false;
    if (/^https?:\/\/schemas\.live\.com|^https?:\/\/www\.w3\.org/i.test(u)) return false;
    return true;
  });
  return normalizeAndFilter(filtered);
}

function extractGoogleLinks(html: string): string[] {
  // Extract target URLs from Google's /url?q= pattern
  const matches = html.match(/\"\/url\?q=([^&\"]+)/gi) || [];
  const decoded = matches
    .map((m) => {
      const enc = (m.match(/\"\/url\?q=([^&\"]+)/i) || [])[1];
      try { return decodeURIComponent(enc); } catch { return null; }
    })
    .filter((u): u is string => !!u);
  return normalizeAndFilter(decoded);
}

/**
 * DISABLED FOR LEGAL COMPLIANCE
 * 
 * Search engine scraping violates Google and Bing Terms of Service.
 * This function has been disabled to ensure legal compliance.
 * 
 * To enable lead discovery, use one of these compliant alternatives:
 * 1. Google Custom Search API: https://developers.google.com/custom-search
 * 2. Bing Search API: https://www.microsoft.com/en-us/bing/apis/bing-web-search-api
 * 3. Lead generation APIs: Apollo.io, Hunter.io, Clearbit
 * 4. LinkedIn Sales Navigator API (if available)
 */
export async function simulateSearch(queries: string[], engine: "google" | "bing" = "bing"): Promise<string[]> {
  logger.error("search:disabled", {
    message: "Search engine scraping is disabled for legal compliance.",
    reason: "Violates Google and Bing Terms of Service",
    recommendation: "Use Google Custom Search API or Bing Search API instead",
    queries: queries.length,
    engine
  });
  
  // Return empty array - search engine scraping is disabled
  return [];
}

export function buildBaseQueries(params: {
  industry: string;
  roleOrTitle: string;
  locations: string[];
}): string[] {
  const { industry, roleOrTitle, locations } = params;
  const locs = locations.length ? locations : [""];
  const queries: string[] = [];
  for (const loc of locs) {
    const parts = [industry, roleOrTitle, loc, "site:linkedin.com OR site:crunchbase.com OR site:about.me OR site:angel.co"].filter(Boolean);
    queries.push(parts.join(" "));
    queries.push(`${industry} ${roleOrTitle} ${loc} contact email`);
    queries.push(`${industry} ${roleOrTitle} ${loc} "about us"`);
  }
  return Array.from(new Set(queries));
}

function mapLocationToJurisdiction(loc: string): string | undefined {
  const l = (loc || "").toLowerCase();
  if (/france|paris|fr\b/.test(l)) return "fr";
  if (/united kingdom|uk|london/.test(l)) return "gb";
  if (/germany|berlin|de\b/.test(l)) return "de";
  if (/spain|madrid|es\b/.test(l)) return "es";
  if (/italy|rome|it\b/.test(l)) return "it";
  if (/netherlands|amsterdam|nl\b/.test(l)) return "nl";
  if (/united states|usa|us\b|new york|san francisco|california/.test(l)) return undefined; // OC split by states
  return undefined;
}

// discoverWithOpenCorporates removed per request


