import { Router } from "express";
import { enrichFromUrls } from "../services/enrichment";
import { aiSuggestDomains, maybeStructureWithAi } from "../utils/ai";
import { LeadInput } from "../types";
import { leadsToCsv } from "../utils/csv";
import { logger } from "../utils/logger";
import { generateDraftEmail, sendEmails, type SenderProfile, type DraftEmail } from "../utils/outreach";

const router = Router();

function matchesLeadFilters(lead: any, filters: any): boolean {
  const txt = (
    [lead.description, lead.company, lead.companyDomain, (lead.companyContext?.recentNews||[]).map((n: any)=>n.title).join(' ')]
      .filter(Boolean)
      .join(' ') || ''
  ).toLowerCase();
  // startup heuristic
  if (filters?.isStartup) {
    const fy = Number(lead.foundedYear || 0);
    const sizeNum = Number(lead.companySize || 0);
    const startupish = (fy ? fy >= 2010 : /startup/.test(txt)) || (sizeNum && sizeNum <= 200);
    if (!startupish) return false;
  }
  // sectors/tags (e.g., fintech, ai, saas)
  if (Array.isArray(filters?.sectors) && filters.sectors.length) {
    const ok = filters.sectors.some((s: string) => txt.includes(String(s||'').toLowerCase()));
    if (!ok) return false;
  }
  // technologies include
  if (Array.isArray(filters?.technologies) && filters.technologies.length) {
    const tech = Array.isArray(lead.technologies) ? lead.technologies.map((t: string)=>String(t||'').toLowerCase()) : [];
    const ok = filters.technologies.every((t: string) => tech.includes(String(t||'').toLowerCase()) || txt.includes(String(t||'').toLowerCase()));
    if (!ok) return false;
  }
  // company size bucket match - only filter if lead has company size data
  if (filters?.companySizeRange) {
    const map: Record<string, [number, number]> = {
      '1-10': [1,10], '11-50': [11,50], '51-200': [51,200], '201-1000': [201,1000], '1001+': [1001, 1e9],
    };
    const rng = map[String(filters.companySizeRange)] || null;
    if (rng) {
      const n = Number(lead.companySize || 0);
      // Only filter if lead has a company size (n > 0) and it doesn't match the range
      if (n > 0 && !(n >= rng[0] && n <= rng[1])) return false;
    }
  }
  // founded year - only filter if lead has founded year data
  if (filters?.foundedYearMin || filters?.foundedYearMax) {
    const fy = Number(lead.foundedYear || 0);
    // Only filter if lead has a founded year (fy > 0)
    if (fy > 0) {
      if (filters.foundedYearMin && fy < Number(filters.foundedYearMin)) return false;
      if (filters.foundedYearMax && fy > Number(filters.foundedYearMax)) return false;
    }
  }
  // Location filter - only filter if lead has location data, otherwise include
  if (Array.isArray(filters?.locations) && filters.locations.length) {
    const ltxt = String(lead.location || '').toLowerCase().trim();
    // If lead has no location data, include it anyway (less strict - don't filter out)
    if (!ltxt || ltxt.length < 2) {
      return true; // No location = include (less strict)
    }
    // If lead has location data, check if it matches
    const ok = filters.locations.some((loc: string) => {
      const locLower = String(loc||'').toLowerCase().trim();
      if (!locLower) return false;
      // Match if either contains the other (handles "Paris, France" matching "France")
      // Also handle country codes and city names
      const locationVariations = [
        locLower,
        locLower === 'france' || locLower === 'paris' ? 'fr' : '',
        locLower === 'united states' || locLower === 'usa' ? 'us' : '',
        locLower === 'united kingdom' || locLower === 'uk' ? 'gb' : '',
        locLower === 'germany' ? 'de' : '',
        locLower === 'spain' ? 'es' : '',
        locLower === 'italy' ? 'it' : '',
      ].filter(Boolean);
      return locationVariations.some(v => ltxt.includes(v) || v.includes(ltxt));
    });
    // Only filter out if location data exists and doesn't match
    // This allows leads without location data to pass through
    return ok;
  }
  return true;
}

