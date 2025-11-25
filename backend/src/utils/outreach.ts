import fetch from "node-fetch";
import { LeadRaw } from "../types";
import { config } from "../config";
import { logger } from "./logger";

export type SenderProfile = {
  name: string;
  title: string;
  company: string;
  email: string;
  // REQUIRED for CAN-SPAM compliance
  physicalAddress: string; // Street address, city, state, ZIP code
  phone?: string;
  meetingLink?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  emailTone?: "professional" | "casual" | "friendly";
  emailLength?: "short" | "medium" | "long";
  valueProposition?: string;
  keyBenefits?: string[];
  differentiators?: string[];
};

export type DraftEmail = {
  to: string;
  from: string;
  subject: string;
  body: string;
  leadId: string;
  lead: LeadRaw;
  generatedAt: string;
};

function systemPrompt(tone: string) {
  return `You are an expert B2B sales email writer. Create highly personalized, compelling cold emails that:\n\
1. Start with a specific, researched hook about the recipient\n\
2. Connect their challenges to our solution naturally\n\
3. Include social proof when relevant\n\
4. Have a clear, low-friction call-to-action\n\
5. Keep it concise (under 150 words)\n\
6. Use a ${tone} tone\n\
7. Feel genuine and human, not templated\n\
\nFormat the response as:\nSubject: [subject line]\n---\n[email body]`;
}

/**
 * Add tracking pixel with disclosure (required for legal compliance)
 * Includes disclosure text as required by privacy laws
 */
function addTrackingPixel(body: string, leadId: string, baseUrl?: string): string {
  try {
    const base = baseUrl || `http://localhost:${config.port}`;
    const pixelUrl = `${base}/api/track/${encodeURIComponent(leadId)}`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    
    // Add tracking disclosure (required by GDPR, CCPA, and best practices)
    const disclosure = `\n\n---\n<small style="color:#666;font-size:11px;">This email contains a tracking pixel to measure engagement. You can disable image loading in your email client to prevent tracking.</small>`;
    
    return `${body}${disclosure}\n\n${pixel}`;
  } catch {
    return body;
  }
}

/**
 * Generate unsubscribe link (required for CAN-SPAM, GDPR, CASL compliance)
 */
function generateUnsubscribeLink(email: string, leadId: string, baseUrl?: string): string {
  try {
    const base = baseUrl || `http://localhost:${config.port}`;
    const token = Buffer.from(`${email}:${leadId}:${Date.now()}`).toString('base64');
    return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  } catch {
    return "#";
  }
}

function buildPrompt(lead: LeadRaw, profile: SenderProfile): string {
  const company = (lead.company || lead.companyDomain || '').trim();
  const hasCompany = !!company;
  const companyLine = hasCompany ? `- Company: ${company}` : `- Company: (not provided)`;
  const website = (lead.companyWebsite || (lead.companyDomain ? `https://${lead.companyDomain}` : '')).trim();
  const recentNewsArr = Array.isArray((lead as any)?.companyContext?.recentNews) ? (lead as any).companyContext.recentNews : [];
  const recentNewsTop = recentNewsArr && recentNewsArr.length ? recentNewsArr.slice(0, 2).map((n: any) => `• ${n?.title || ''}`).join('\n') : (lead.notes || 'N/A');
  const techs = (lead.technologies || []) as string[];

  // Infer tone based on role/company presence as a soft bias
  const title = String(lead.title || '').toLowerCase();
  const isCLevel = /(chief\s|\bceo\b|\bcfo\b|\bcoo\b|\bcto\b|\bcmo\b|\bcpo\b|\bcio\b|\bfounder\b|\bco\-founder\b)/i.test(String(lead.title || ''));
  const isVPDir = /(vp|vice\s+president|director|head\s+of)/i.test(String(lead.title || ''));
  const inferredTone: Required<Pick<SenderProfile, 'emailTone'>>['emailTone'] = (!hasCompany ? 'friendly' : (isCLevel || isVPDir ? 'professional' : 'casual')) as any;
  const primaryTone = (profile.emailTone || inferredTone) as 'professional' | 'casual' | 'friendly';
  const toneRationale = !hasCompany
    ? 'Company is missing; lean more personable and friendly.'
    : (isCLevel || isVPDir) ? 'Senior role detected; keep it professional and concise.' : 'Mid/IC role; a casual tone can work.';

  return `Generate a personalized cold email for the following lead. Do not invent facts. If the company is missing, write to the person as an individual (e.g., freelancer/independent) and avoid fabricating a company name.

RECIPIENT INFO:
- Name: ${lead.name || ''}
- Title: ${lead.title || ''}
${companyLine}
- LinkedIn: ${lead.linkedinUrl || 'N/A'}
- Website: ${website || 'N/A'}
- Technologies Used: ${techs.length ? techs.join(', ') : 'N/A'}
- Recent Activity / Notes:
${recentNewsTop}

SENDER INFO:
- Name: ${profile.name}
- Title: ${profile.title}
- Company: ${profile.company}
- Value Proposition: ${profile.valueProposition || ''}
- Key Benefits: ${(profile.keyBenefits || []).join(', ')}
- Differentiators: ${(profile.differentiators || []).join(', ')}
- Meeting Link: ${profile.meetingLink || ''}
- Website: ${profile.websiteUrl || ''}

STYLE REQUIREMENTS:
1) Use a ${primaryTone} tone (hint: ${inferredTone}). Rationale: ${toneRationale}
2) Keep it under 150 words.
3) Start with a specific hook relevant to the recipient. If company is missing, address the person directly (do not assume a company).
4) Do not include placeholders or bracketed variables. Use only provided info.
5) End with a clear, low-friction CTA.
`;
}

