import validUrl from "valid-url";
import pLimit from "p-limit";
import { config } from "../config";
import { httpGet } from "../utils/scrape";
import { logger } from "../utils/logger";
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

export async function simulateSearch(queries: string[], engine: "google" | "bing" = "bing"): Promise<string[]> {
  const limit = pLimit(config.parallelism);
  const tasks = queries.map((q) =>
    limit(async () => {
      const url = toSearchUrl(engine, q);
      logger.info("search:fetch", { engine, query: q });
      const html = await httpGet(url);
      if (!html) return [] as string[];
      if (engine === "google") return extractGoogleLinks(html);
      return extractResultLinks(html);
    })
  );
  const pages = await Promise.all(tasks);
  const links = pages.flat();
  const unique = Array.from(new Set(links)).filter((u) => validUrl.isWebUri(u));
  logger.info("search:links", { count: unique.length });
  if (unique.length === 0 && engine === "google") {
    // Fallback to Bing if Google yields nothing (likely due to anti-bot measures)
    logger.info("search:fallback", { from: "google", to: "bing" });
    const limit2 = pLimit(config.parallelism);
    const tasks2 = queries.map((q) =>
      limit2(async () => {
        const url = toSearchUrl("bing", q);
        logger.info("search:fetch", { engine: "bing", query: q });
        const html = await httpGet(url);
        if (!html) return [] as string[];
        return extractResultLinks(html);
      })
    );
    const pages2 = await Promise.all(tasks2);
    const links2 = pages2.flat();
    const unique2 = Array.from(new Set(links2)).filter((u) => validUrl.isWebUri(u));
    logger.info("search:links", { count: unique2.length });
    return unique2.slice(0, 100);
  }
  return unique.slice(0, 100);
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