router.post("/discover", async (req, res) => {
  try {
    const body = req.body as Partial<LeadInput> & { engine?: "google" | "bing" } & {
      isStartup?: boolean; sectors?: string[]; technologies?: string[]; companySizeRange?: string; foundedYearMin?: number; foundedYearMax?: number;
    };
    const { industry = "", roleOrTitle = "", locations = [], numLeads = 10, isStartup, sectors = [], technologies = [], companySizeRange, foundedYearMin, foundedYearMax } = body as any;
    logger.info("discover:start", { industry, roleOrTitle, locations, numLeads, isStartup, sectors, technologies, companySizeRange, foundedYearMin, foundedYearMax, mode: "ai-domains" });
    // Expand AI prompt context by encoding filters into industry string
    const industryPrompt = [industry, (isStartup ? "startup" : null), (sectors && sectors.length ? sectors.join(" ") : null), (technologies && technologies.length ? `tech:${technologies.join(" ")}` : null), (companySizeRange ? `size:${companySizeRange}` : null), (foundedYearMin ? `founded>=${foundedYearMin}` : null), (foundedYearMax ? `founded<=${foundedYearMax}` : null)].filter(Boolean).join(" ");
    const domains = await aiSuggestDomains(industryPrompt, roleOrTitle, locations, Math.max(10, numLeads * 3));
    const urls = domains.map((d) => `https://${d}`);
    logger.info("discover:domains", { count: domains.length });
    res.json({ domains, urls });
  } catch (err: any) {
    logger.error("discover:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to discover" });
  }
});

