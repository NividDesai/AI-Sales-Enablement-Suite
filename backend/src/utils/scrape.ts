import fetch from "node-fetch";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { config } from "../config";
import { logger } from "./logger";

export type ScrapeResult = {
  url: string;
  title?: string;
  metaDescription?: string;
  emails: string[];
  phones: string[];
  socialLinks: string[];
  technologies: string[];
  textSample?: string;
  careersLinks?: string[];
  addresses?: string[];
};

export async function httpGet(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    const res = await fetch(url, {
      headers: { "user-agent": config.userAgent },
      signal: controller.signal as any,
    } as any);
    clearTimeout(timeout);
    if (!res.ok) {
      logger.warn("httpGet:status", { url, status: res.status });
      return null;
    }
    return await res.text();
  } catch {
    logger.warn("httpGet:failed", { url });
    return null;
  }
}

export function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches)).slice(0, 10);
}

export function extractPhones(text: string): string[] {
  // Generic phone regex: captures international formats like +1 415-555-1234, (415) 555-1234, 020 7946 0018, etc.
  const re = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;
  const raw = text.match(re) || [];
  // Basic normalization: trim and collapse spaces
  const cleaned = raw.map((p) => p.replace(/\s+/g, ' ').trim());
  return Array.from(new Set(cleaned)).slice(0, 10);
}

export function extractTelLinks($: cheerio.CheerioAPI): string[] {
  const phones: string[] = [];
  $("a[href^='tel:']").each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const num = href.replace(/^tel:/i, '').trim();
    if (num) phones.push(num);
  });
  return Array.from(new Set(phones)).slice(0, 10);
}

export function extractSocialLinks($: cheerio.CheerioAPI): string[] {
  const socials: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/facebook\.com|twitter\.com|x\.com|linkedin\.com|instagram\.com|youtube\.com|tiktok\.com/i.test(href)) {
      socials.push(href);
    }
  });
  return Array.from(new Set(socials)).slice(0, 20);
}

export function extractCareersLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  const keywords = /career|careers|jobs|join[- ]?us|work[- ]?with[- ]?us|vacanc|recruit|emplois|karriere|empleo/i;
  const atsDomains = /(lever\.co|greenhouse\.io|workable\.com|ashbyhq\.com|smartrecruiters\.com|workdayjobs\.com|eightfold\.ai|bamboohr\.com|teamtailor\.com|recruitee\.com|icims\.com|jobvite\.com|jobs\.boards|jobs\.ashbyhq\.com)/i;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const text = ($(el).text() || "").trim();
    if (!href) return;
    if (keywords.test(href) || keywords.test(text) || atsDomains.test(href) || /\/(careers?|jobs?)(\/|$)/i.test(href)) {
      try {
        const abs = new URL(href, baseUrl).toString();
        links.push(abs);
      } catch {
        // ignore malformed
      }
    }
  });
  return Array.from(new Set(links)).slice(0, 10);
}

export function extractAddresses($: cheerio.CheerioAPI): string[] {
  const out = new Set<string>();
  // Microdata PostalAddress
  $('[itemprop="address"]').each((_, el) => {
    const root = $(el);
    const parts = [
      root.find('[itemprop="streetAddress"]').text().trim(),
      root.find('[itemprop="addressLocality"]').text().trim(),
      root.find('[itemprop="addressRegion"]').text().trim(),
      root.find('[itemprop="postalCode"]').text().trim(),
      root.find('[itemprop="addressCountry"]').text().trim(),
    ].filter(Boolean);
    if (parts.length) out.add(parts.join(', '));
  });
  // address tags
  $('address').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (txt.length > 12) out.add(txt);
  });
  // heuristic containers
  const sel = [
    '[class*="address"]','[id*="address"]','[class*="location"]','[id*="location"]',
    '[class*="contact"]','[id*="contact"]','footer'
  ].join(',');
  $(sel).each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (txt.length < 12) return;
    const parts = txt.split(/\s*\|\s*|\s*·\s*|\s*•\s*|\s*;\s*|\s{2,}/);
    for (const p of parts) {
      const line = p.trim();
      if (line.length < 10) continue;
      if (/(\d.*[,])|india|united states|france|germany|uk|united kingdom|canada|australia/i.test(line) || /\b\d{5}(?:-\d{4})?\b/.test(line) || /\b\d{6}\b/.test(line)) {
        out.add(line);
      }
    }
  });
  return Array.from(out).slice(0, 10);
}

