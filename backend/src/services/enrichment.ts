import { LeadRaw } from "../types";
import { logger } from "../utils/logger";
import { hunterVerify } from "../providers/hunter";
import { config } from "../config";
import { agentEnrichEmails } from "./agent";
import { fetchCompanyNews } from "../utils/news";
import { scrapeWebsite, httpGet } from "../utils/scrape";
import { JobListingEnricher } from "../utils/jobs";
import { normalizePhone } from "../utils/phone";
import { aiSuggestJobWebsites } from "../utils/ai";
import * as cheerio from "cheerio";

// Helper to normalize titles for filtering (handles CEO, Chief Executive Officer, etc.)
function normalizeTitleForFilter(title: string): string {
  const normalized = title.toLowerCase()
    .replace(/chief\s+executive\s+officer/gi, 'ceo')
    .replace(/chief\s+technology\s+officer/gi, 'cto')
    .replace(/chief\s+marketing\s+officer/gi, 'cmo')
    .replace(/chief\s+financial\s+officer/gi, 'cfo')
    .replace(/chief\s+operating\s+officer/gi, 'coo')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
}

// Validate phone number - reject obvious fake numbers
function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  // Reject if too short (< 7 digits) or too long (> 15 digits)
  if (cleaned.length < 7 || cleaned.length > 15) return false;
  // Reject if all digits are the same (e.g., 111-111-1111)
  if (/^(\d)\1+$/.test(cleaned)) return false;
  // Reject common fake patterns (e.g., 123-456-7890, 000-000-0000)
  if (/^(123|000|111|555|999)/.test(cleaned)) return false;
  return true;
}

function toDomain(u: string): string | null {
  try {
    const d = new URL(u).hostname.replace(/^www\./, "");
    return d;
  } catch {
    return null;
  }
}