router.post("/enrich", async (req, res) => {
  try {
    const { urls = [], limit = 10, useAi = false, providers, title, locations, preferApollo, isStartup, sectors = [], technologies = [], companySizeRange, foundedYearMin, foundedYearMax } = req.body as any;
    logger.info("enrich:start", { urlCount: urls.length, limit, useAi, providers, title, locations, preferApollo, isStartup, sectors, technologies, companySizeRange, foundedYearMin, foundedYearMax });
    // Use EXACTLY the requested limit - no multipliers to save credits
    const leads = await enrichFromUrls(urls, limit, { useHunter: true, verify: Boolean(providers?.verify), title, locations, preferApollo: Boolean(preferApollo) });
    logger.info("enrich:raw", { count: leads.length, requestedLimit: limit });
    const structured = await maybeStructureWithAi(leads, useAi);
    
    // STRICT title filtering - title MUST match exactly
    // Parse comma-separated titles (e.g., "CEO,Co-founder,CFO")
    let titleFiltered = structured;
    if (title) {
      // Split by comma and normalize each title
      const requestedTitles = title.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      const titleVariations = ['ceo', 'chief executive officer', 'chief executive', 'president', 'founder', 'co-founder', 'cofounder', 'cfo', 'chief financial officer'];
      const isExecutiveRequest = requestedTitles.some((t: string) => titleVariations.some((v: string) => t.includes(v) || v.includes(t)));
      
      if (isExecutiveRequest) {
        // Log titles before filtering to debug
        const titlesBeforeFilter = structured.map((l: any) => l.title || '(no title)').slice(0, 10);
        logger.info("enrich:titleFilter:before", { sampleTitles: titlesBeforeFilter, count: structured.length });
        
        // STRICT executive filtering - must match ANY of the requested titles
        titleFiltered = structured.filter((l: any) => {
          const leadTitle = String(l.title || '').toLowerCase().trim();
          if (!leadTitle) return false; // No title = no match
          
          // Check if lead title matches ANY of the requested titles
          const matchesAnyRequested = requestedTitles.some((requestedTitle: string) => {
            // Handle CEO variations (including French: PDG, Directeur Général, etc.)
            if (requestedTitle.includes('ceo') || requestedTitle.includes('chief executive')) {
              const isExecutive = /^(ceo|chief\s+executive\s+officer|chief\s+executive|president|founder|co-founder|cofounder|pdg|directeur\s+g[eé]n[eé]ral|dg|pr[eé]sident)/i.test(leadTitle) ||
                                  /\b(ceo|chief\s+executive\s+officer|chief\s+executive|president|founder|co-founder|cofounder|pdg|directeur\s+g[eé]n[eé]ral|dg|pr[eé]sident)\b/i.test(leadTitle);
              if (!isExecutive) return false;
            }
            // Handle CFO variations
            else if (requestedTitle.includes('cfo') || requestedTitle.includes('chief financial')) {
              const isCfo = /^(cfo|chief\s+financial\s+officer|chief\s+financial|directeur\s+financier|df)/i.test(leadTitle) ||
                           /\b(cfo|chief\s+financial\s+officer|chief\s+financial|directeur\s+financier|df)\b/i.test(leadTitle);
              if (!isCfo) return false;
            }
            // Handle Co-founder variations
            else if (requestedTitle.includes('founder') || requestedTitle.includes('co-founder')) {
              const isFounder = /^(founder|co-founder|cofounder|co\s+founder|fondateur)/i.test(leadTitle) ||
                               /\b(founder|co-founder|cofounder|co\s+founder|fondateur)\b/i.test(leadTitle);
              if (!isFounder) return false;
            }
            // Generic match
            else {
              if (!leadTitle.includes(requestedTitle) && !requestedTitle.includes(leadTitle)) {
                return false;
              }
            }
            
            // STRICT exclusion - no sales, marketing, managers, etc.
            const excludedPatterns = [
              'sales', 'marketing', 'manager', 'director', 'vp', 'vice president', 
              'coordinator', 'specialist', 'analyst', 'assistant', 'associate',
              'executive assistant', 'account executive', 'sales executive',
              'marketing executive', 'business development', 'bd', 'account manager'
            ];
            
            const hasExcluded = excludedPatterns.some(pattern => leadTitle.includes(pattern));
            return !hasExcluded;
          });
          
          return matchesAnyRequested;
        });
        logger.info("enrich:titleFilter:strict", { before: structured.length, after: titleFiltered.length, requestedTitles: requestedTitles });
      } else if (title) {
        // STRICT title matching - title must match ANY of the requested titles
        titleFiltered = structured.filter((l: any) => {
          const leadTitle = String(l.title || '').toLowerCase().trim();
          if (!leadTitle) return false; // No title = no match
          // Check if lead title matches ANY of the requested titles
          return requestedTitles.some((requestedTitle: string) => 
            leadTitle.includes(requestedTitle) || requestedTitle.includes(leadTitle)
          );
        });
        logger.info("enrich:titleFilter:strict", { before: structured.length, after: titleFiltered.length, requestedTitles: requestedTitles });
      }
    }
    
    // Filtering - location, industry, etc. (location is now less strict)
    let filtered = titleFiltered.filter((l: any) => matchesLeadFilters(l, { isStartup, sectors, technologies, companySizeRange, foundedYearMin, foundedYearMax, locations }));
    
    // Log location info for debugging
    if (locations && locations.length > 0) {
      const locationInfo = titleFiltered.map((l: any) => ({
        company: l.company,
        location: l.location || '(no location)',
        title: l.title || '(no title)'
      })).slice(0, 5);
      logger.info("enrich:locationFilter", { 
        requestedLocations: locations, 
        sampleLocations: locationInfo,
        beforeFilter: titleFiltered.length,
        afterFilter: filtered.length
      });
    }
    
    // Return exactly the requested limit (or all if we have fewer)
    const finalLeads = filtered.slice(0, limit);
    
    // Log warning if we got 0 leads due to rate limiting
    if (finalLeads.length === 0 && leads.length === 0) {
      logger.warn("enrich:noLeads", { 
        message: "No leads returned. Hunter.io appears to be rate-limited (429 errors). Please check your Hunter.io account status or wait a few minutes before retrying.",
        requested: limit,
        title: title,
        locations: locations
      });
    }
    
    logger.info("enrich:done", { count: structured.length, titleFiltered: titleFiltered.length, filteredCount: filtered.length, finalCount: finalLeads.length, requested: limit });
    const stats = (() => {
      let hunter = 0, verified = 0;
      for (const l of structured as any[]) {
        const notes: string = String(l.notes || "");
        if (/source=hunter/i.test(notes)) hunter++;
        if (/verify_status=\w+/i.test(notes)) verified++;
      }
      return { total: structured.length, hunter, verified };
    })();
    res.json({ leads: finalLeads, stats });
  } catch (err: any) {
    logger.error("enrich:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to enrich" });
  }
});

