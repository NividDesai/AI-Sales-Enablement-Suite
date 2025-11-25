import fetch from "node-fetch";
import { config } from "../config";
import { LeadRaw } from "../types";
import { logger } from "./logger";

function sanitizeDomain(d: string): string | null {
  let s = (d || "").trim().toLowerCase();
  // remove protocol and path
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\/(.*)$/g, "");
  // drop spaces and markdown
  s = s.replace(/[`*\s]+/g, "");
  // must contain a dot and valid chars
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return null;
  return s;
}

export async function aiSuggestDomains(
  industry: string,
  roleOrTitle: string,
  locations: string[],
  desired: number = 20
): Promise<string[]> {
  if (!config.openaiApiKey) {
    logger.warn("ai:domains:no-key");
    return [];
  }
  
  // Enhanced prompt with better context
  const locationStr = locations.length > 0 ? locations.join(", ") : "any location";
  const industryStr = industry || "various industries";
  const roleStr = roleOrTitle || "business professionals";
  
  const prompt = `Find real, existing company domains for:
- Industry: ${industryStr}
- Target Role: ${roleStr}
- Locations: ${locationStr}

Provide diverse companies that match these criteria.`;
  
  try {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that suggests real, existing company domains. Return ONLY a valid JSON array of domain strings (e.g., [\"stripe.com\",\"microsoft.com\",\"salesforce.com\"]). Do not include markdown code blocks, explanations, or any other text. Just the JSON array.",
        },
        {
          role: "user",
          content: `Suggest ${desired} relevant company domains. ${prompt}`,
        },
      ],
      temperature: 0.7, // Increased for more diversity
      max_tokens: 2000,
    } as any;
    
    logger.info("ai:domains:start", { desired, industry: industryStr, role: roleStr, locations: locationStr });
    
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      logger.warn("ai:domains:http", { status: res.status, error: errorText });
      return [];
    }
    
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    
    if (!text) {
      logger.warn("ai:domains:empty-response");
      return [];
    }
    
    let arr: string[] = [];
    
    // Try multiple parsing strategies
    try {
      // Strategy 1: Direct JSON parse
      const directParse = JSON.parse(text);
      if (Array.isArray(directParse)) {
        arr = directParse.filter((x: any) => typeof x === "string");
      }
    } catch {
      // Strategy 2: Extract JSON array from text
      try {
        const start = text.indexOf("[");
        const end = text.lastIndexOf("]");
        if (start !== -1 && end !== -1 && end > start) {
          const slice = text.slice(start, end + 1);
          const parsed = JSON.parse(slice);
          if (Array.isArray(parsed)) {
            arr = parsed.filter((x: any) => typeof x === "string");
          }
        }
      } catch {
        // Strategy 3: Extract domains using regex
        const domainRegex = /([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/gi;
        const matches = text.match(domainRegex);
        if (matches) {
          arr = matches;
        }
      }
    }
    
    // Clean and deduplicate
    const cleaned = Array.from(new Set(arr.map(sanitizeDomain).filter(Boolean) as string[]));
    const out = cleaned.slice(0, desired);
    
    logger.info("ai:domains:done", { count: out.length, sample: out.slice(0, 5), rawCount: arr.length });
    
    // If we got very few results, try a fallback with broader criteria
    if (out.length < Math.min(5, desired / 2) && (industry || roleOrTitle)) {
      logger.info("ai:domains:fallback", { reason: "low-count" });
      const fallbackPrompt = `Suggest ${desired} well-known company domains in ${industryStr || "technology"} sector. Include companies that might have ${roleStr || "executives"}.`;
      
      try {
        const fallbackBody = {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Return ONLY a JSON array of company domains. No markdown, no explanations.",
            },
            {
              role: "user",
              content: fallbackPrompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 2000,
        };
        
        const fallbackRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify(fallbackBody),
        });
        
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const fallbackText = fallbackData.choices?.[0]?.message?.content || "";
          let fallbackArr: string[] = [];
          
          try {
            const start = fallbackText.indexOf("[");
            const end = fallbackText.lastIndexOf("]");
            if (start !== -1 && end !== -1) {
              const slice = fallbackText.slice(start, end + 1);
              const parsed = JSON.parse(slice);
              if (Array.isArray(parsed)) {
                fallbackArr = parsed.filter((x: any) => typeof x === "string");
              }
            }
          } catch {
            const domainRegex = /([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/gi;
            const matches = fallbackText.match(domainRegex);
            if (matches) fallbackArr = matches;
          }
          
          const fallbackCleaned = Array.from(new Set(fallbackArr.map(sanitizeDomain).filter(Boolean) as string[]));
          const combined = Array.from(new Set([...out, ...fallbackCleaned]));
          const final = combined.slice(0, desired);
          logger.info("ai:domains:fallback-done", { count: final.length });
          return final;
        }
      } catch (e: any) {
        logger.warn("ai:domains:fallback-error", { error: e?.message });
      }
    }
    
    return out;
  } catch (e: any) {
    logger.warn("ai:domains:error", { error: e?.message });
    return [];
  }
}

export async function maybeGenerateQueries(
  baseQueries: string[],
  prompt: string,
  useAi: boolean
): Promise<string[]> {
  if (!useAi || !config.openaiApiKey) return baseQueries;
  try {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You create advanced boolean search queries for Google/Bing to find B2B leads. Return ONLY a JSON array of search queries as strings. No markdown, no code fences, no commentary.",
        },
        {
          role: "user",
          content: `Given these base queries: ${JSON.stringify(
            baseQueries
          )}. Context: ${prompt}. Produce up to 20 improved queries. Return only a JSON array of strings.`,
        },
      ],
      temperature: 0.3,
    } as any;
    logger.info("ai:queries:start", { baseCount: baseQueries.length });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn("ai:queries:http", { status: res.status });
      return baseQueries;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    // Try to extract a JSON array from the response
    let aiQueries: string[] | null = null;
    try {
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        const slice = text.slice(start, end + 1);
        const parsed = JSON.parse(slice);
        if (Array.isArray(parsed)) aiQueries = parsed.filter((x) => typeof x === "string");
      }
    } catch {}

    // Fallback: split into lines if JSON parsing failed
    if (!aiQueries) {
      const lines = text
        .split(/\r?\n/)
        .map((l: string) => l.replace(/^[-*\d.\s]+/, "").trim())
        .filter(Boolean);
      aiQueries = lines;
    }

    const sanitize = (q: string) => {
      let s = q.trim();
      // remove code fences/backticks and markdown bold markers
      if (s.includes("```")) return "";
      s = s.replace(/\*\*/g, "");
      // drop obvious headings
      if (/^([A-Za-z ]+:\s*)$/.test(s)) return "";
      // strip trailing colons and stray asterisks
      s = s.replace(/[:*]+\s*$/g, "");
      // keep lines that look like plausible queries
      const isPlausible = /site:\w+|\s/.test(s); // has site: OR at least a space (multi-word)
      if (!isPlausible) return "";
      // avoid very short leftovers
      if (s.length < 5) return "";
      return s;
    };

    const cleaned = (aiQueries || [])
      .map(sanitize)
      .filter(Boolean) as string[];

    const merged = Array.from(new Set(baseQueries.concat(cleaned))).slice(0, 20);
    const out = merged.length ? merged : baseQueries;
    logger.info("ai:queries:done", { outCount: out.length });
    logger.info("ai:queries:sample", { sample: out.slice(0, 5) });
    return out;
  } catch {
    logger.warn("ai:queries:error");
    return baseQueries;
  }
}

