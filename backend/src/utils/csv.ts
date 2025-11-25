import { createObjectCsvStringifier } from "csv-writer";
import { LeadRaw } from "../types";

export function leadsToCsv(leads: LeadRaw[]): string {
  const headers = [
    { id: "leadId", title: "lead_id" },
    { id: "name", title: "name" },
    { id: "title", title: "title" },
    { id: "company", title: "company" },
    { id: "companyDomain", title: "company_domain" },
    { id: "companyWebsite", title: "company_website" },
    { id: "email", title: "email" },
    { id: "phoneNumber", title: "phone_number" },
    { id: "linkedinUrl", title: "linkedin_url" },
    { id: "description", title: "description" },
    { id: "technologies", title: "technologies" },
    { id: "socialProfiles", title: "social_profiles" },
    { id: "careersLinks", title: "careers_links" },
    { id: "activeJobCount", title: "active_job_count" },
    { id: "foundedYear", title: "founded_year" },
    { id: "companySize", title: "company_size" },
    { id: "lastSeenActivity", title: "last_seen_activity" },
    { id: "personalitySummary", title: "personality_summary" },
    { id: "strengths", title: "strengths" },
    { id: "weaknesses", title: "weaknesses" },
    { id: "talkingPoints", title: "talking_points" },
    { id: "rawSources", title: "raw_sources" },
    { id: "capturedAt", title: "captured_at" },
  ];

  const csvStringifier = createObjectCsvStringifier({ header: headers });
  const records = leads.map((l) => ({
    ...l,
    technologies: (l.technologies || []).join("; "),
    socialProfiles: (l.socialProfiles || []).join("; "),
    careersLinks: (l.careersLinks || []).join("; "),
    activeJobCount: l.activeJobCount ?? "",
    rawSources: (l.rawSources || []).join("; "),
    strengths: Array.isArray(l.strengths) ? l.strengths.join("; ") : (l.strengths || ""),
    weaknesses: Array.isArray(l.weaknesses) ? l.weaknesses.join("; ") : (l.weaknesses || ""),
    talkingPoints: Array.isArray(l.talkingPoints) ? l.talkingPoints.join(" | ") : (l.talkingPoints || ""),
  }));
  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
}