router.post("/discover-and-enrich", async (req, res) => {
  try {
    const body = req.body as Partial<LeadInput> & { engine?: "google" | "bing" } & { isStartup?: boolean; sectors?: string[]; technologies?: string[]; companySizeRange?: string; foundedYearMin?: number; foundedYearMax?: number };
    const { industry = "", roleOrTitle = "", locations = [], numLeads = 10, useAi = false, preferApollo, isStartup, sectors = [], technologies = [], companySizeRange, foundedYearMin, foundedYearMax } = body as any;
    const industryPrompt = [industry, (isStartup ? "startup" : null), (sectors && sectors.length ? sectors.join(" ") : null), (technologies && technologies.length ? `tech:${technologies.join(" ")}` : null), (companySizeRange ? `size:${companySizeRange}` : null), (foundedYearMin ? `founded>=${foundedYearMin}` : null), (foundedYearMax ? `founded<=${foundedYearMax}` : null)].filter(Boolean).join(" ");
    const domains = await aiSuggestDomains(industryPrompt, roleOrTitle, locations, Math.max(10, numLeads * 3));
    const urls = domains.map((d) => `https://${d}`);
    logger.info("dae:domains", { count: domains.length });
    const leads = await enrichFromUrls(urls, numLeads, { useHunter: true, verify: Boolean((req.body as any)?.providers?.verify), title: roleOrTitle, locations, preferApollo: Boolean(preferApollo) });
    logger.info("dae:raw", { count: leads.length });
    const structured = await maybeStructureWithAi(leads, useAi);
    const filtered = structured.filter((l: any) => matchesLeadFilters(l, { isStartup, sectors, technologies, companySizeRange, foundedYearMin, foundedYearMax, locations }));
    logger.info("dae:done", { count: structured.length });
    const stats = (() => {
      let hunter = 0, verified = 0;
      for (const l of structured as any[]) {
        const notes: string = String(l.notes || "");
        if (/source=hunter/i.test(notes)) hunter++;
        if (/verify_status=\w+/i.test(notes)) verified++;
      }
      return { total: structured.length, hunter, verified };
    })();
    res.json({ domains, urls, leads: filtered, stats });
  } catch (err: any) {
    logger.error("dae:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to process" });
  }
});

// Export CSV
router.post("/export/csv", async (req, res) => {
  try {
    const { leads = [] } = req.body as { leads: any[] };
    logger.info("export:csv", { count: leads.length });
    const csv = leadsToCsv(leads);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.send(csv);
  } catch (err: any) {
    logger.error("export:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to export" });
  }
});

// Tracking pixel for email opens
router.get("/track/:leadId", async (req, res) => {
  try {
    const leadId = String(req.params.leadId || "");
    const ua = req.headers["user-agent"];
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
    logger.info("track:open", { leadId, ua, ip });
    const gifBase64 = "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
    const buf = Buffer.from(gifBase64, "base64");
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).end(buf, "binary");
  } catch (err: any) {
    logger.error("track:error", { error: err?.message });
    res.status(204).end();
  }
});

// Outreach: generate email drafts
router.post("/outreach/preview", async (req, res) => {
  try {
    const { leads = [], profile } = req.body as { leads: any[]; profile: SenderProfile };
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "no leads provided" });
    }
    if (!profile || !profile.name || !profile.title || !profile.company || !profile.email) {
      return res.status(400).json({ error: "incomplete profile: name, title, company, email required" });
    }
    logger.info("outreach:preview:start", { leads: leads.length });
    const drafts: DraftEmail[] = [];
    for (const lead of leads) {
      const d = await generateDraftEmail(lead, profile);
      if (d) drafts.push(d);
    }
    logger.info("outreach:preview:done", { drafts: drafts.length });
    res.json({ drafts });
  } catch (err: any) {
    logger.error("outreach:preview:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to generate drafts" });
  }
});

// Outreach: send approved drafts via gmail/smtp
router.post("/outreach/send", async (req, res) => {
  try {
    const { drafts = [], provider = "gmail", emailConfig = {} } = req.body as { drafts: DraftEmail[]; provider: "gmail" | "smtp"; emailConfig: any };
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return res.status(400).json({ error: "no drafts provided" });
    }
    logger.info("outreach:send:start", { drafts: drafts.length, provider });
    const result = await sendEmails(drafts, provider, emailConfig);
    logger.info("outreach:send:done", { sent: result.sent.length, failed: result.failed.length });
    res.json(result);
  } catch (err: any) {
    logger.error("outreach:send:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to send emails" });
  }
});

export default router;
