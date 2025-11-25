/**
 * robots.txt compliance checker
 * 
 * LEGAL NOTICE: Web scraping may violate terms of service and applicable laws.
 * Always check robots.txt, respect rate limits, and obtain proper authorization
 * before scraping websites. This utility helps with robots.txt compliance but
 * does not guarantee legal compliance.
 */

import { httpGet } from "./scrape";
import { logger } from "./logger";
import { config } from "../config";

export type RobotsRule = {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
};

export type RobotsTxt = {
  rules: RobotsRule[];
  sitemaps: string[];
  defaultCrawlDelay?: number;
};

// Cache robots.txt files to avoid repeated requests
const robotsCache = new Map<string, { robots: RobotsTxt | null; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Parse robots.txt content
 */
function parseRobotsTxt(content: string): RobotsTxt {
  const lines = content.split(/\r?\n/).map(l => l.trim());
  const robots: RobotsTxt = { rules: [], sitemaps: [] };
  
  let currentRule: RobotsRule | null = null;
  let defaultCrawlDelay: number | undefined;

  for (const line of lines) {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (key === 'user-agent') {
      // Save previous rule
      if (currentRule) {
        robots.rules.push(currentRule);
      }
      // Start new rule
      currentRule = {
        userAgent: value.toLowerCase(),
        disallow: [],
        allow: [],
      };
    } else if (key === 'disallow' && currentRule) {
      if (value) {
        currentRule.disallow.push(value);
      } else {
        // Empty disallow means allow all
        currentRule.allow.push('*');
      }
    } else if (key === 'allow' && currentRule) {
      currentRule.allow.push(value);
    } else if (key === 'crawl-delay' && currentRule) {
      const delay = parseFloat(value);
      if (!isNaN(delay) && delay >= 0) {
        currentRule.crawlDelay = delay;
      }
    } else if (key === 'crawl-delay' && !currentRule) {
      // Global crawl delay
      const delay = parseFloat(value);
      if (!isNaN(delay) && delay >= 0) {
        defaultCrawlDelay = delay;
      }
    } else if (key === 'sitemap') {
      robots.sitemaps.push(value);
    }
  }

  // Save last rule
  if (currentRule) {
    robots.rules.push(currentRule);
  }

  robots.defaultCrawlDelay = defaultCrawlDelay;
  return robots;
}

/**
 * Get robots.txt for a domain (with caching)
 */
export async function getRobotsTxt(baseUrl: string): Promise<RobotsTxt | null> {
  try {
    const url = new URL(baseUrl);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    
    // Check cache
    const cached = robotsCache.get(robotsUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.robots;
    }

    logger.info("robots:fetch", { url: robotsUrl });
    const content = await httpGet(robotsUrl);
    
    if (!content) {
      // No robots.txt found - allow by default (per standard)
      robotsCache.set(robotsUrl, { robots: null, timestamp: Date.now() });
      return null;
    }

    const robots = parseRobotsTxt(content);
    robotsCache.set(robotsUrl, { robots, timestamp: Date.now() });
    return robots;
  } catch (error: any) {
    logger.warn("robots:error", { url: baseUrl, error: error?.message });
    // On error, assume no robots.txt (allow by default)
    return null;
  }
}

/**
 * Check if a URL is allowed by robots.txt
 */
export function isUrlAllowed(robots: RobotsTxt | null, url: string, userAgent: string = '*'): boolean {
  if (!robots || robots.rules.length === 0) {
    // No robots.txt or no rules = allow by default
    return true;
  }

  const ua = userAgent.toLowerCase();
  const urlPath = new URL(url).pathname;

  // Find matching user-agent rules (most specific first)
  const matchingRules = robots.rules.filter(r => {
    if (r.userAgent === '*') return true;
    if (r.userAgent === ua) return true;
    // Check if user-agent contains the rule pattern
    return ua.includes(r.userAgent) || r.userAgent.includes(ua);
  });

  // If no matching rules, allow
  if (matchingRules.length === 0) return true;

  // Check most specific rule first (non-wildcard)
  const specificRule = matchingRules.find(r => r.userAgent !== '*') || matchingRules[0];

  // Check allow rules first (more specific)
  for (const allowPattern of specificRule.allow) {
    if (matchesPattern(urlPath, allowPattern)) {
      return true;
    }
  }

  // Check disallow rules
  for (const disallowPattern of specificRule.disallow) {
    if (matchesPattern(urlPath, disallowPattern)) {
      return false;
    }
  }

  // Default: allow if no disallow matches
  return true;
}

/**
 * Get crawl delay for a user-agent
 */
export function getCrawlDelay(robots: RobotsTxt | null, userAgent: string = '*'): number {
  if (!robots) return 0;

  const ua = userAgent.toLowerCase();
  const matchingRule = robots.rules.find(r => {
    if (r.userAgent === '*') return true;
    if (r.userAgent === ua) return true;
    return ua.includes(r.userAgent) || r.userAgent.includes(ua);
  });

  if (matchingRule?.crawlDelay !== undefined) {
    return matchingRule.crawlDelay * 1000; // Convert to milliseconds
  }

  if (robots.defaultCrawlDelay !== undefined) {
    return robots.defaultCrawlDelay * 1000;
  }

  return 0;
}

/**
 * Check if URL path matches a robots.txt pattern
 */
function matchesPattern(path: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === '') return true; // Empty disallow = allow all

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\$/g, '$');

  const regex = new RegExp(`^${regexPattern}`);
  return regex.test(path);
}

/**
 * Check if scraping a URL is compliant with robots.txt
 * Returns { allowed: boolean, crawlDelay: number }
 */
export async function checkRobotsCompliance(
  url: string,
  userAgent: string = config.userAgent
): Promise<{ allowed: boolean; crawlDelay: number }> {
  try {
    const robots = await getRobotsTxt(url);
    const allowed = isUrlAllowed(robots, url, userAgent);
    const crawlDelay = getCrawlDelay(robots, userAgent);

    if (!allowed) {
      logger.warn("robots:disallowed", { url, userAgent });
    }

    return { allowed, crawlDelay };
  } catch (error: any) {
    logger.warn("robots:check_failed", { url, error: error?.message });
    // On error, allow but with default delay
    return { allowed: true, crawlDelay: 1000 }; // 1 second default delay
  }
}

