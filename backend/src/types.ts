export type LeadInput = {
  industry: string;
  roleOrTitle: string;
  locations: string[];
  numLeads: number;
  useAi: boolean;
};

export type LeadRaw = {
  leadId: string;
  name?: string;
  title?: string;
  company?: string;
  companyDomain?: string;
  companyWebsite?: string;
  email?: string;
  phoneNumber?: string;
  linkedinUrl?: string;
  location?: string;
  description?: string;
  technologies?: string[];
  socialProfiles?: string[];
  careersLinks?: string[];
  // Jobs enrichment
  companyJobs?: Array<{
    title: string;
    location?: string | null;
    applyUrl: string;
    sourceUrl: string;
  }>;
  activeJobCount?: number;
  foundedYear?: number | null;
  companySize?: string | null;
  lastSeenActivity?: string | null;
  notes?: string;
  rawSources?: string[];
  capturedAt: string;
  // Outreach-oriented enrichment
  personalitySummary?: string;
  strengths?: string[] | string;
  weaknesses?: string[] | string;
  talkingPoints?: string[] | string;
  // Optional LinkedIn enrichment payload
  linkedinData?: any;
};

export type LeadStructured = Required<Omit<LeadRaw, "name" | "title" | "company" | "companyDomain" | "companyWebsite" | "email" | "linkedinUrl" | "location" | "description" | "technologies" | "socialProfiles" | "foundedYear" | "companySize" | "lastSeenActivity" | "notes" | "rawSources">> & LeadRaw;