export async function generateDraftEmail(lead: LeadRaw, profile: SenderProfile): Promise<DraftEmail | null> {
  if (!config.openaiApiKey) {
    logger.warn("outreach:openai:key_missing");
    return null;
  }
  try {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(profile.emailTone || "professional") },
        { role: "user", content: buildPrompt(lead, profile) },
      ],
      temperature: 0.7,
      max_tokens: 500,
    } as any;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn("outreach:openai:http", { status: res.status });
      return null;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    let subject = "";
    let bodyText = "";
    let inBody = false;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*Subject:/i.test(line)) {
        subject = line.replace(/^[^:]*:/, "").trim();
        continue;
      }
      if (line.includes("---")) { inBody = true; continue; }
      if (inBody) bodyText += line + "\n";
    }
    bodyText = bodyText.trim();
    if (!subject) {
      const who = (lead.name || '').trim();
      const org = (lead.company || lead.companyDomain || '').trim();
      if (who) subject = `Quick question for ${who}`;
      else if (org) subject = `Quick question about ${org}`;
      else subject = `Quick question`;
    }

    // Build compliant email body with all required elements
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
    const unsubscribeLink = generateUnsubscribeLink(lead.email || "", lead.leadId, baseUrl);
    const emailBody = `${bodyText}\n\n${signature(profile, unsubscribeLink)}\n\n${getComplianceFooter(profile, unsubscribeLink)}`;
    
    const draft: DraftEmail = {
      to: lead.email || "",
      from: `${profile.name} <${profile.email}>`,
      subject,
      body: addTrackingPixel(emailBody.trim(), lead.leadId, baseUrl),
      leadId: lead.leadId,
      lead,
      generatedAt: new Date().toISOString(),
    };
    return draft;
  } catch (e) {
    logger.warn("outreach:generate:error", { error: (e as any)?.message });
    return null;
  }
}

function signature(profile: SenderProfile, unsubscribeLink: string): string {
  const parts = [
    `Best regards,`,
    ``,
    profile.name,
    profile.title,
    profile.company,
    profile.physicalAddress, // REQUIRED for CAN-SPAM
    profile.phone ? `📱 ${profile.phone}` : '',
    profile.linkedinUrl ? `💼 ${profile.linkedinUrl}` : '',
    profile.websiteUrl ? `🌐 ${profile.websiteUrl}` : '',
    profile.meetingLink ? `📅 Book a call: ${profile.meetingLink}` : ''
  ].filter(Boolean);
  
  return parts.join('\n');
}

/**
 * Generate compliance footer with unsubscribe link (required by CAN-SPAM, GDPR, CASL)
 */
function getComplianceFooter(profile: SenderProfile, unsubscribeLink: string): string {
  return `\n---\n\nYou are receiving this email because we believe you may be interested in ${profile.company}'s services. If you no longer wish to receive emails from us, please [unsubscribe here](${unsubscribeLink}).\n\nThis email was sent to you in compliance with applicable email marketing laws.`;
}

export async function sendEmails(
  drafts: DraftEmail[],
  provider: "gmail" | "smtp",
  emailConfig: any
): Promise<{ sent: DraftEmail[]; failed: Array<DraftEmail & { error: string }> }> {
  const sent: DraftEmail[] = [];
  const failed: Array<DraftEmail & { error: string }> = [];
  
  // Check unsubscribes before sending (CAN-SPAM, GDPR, CASL requirement)
  const { isUnsubscribed } = await import("./unsubscribe");
  const { hasConsent } = await import("./privacy");
  
  const validDrafts = drafts.filter(d => {
    // Check if unsubscribed
    if (isUnsubscribed(d.to)) {
      logger.info("outreach:send:unsubscribed", { email: d.to });
      failed.push({ ...d, error: "Email address has unsubscribed" });
      return false;
    }
    
    // Check consent (GDPR requirement) - for cold emails, we assume legitimate interest
    // but you should verify consent for marketing emails
    // Uncomment the following if you require explicit consent:
    /*
    if (!hasConsent(d.to, "email_marketing")) {
      logger.info("outreach:send:no_consent", { email: d.to });
      failed.push({ ...d, error: "No consent for email marketing" });
      return false;
    }
    */
    
    return true;
  });

  if (validDrafts.length === 0) {
    logger.warn("outreach:send:no_valid_drafts", { total: drafts.length });
    return { sent, failed };
  }

  let transporter: any = null;
  try {
    const nodemailer = require("nodemailer");
    if (provider === "gmail") {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: emailConfig.user, pass: emailConfig.pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: !!emailConfig.secure,
        auth: { user: emailConfig.user, pass: emailConfig.pass },
      });
    }
    await transporter.verify();
  } catch (e: any) {
    // Nodemailer not installed or verify failed
    logger.warn("outreach:send:verify_failed", { provider, error: e?.message });
    for (const d of validDrafts) failed.push({ ...d, error: e?.message || "Email transport not available" });
    return { sent, failed };
  }

  for (const d of validDrafts) {
    try {
      // Convert plain text to HTML while preserving line breaks
      const htmlBody = d.body
        .replace(/\n/g, '<br>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'); // Convert markdown links
      
      await transporter.sendMail({ 
        from: d.from, 
        to: d.to, 
        subject: d.subject, 
        text: d.body,
        html: htmlBody
      });
      sent.push(d);
    } catch (e: any) {
      logger.warn("outreach:send:failed", { to: d.to, error: e?.message });
      failed.push({ ...d, error: e?.message || "send failed" });
    }
  }
  return { sent, failed };
}