export async function enrichFromUrls(urls: string[], limit: number, opts?: { useHunter?: boolean; verify?: boolean; title?: string; locations?: string[]; preferApollo?: boolean }): Promise<LeadRaw[]> {
  logger.info("enrichFromUrls:start", { requested: limit, urlCount: urls.length, mode: "providers-only" });
  // Derive unique domains from incoming URLs
  const domains = Array.from(new Set(urls.map(toDomain).filter(Boolean) as string[]));
  if (domains.length === 0) {
    logger.info("enrichFromUrls:domains:none");
    return [];
  }
  const basePrefer: Array<"hunter"> = ["hunter"]; // Hunter only
  const out: LeadRaw[] = [];
  // Use minimal per-domain limit to save credits - only get what we need
  // Calculate how many emails we need per domain (distribute limit across domains)
  const domainsNeeded = Math.min(domains.length, limit);
  const perDomainLimit = Math.max(1, Math.ceil(limit / domainsNeeded)); // Distribute limit across domains

  // Normalize title for filtering (case-insensitive, handle variations)
  const titleFilter = opts?.title ? normalizeTitleForFilter(opts.title) : null;

  let rateLimited = false;
  let rateLimitCount = 0;
  for (let i = 0; i < domains.length && out.length < limit && !rateLimited; i++) {
    const domain = domains[i];
    const prefer: Array<"hunter"> = basePrefer; // Hunter only
    // Only request what we need - don't waste credits
    const remainingNeeded = limit - out.length;
    const thisDomainLimit = Math.min(perDomainLimit, remainingNeeded);
    
    const emails = await agentEnrichEmails({
      domains: [domain],
      perDomainLimit: Math.min(thisDomainLimit, config.hunterMaxEmailsPerDomain), // Use exact limit needed
      prefer,
      title: opts?.title,
      locations: opts?.locations,
    });
    
    // If we got 0 emails, check if it's due to rate limiting
    if (emails.length === 0) {
      rateLimitCount++;
      // If we hit rate limits on first 2 domains, stop trying (don't waste time)
      if (rateLimitCount >= 2) {
        logger.warn("enrichFromUrls:rateLimited", { message: "Hunter.io is rate-limited. Stopping requests to save time.", domainsAttempted: i + 1 });
        rateLimited = true;
        break;
      }
    } else {
      // Reset counter if we got results
      rateLimitCount = 0;
    }
    
    // Small delay between domains to avoid rate limits
    if (i < domains.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between domains
    }
    for (const email of emails) {
      // Filter by title if specified - strict matching
      // Handle comma-separated titles (e.g., "CEO,Co-founder,CFO")
      if (opts?.title && email.title) {
        const requestedTitles = opts.title.split(',').map(t => normalizeTitleForFilter(t.trim())).filter(Boolean);
        const emailTitleNormalized = normalizeTitleForFilter(email.title);
        
        // Check if email title matches ANY of the requested titles
        const titleMatches = requestedTitles.some(requestedTitle => {
          // For CEO/executive titles, check for English and French variations
          if (requestedTitle.includes('ceo') || requestedTitle.includes('chief executive')) {
            // Match CEO, Chief Executive, President, Founder, or French equivalents (PDG, Directeur Général, etc.)
            const isExecutive = /^(ceo|chief\s+executive|president|founder|co-founder|pdg|directeur\s+g[eé]n[eé]ral|dg|pr[eé]sident)/i.test(emailTitleNormalized) ||
                               /\b(ceo|chief\s+executive|president|founder|co-founder|pdg|directeur\s+g[eé]n[eé]ral|dg|pr[eé]sident)\b/i.test(emailTitleNormalized);
            if (!isExecutive) return false;
            // Exclude non-executive roles
            const excludedPatterns = ['sales', 'marketing', 'manager', 'director', 'vp', 'vice president', 'coordinator', 'specialist', 'analyst', 'assistant', 'associate'];
            const hasExcluded = excludedPatterns.some(pattern => emailTitleNormalized.includes(pattern));
            if (hasExcluded) return false;
            return true;
          }
          // For CFO titles
          else if (requestedTitle.includes('cfo') || requestedTitle.includes('chief financial')) {
            const isCfo = /^(cfo|chief\s+financial|directeur\s+financier|df)/i.test(emailTitleNormalized) ||
                         /\b(cfo|chief\s+financial|directeur\s+financier|df)\b/i.test(emailTitleNormalized);
            if (!isCfo) return false;
            const excludedPatterns = ['sales', 'marketing', 'manager', 'director', 'vp', 'vice president', 'coordinator', 'specialist', 'analyst', 'assistant', 'associate'];
            const hasExcluded = excludedPatterns.some(pattern => emailTitleNormalized.includes(pattern));
            if (hasExcluded) return false;
            return true;
          }
          // For Founder titles
          else if (requestedTitle.includes('founder') || requestedTitle.includes('co-founder')) {
            const isFounder = /^(founder|co-founder|cofounder|co\s+founder|fondateur)/i.test(emailTitleNormalized) ||
                            /\b(founder|co-founder|cofounder|co\s+founder|fondateur)\b/i.test(emailTitleNormalized);
            if (!isFounder) return false;
            const excludedPatterns = ['sales', 'marketing', 'manager', 'director', 'vp', 'vice president', 'coordinator', 'specialist', 'analyst', 'assistant', 'associate'];
            const hasExcluded = excludedPatterns.some(pattern => emailTitleNormalized.includes(pattern));
            if (hasExcluded) return false;
            return true;
          }
          // Generic match for other titles
          else {
            return emailTitleNormalized.includes(requestedTitle) || requestedTitle.includes(emailTitleNormalized);
          }
        });
        
        if (!titleMatches) {
          continue; // Skip if title doesn't match any requested title
        }
      }
      let verifier: { status?: string; score?: number } | null = null;
      if (opts?.verify && config.hunterApiKey) {
        verifier = await hunterVerify(email.email);
      }
      const now = new Date().toISOString();
      out.push({
        leadId: `${domain}_${email.email}`,
        name: email.name,
        title: email.title,
        company: domain,
        companyDomain: domain,
        companyWebsite: `https://${domain}`,
        email: email.email,
        phoneNumber: (() => {
          const rawPhone = (email as any).phoneNumber;
          if (!rawPhone) return undefined;
          const normalized = normalizePhone(rawPhone, (email as any).location, domain);
          // Only return if it's a valid phone number
          return normalized && isValidPhoneNumber(normalized) ? normalized : undefined;
        })(),
        linkedinUrl: (email as any).linkedinUrl,
        location: (email as any).location,
        description: undefined,
        technologies: [],
        socialProfiles: [],
        foundedYear: null,
        companySize: null,
        lastSeenActivity: null,
        notes: `source=${email.source}; verify_status=${verifier?.status ?? ''}; verify_score=${verifier?.score ?? ''}`,
        rawSources: [`https://${domain}`],
        capturedAt: now,
      });
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }

  logger.info("enrichFromUrls:providers", { count: out.length });
  
  // Only enrich existing leads with scraped data - DON'T create new leads from scraped emails (saves credits)
  // Lightweight site scrape to pick phones and careers links for existing leads only
  const usedDomains = Array.from(new Set(out.map((l) => (l.companyDomain || l.company) as string).filter(Boolean)))
  const scrapeCap = Math.min(usedDomains.length, 5) // Only scrape domains we already have leads for
  let scrapeCount = 0
  for (let i = 0; i < usedDomains.length && scrapeCount < scrapeCap; i++) {
    const d = usedDomains[i]
    try {
      const res = await scrapeWebsite(`https://${d}`)
      if (res) {
        // Only enrich existing leads - don't create new ones
        for (const lead of out) {
          if ((lead.companyDomain || lead.company) === d) {
            if (!lead.phoneNumber && res.phones && res.phones.length) {
              const locHint = lead.location || (Array.isArray(res.addresses) && res.addresses.length ? res.addresses[0] : undefined)
              const normalized = normalizePhone(res.phones[0], locHint, d) || res.phones[0]
              if (normalized && isValidPhoneNumber(normalized)) {
                lead.phoneNumber = normalized
              }
            }
            if (!lead.linkedinUrl && Array.isArray(res.socialLinks)) {
              const lnk = res.socialLinks.find((u) => /linkedin\.com\//i.test(u))
              if (lnk) lead.linkedinUrl = lnk
            }
            if (res.careersLinks && res.careersLinks.length) {
              lead.careersLinks = res.careersLinks.slice(0, 5)
            }
            if (!lead.location && Array.isArray(res.addresses) && res.addresses.length) {
              lead.location = res.addresses[0]
            }
          }
        }
        scrapeCount++
      }
    } catch {}
  }
  logger.info("enrichFromUrls:scrape", { enriched: scrapeCount });
  // Company news enrichment (lightweight, capped) - enabled for up to 5 companies
  if (usedDomains.length === 0) {
    logger.info("enrichFromUrls:news", { enriched: 0, note: "no domains to process" });
  } else {
    const newsCap = Math.min(5, usedDomains.length); // Limit to 5 companies to save credits
    let newsCount = 0;
    const processedDomains = new Set<string>();
    for (const lead of out) {
      if (newsCount >= newsCap) break;
      const domain = lead.companyDomain || lead.company;
      if (!domain || processedDomains.has(domain)) continue;
      processedDomains.add(domain);
      try {
        logger.info("enrichFromUrls:news:fetching", { domain });
        const news = await fetchCompanyNews(domain);
        if (news && news.length) {
          // Add news to all leads from this company
          for (const l of out) {
            if ((l.companyDomain || l.company) === domain) {
              (l as any).companyContext = { recentNews: news.slice(0, 3) };
            }
          }
          newsCount++;
          logger.info("enrichFromUrls:news:found", { domain, count: news.length, titles: news.slice(0, 2).map((n: any) => n.title) });
        } else {
          logger.info("enrichFromUrls:news:empty", { domain });
        }
      } catch (e: any) {
        logger.warn("enrichFromUrls:news:error", { domain, error: e?.message, stack: e?.stack });
      }
    }
    logger.info("enrichFromUrls:news", { enriched: newsCount, total: processedDomains.size, attempted: Array.from(processedDomains) });
  }

  // Jobs enrichment - using LLM to find job websites (saves credits by not trying many URLs)
  try {
    if (usedDomains.length === 0) {
      logger.info("enrichFromUrls:jobs", { enriched: 0, note: "no domains to process" });
    } else {
      const jobsCap = Math.min(5, usedDomains.length); // Limit to 5 companies to save credits
      const companiesForJobs = usedDomains.slice(0, jobsCap).map(d => ({
        domain: d,
        name: out.find(l => (l.companyDomain || l.company) === d)?.company || d
      }));
      
      if (companiesForJobs.length > 0) {
        logger.info("enrichFromUrls:jobs:llm", { companies: companiesForJobs.length, domains: companiesForJobs.map(c => c.domain) });
        
        // Use LLM to find job websites (batched, efficient)
        const jobWebsites = await aiSuggestJobWebsites(companiesForJobs, true);
        logger.info("enrichFromUrls:jobs:llm-result", { found: Object.keys(jobWebsites).length, domains: Object.keys(jobWebsites) });
      
      const jobber = new JobListingEnricher();
      let jobsDone = 0;
      
      for (const company of companiesForJobs) {
        if (jobsDone >= jobsCap) break;
        const d2 = company.domain;
        
        try {
          // Get LLM-suggested job URLs for this company
          const suggestedUrls = jobWebsites[d2] || [];
          
          // If LLM found URLs, use them; otherwise fall back to common patterns
          let jobUrls: string[] = [];
          if (suggestedUrls.length > 0) {
            jobUrls = suggestedUrls;
            logger.info("enrichFromUrls:jobs:llm-found", { domain: d2, urls: suggestedUrls.length });
          } else {
            // Fallback to common patterns (but limit to avoid wasting requests)
            jobUrls = [
              `https://${d2}/careers`,
              `https://${d2}/jobs`,
              `https://careers.${d2}`,
              `https://jobs.${d2}`
            ];
          }
          
          // Try to get jobs from the suggested URLs
          let allJobs: any[] = [];
          for (const url of jobUrls.slice(0, 3)) { // Limit to 3 URLs per company
            try {
              const html = await httpGet(url);
              if (!html) continue;
              const $ = cheerio.load(html);
              
              // Extract jobs using simple selectors
              const jobSelectors = [".job-listing", ".careers-job", ".position", ".opening", "[data-qa=\"job\"]", ".job-post"];
              for (const selector of jobSelectors) {
                $(selector).each((_: any, el: any) => {
                  const $el = $(el);
                  const title = $el.find("h1, h2, h3, .title, .job-title").first().text().trim();
                  if (title && title.length > 3) {
                    const applyUrl = $el.find('a[href*="apply"], a[href*="job"]').first().attr('href') || url;
                    const fullApplyUrl = applyUrl.startsWith('http') ? applyUrl : new URL(applyUrl, url).toString();
                    allJobs.push({
                      title,
                      department: $el.find(".department, .team").first().text().trim() || null,
                      location: $el.find(".location").first().text().trim() || null,
                      type: $el.find(".type, .employment-type").first().text().trim() || null,
                      description: $el.find(".description, .job-description").first().text().trim().slice(0, 500) || null,
                      postedDate: null,
                      applyUrl: fullApplyUrl,
                      sourceUrl: url,
                      scrapedAt: new Date().toISOString(),
                    });
                  }
                });
                if (allJobs.length > 0) break;
              }
              
              // If no structured jobs found, try text extraction
              if (allJobs.length === 0) {
                const text = $.text();
                const jobTitleRegex = /(software engineer|product manager|data scientist|sales|marketing|designer|developer|analyst|director|manager|coordinator|specialist|associate|engineer|developer)/gi;
                const matches = text.match(jobTitleRegex);
                if (matches) {
                  const uniqueTitles = [...new Set(matches.map((t: string) => t.trim()))];
                  uniqueTitles.slice(0, 5).forEach((title: string) => {
                    allJobs.push({
                      title,
                      department: null,
                      location: null,
                      type: null,
                      description: null,
                      postedDate: null,
                      applyUrl: url,
                      sourceUrl: url,
                      scrapedAt: new Date().toISOString(),
                    });
                  });
                }
              }
              
              if (allJobs.length > 0) break; // Found jobs, stop trying other URLs
            } catch (e: any) {
              logger.warn("enrichFromUrls:jobs:scrape-error", { url, error: e?.message });
            }
          }
          
          // Deduplicate jobs
          const seen = new Set<string>();
          const uniqueJobs = allJobs.filter((job: any) => {
            const key = `${(job.title || '').toLowerCase()}_${(job.location || '').toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          
          if (uniqueJobs.length > 0) {
            // Get the first job URL to use as careers link
            const firstJobUrl = uniqueJobs[0]?.sourceUrl || uniqueJobs[0]?.applyUrl;
            
            for (const lead of out) {
              if ((lead.companyDomain || lead.company) === d2) {
                (lead as any).companyJobs = uniqueJobs.slice(0, 10); // Limit to 10 jobs per company
                (lead as any).activeJobCount = uniqueJobs.length;
                // Also set careersLinks for frontend compatibility
                if (firstJobUrl && !lead.careersLinks) {
                  lead.careersLinks = [firstJobUrl];
                }
              }
            }
            jobsDone++;
            logger.info("enrichFromUrls:jobs:found", { domain: d2, count: uniqueJobs.length });
          }
        } catch (e: any) {
          logger.warn("enrichFromUrls:jobs:error", { domain: d2, error: e?.message });
        }
      }
      
        logger.info("enrichFromUrls:jobs", { enriched: jobsDone, total: companiesForJobs.length });
      } else {
        logger.info("enrichFromUrls:jobs", { enriched: 0, note: "no companies to process" });
      }
    }
  } catch (e: any) {
    logger.warn("enrichFromUrls:jobs:error", { error: e?.message, stack: e?.stack });
  }

  return out.slice(0, limit);
}
