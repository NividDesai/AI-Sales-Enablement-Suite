import * as cheerio from "cheerio";
import { logger } from "./logger";
import { httpGet } from "./scrape";
import { checkRobotsCompliance } from "./robots";
import { config } from "../config";

/**
 * ⚠️ LEGAL NOTICE: Scraping job listings may violate:
 * - Website terms of service
 * - ATS platform terms (Lever, Greenhouse, Workable, etc.)
 * - Data protection laws (GDPR, CCPA)
 * 
 * Always verify you have authorization before scraping job listings.
 * Consider using official job APIs when available.
 */

export type JobPosting = {
  title: string;
  department?: string | null;
  location?: string | null;
  type?: string | null;
  description?: string | null;
  postedDate?: string | null;
  applyUrl: string;
  sourceUrl: string;
  scrapedAt: string;
};

export class JobListingEnricher {
  private selectors: string[] = [
    ".job-listing",
    ".careers-job",
    ".position",
    ".opening",
    "[data-qa=\"job\"]",
    ".lever-job",
    ".job-post",
    ".career-item",
    "li[class*=job]",
  ];

  async getCompanyJobs(domain: string, companyName?: string): Promise<JobPosting[]> {
    const cleanDomain = (domain || "").replace(/^www\./, "");
    if (!cleanDomain) return [];
    logger.info("jobs:start", { domain: cleanDomain });

    const allJobs: JobPosting[] = [];
    const urls = this.generateJobUrls(cleanDomain, companyName || cleanDomain);

    for (const url of urls) {
      try {
        // Check robots.txt before scraping job listings
        const compliance = await checkRobotsCompliance(url, config.userAgent);
        if (!compliance.allowed) {
          logger.warn("jobs:robots_disallowed", { url });
          continue;
        }
        
        const html = await httpGet(url);
        if (!html) continue;
        const $ = cheerio.load(html);
        let jobs = this.extractJobsWithSelectors($, url);
        if (jobs.length === 0) {
          jobs = this.extractJobsFromText(html, url);
        }
        if (jobs.length) {
          allJobs.push(...jobs);
        }
      } catch (e: any) {
        logger.warn("jobs:scrape_failed", { url, error: e?.message || String(e) });
      }
    }

    const unique = this.deduplicateJobs(allJobs);
    logger.info("jobs:complete", { domain: cleanDomain, count: unique.length });
    return unique.slice(0, 20);
  }

  private generateJobUrls(domain: string, companyName: string): string[] {
    const companySlug = this.generateCompanySlug(companyName || domain);
    return [
      `https://${domain}/careers`,
      `https://${domain}/jobs`,
      `https://jobs.${domain}`,
      `https://careers.${domain}`,
      `https://${domain}/about/careers`,
      `https://${companySlug}.lever.co`,
      `https://jobs.lever.co/${companySlug}`,
      `https://boards.greenhouse.io/${companySlug}`,
      `https://${companySlug}.workable.com`,
      `https://apply.workable.com/${companySlug}`,
      `https://${companySlug}.bamboohr.com/jobs/`,
    ];
  }

  private generateCompanySlug(name: string): string {
    return (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private extractJobsWithSelectors($: cheerio.CheerioAPI, sourceUrl: string): JobPosting[] {
    const jobs: JobPosting[] = [];
    for (const selector of this.selectors) {
      $(selector).each((_, el) => {
        const job = this.extractJobData($, el as any, sourceUrl);
        if (job.title) jobs.push(job);
      });
      if (jobs.length > 0) break;
    }
    return jobs;
  }

  private extractJobData($: cheerio.CheerioAPI, element: any, sourceUrl: string): JobPosting {
    const $el = $(element as any);
    const title = this.cleanText($el.find("h1, h2, h3, .title, .job-title, [data-qa=\"job-title\"]").first().text());
    const department = this.cleanText($el.find(".department, .team, [data-qa=\"department\"]").first().text()) || null;
    const location = this.cleanText($el.find(".location, [data-qa=\"location\"]").first().text()) || null;
    const type = this.cleanText($el.find(".type, .employment-type, [data-qa=\"job-type\"]").first().text()) || null;
    const description = this.cleanText($el.find(".description, .job-description").first().text()).slice(0, 500) || null;
    const postedDate = this.extractDate(this.cleanText($el.find(".date, .posted, [data-qa=\"posted-date\"]").first().text()));
    const applyUrl = this.extractApplyUrl($el, sourceUrl);
    return { title, department, location, type, description, postedDate, applyUrl, sourceUrl, scrapedAt: new Date().toISOString() };
  }

  private extractJobsFromText(html: string, sourceUrl: string): JobPosting[] {
    const jobs: JobPosting[] = [];
    const $ = cheerio.load(html);
    const text = $.text();
    const jobTitleRegex = /(software engineer|product manager|data scientist|sales|marketing|designer|developer|analyst|director|manager|coordinator|specialist|associate)/gi;
    const matches = text.match(jobTitleRegex);
    if (matches) {
      const uniqueTitles = [...new Set(matches.map((t) => this.cleanText(t)))];
      uniqueTitles.slice(0, 10).forEach((title) => {
        jobs.push({
          title,
          department: null,
          location: null,
          type: null,
          description: null,
          postedDate: null,
          applyUrl: sourceUrl,
          sourceUrl: sourceUrl,
          scrapedAt: new Date().toISOString(),
        });
      });
    }
    return jobs;
  }

  private extractDate(dateText?: string | null): string | null {
    if (!dateText) return null;
    const d = new Date(dateText);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  private extractApplyUrl($el: cheerio.Cheerio<any>, sourceUrl: string): string {
    const link = $el.find('a[href*="apply"], a[href*="job"]').first().attr('href') || '';
    if (!link) return sourceUrl;
    if (link.startsWith('http')) return link;
    if (link.startsWith('/')) return new URL(sourceUrl).origin + link;
    return sourceUrl.replace(/\/?$/, '/') + link;
  }

  private cleanText(text?: string): string {
    return (text || '').trim().replace(/\s+/g, ' ');
  }

  private deduplicateJobs(jobs: JobPosting[]): JobPosting[] {
    const seen = new Set<string>();
    return jobs.filter((job) => {
      const key = `${(job.title||'').toLowerCase()}_${(job.department||'').toLowerCase()}_${(job.location||'').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