export function detectTechnologies($: cheerio.CheerioAPI): string[] {
  const scripts = $("script[src]")
    .map((_, el) => $(el).attr("src") || "")
    .get();
  const links = $("link[href]")
    .map((_, el) => $(el).attr("href") || "")
    .get();
  const html = $.html();
  const techs = new Set<string>();
  const pushIf = (cond: boolean, name: string) => cond && techs.add(name);
  const sources = scripts.concat(links).concat([html]).join("\n");
  pushIf(/wp-content|wordpress/i.test(sources), "WordPress");
  pushIf(/shopify|cdn\.shopify\.com/i.test(sources), "Shopify");
  pushIf(/wixstatic\.com|wix\.com/i.test(sources), "Wix");
  pushIf(/squarespace\.com/i.test(sources), "Squarespace");
  pushIf(/react|next/i.test(sources), "React");
  pushIf(/vue|nuxt/i.test(sources), "Vue");
  pushIf(/angular/i.test(sources), "Angular");
  pushIf(/cloudflare/i.test(sources), "Cloudflare");
  pushIf(/gtag\(|google-analytics|ga\(/i.test(sources), "Google Analytics");
  return Array.from(techs);
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult | null> {
  logger.info("scrape:start", { url });
  const html = await httpGet(url);
  if (!html) return null;
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || undefined;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    undefined;
  const textSample = $("body").text().replace(/\s+/g, " ").trim().slice(0, 800) || undefined;
  const emails = extractEmails(html + "\n" + textSample);
  let phones = extractPhones(html + "\n" + (textSample || ""));
  if ((!phones || phones.length === 0)) {
    const tel = extractTelLinks($);
    if (tel.length) phones = tel;
  }
  const socialLinks = extractSocialLinks($);
  const technologies = detectTechnologies($);
  const careersLinks = extractCareersLinks($, url);
  let addresses = extractAddresses($);

  // If phones or careers were not found, try common secondary pages quickly
  const needPhones = phones.length === 0;
  const needCareers = !careersLinks || careersLinks.length === 0;
  if (needPhones || needCareers) {
    const candidates = [
      needPhones ? '/contact' : '',
      needPhones ? '/contact-us' : '',
      needPhones ? '/about' : '',
      needCareers ? '/careers' : '',
      needCareers ? '/jobs' : '',
      needCareers ? '/join-us' : '',
    ].filter(Boolean);
    for (const path of candidates) {
      try {
        const u2 = new URL(path, url).toString();
        const html2 = await httpGet(u2);
        if (!html2) continue;
        const $2 = cheerio.load(html2);
        if (needPhones && phones.length === 0) {
          const tel2 = extractTelLinks($2);
          const re2 = extractPhones(html2 + "\n" + ($2('body').text().slice(0, 800) || ''));
          phones = Array.from(new Set([...(phones || []), ...tel2, ...re2]));
        }
        if (needCareers && (!careersLinks || careersLinks.length === 0)) {
          const c2 = extractCareersLinks($2, url);
          if (c2.length) {
            // Merge, keep unique
            const merged = new Set<string>([...((careersLinks as string[]) || []), ...c2]);
            ;(careersLinks as string[]) = Array.from(merged);
          }
        }
        // Addresses from secondary pages
        const a2 = extractAddresses($2);
        if (a2.length) {
          addresses = Array.from(new Set([...(addresses || []), ...a2]));
        }
      } catch {}
      if ((!needPhones || phones.length > 0) && (!needCareers || (careersLinks && careersLinks.length > 0))) break;
    }
  }

  const result = { url, title, metaDescription, emails, phones, socialLinks, technologies, textSample, careersLinks, addresses };
  logger.info("scrape:done", { url, emails: emails.length, socials: socialLinks.length, techs: technologies.length });
  return result;
}

export async function scrapeMany(urls: string[]): Promise<ScrapeResult[]> {
  const limit = pLimit(config.parallelism);
  const tasks = urls.map((u) => limit(() => scrapeWebsite(u)));
  const results = await Promise.all(tasks);
  return results.filter((r): r is ScrapeResult => Boolean(r));
}