export async function maybeStructureWithAi(
  leads: LeadRaw[],
  useAi: boolean
): Promise<LeadRaw[]> {
  if (!useAi || !config.openaiApiKey || leads.length === 0) return leads;
  try {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a B2B sales research assistant. You refine each input lead into a richer JSON object. For each input, return an object that may add the following fields where possible: personalitySummary (string), strengths (array of strings), weaknesses (array of strings), talkingPoints (array of 3 concise outreach angles referencing role/company/industry). Keep the array length equal to input length and return ONLY a JSON array with objects matching the input order. Do not include markdown.",
        },
        {
          role: "user",
          content: `Input leads: ${JSON.stringify(leads)}`,
        },
      ],
      temperature: 0.2,
    };
    logger.info("ai:structure:start", { count: leads.length });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn("ai:structure:http", { status: res.status });
      return leads;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) return leads;
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed)) return leads;
    const structured = parsed.map((p: any, idx: number) => ({ ...leads[idx], ...p }));
    logger.info("ai:structure:done", { count: structured.length });
    return structured;
  } catch {
    logger.warn("ai:structure:error");
    return leads;
  }
}

/**
 * Use LLM to suggest job website URLs for companies
 * Batches multiple companies in one call to save credits
 */
export async function aiSuggestJobWebsites(
  companies: Array<{ domain: string; name?: string }>,
  useAi: boolean = true
): Promise<Record<string, string[]>> {
  if (!useAi || !config.openaiApiKey || companies.length === 0) {
    return {};
  }

  try {
    // Batch up to 10 companies per call to save credits
    const batchSize = 10;
    const results: Record<string, string[]> = {};
    
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      const companyList = batch.map(c => ({
        domain: c.domain,
        name: c.name || c.domain
      }));
      
      const body = {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that finds company job/careers website URLs. For each company, suggest the most likely URL(s) where they post job openings. Return ONLY a valid JSON object mapping company domains to arrays of job website URLs (e.g., {\"example.com\": [\"https://example.com/careers\", \"https://jobs.example.com\"]}). Do not include markdown code blocks, explanations, or any other text. Just the JSON object.",
          },
          {
            role: "user",
            content: `For these companies, suggest their job/careers website URLs:\n${JSON.stringify(companyList, null, 2)}\n\nReturn a JSON object mapping each domain to an array of likely job website URLs. Include common patterns like /careers, /jobs, careers.domain.com, jobs.domain.com, and any ATS platforms (Lever, Greenhouse, Workable, etc.) if you know them.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      } as any;
      
      logger.info("ai:jobWebsites:start", { batchSize: batch.length, companies: batch.map(c => c.domain) });
      
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        logger.warn("ai:jobWebsites:http", { status: res.status, error: errorText });
        continue;
      }
      
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content || "";
      
      if (!text) {
        logger.warn("ai:jobWebsites:empty-response");
        continue;
      }
      
      // Parse JSON response
      let parsed: Record<string, string[]> = {};
      try {
        // Try direct JSON parse
        const directParse = JSON.parse(text);
        if (typeof directParse === 'object' && directParse !== null) {
          parsed = directParse;
        }
      } catch {
        // Try extracting JSON object from text
        try {
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start !== -1 && end !== -1 && end > start) {
            const slice = text.slice(start, end + 1);
            parsed = JSON.parse(slice);
          }
        } catch (e) {
          logger.warn("ai:jobWebsites:parse-error", { error: String(e) });
          continue;
        }
      }
      
      // Merge results
      for (const [domain, urls] of Object.entries(parsed)) {
        if (Array.isArray(urls) && urls.length > 0) {
          // Clean domain key (remove protocol, www, etc.)
          const cleanDomain = sanitizeDomain(domain) || domain.toLowerCase().replace(/^www\./, '');
          if (cleanDomain) {
            // Clean URLs - ensure they're valid
            const cleanUrls = urls
              .filter((url: any) => typeof url === 'string' && url.length > 0)
              .map((url: string) => {
                // If URL doesn't start with http, try to construct it
                if (!url.startsWith('http')) {
                  if (url.startsWith('/')) {
                    return `https://${cleanDomain}${url}`;
                  } else if (url.includes('.')) {
                    return `https://${url}`;
                  } else {
                    return `https://${cleanDomain}/${url}`;
                  }
                }
                return url;
              })
              .filter((url: string) => {
                try {
                  new URL(url);
                  return true;
                } catch {
                  return false;
                }
              });
            
            if (cleanUrls.length > 0) {
              results[cleanDomain] = cleanUrls.slice(0, 5); // Limit to 5 URLs per company
            }
          }
        }
      }
      
      logger.info("ai:jobWebsites:done", { batch: batch.length, found: Object.keys(results).length });
    }
    
    return results;
  } catch (e: any) {
    logger.warn("ai:jobWebsites:error", { error: e?.message });
    return {};
  }
}


