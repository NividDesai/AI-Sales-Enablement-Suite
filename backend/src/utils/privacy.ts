/**
 * Privacy policy and consent management
 * Required for GDPR, CCPA, and other data protection laws
 */

import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

const CONSENT_FILE = path.join(process.cwd(), "data", "consents.json");

// Ensure data directory exists
const dataDir = path.dirname(CONSENT_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export interface ConsentRecord {
  email: string;
  consentedAt: string;
  consentType: "email_marketing" | "data_processing" | "both";
  ipAddress?: string;
  userAgent?: string;
  revokedAt?: string;
}

/**
 * Check if user has given consent
 */
export function hasConsent(email: string, consentType: "email_marketing" | "data_processing" | "both" = "both"): boolean {
  try {
    if (!fs.existsSync(CONSENT_FILE)) {
      return false;
    }
    const content = fs.readFileSync(CONSENT_FILE, "utf-8");
    const records: ConsentRecord[] = JSON.parse(content);
    const emailLower = email.toLowerCase();
    
    const record = records.find(r => 
      r.email.toLowerCase() === emailLower && 
      !r.revokedAt &&
      (r.consentType === consentType || r.consentType === "both" || consentType === "both")
    );
    
    return !!record;
  } catch (error: any) {
    logger.warn("consent:check_error", { email, error: error?.message });
    return false;
  }
}

/**
 * Record consent
 */
export function recordConsent(
  email: string,
  consentType: "email_marketing" | "data_processing" | "both",
  ipAddress?: string,
  userAgent?: string
): boolean {
  try {
    const records: ConsentRecord[] = [];
    
    if (fs.existsSync(CONSENT_FILE)) {
      const content = fs.readFileSync(CONSENT_FILE, "utf-8");
      records.push(...JSON.parse(content));
    }
    
    // Remove any existing consent for this email (to avoid duplicates)
    const emailLower = email.toLowerCase();
    const filtered = records.filter(r => r.email.toLowerCase() !== emailLower);
    
    filtered.push({
      email: emailLower,
      consentedAt: new Date().toISOString(),
      consentType,
      ipAddress,
      userAgent,
    });
    
    fs.writeFileSync(CONSENT_FILE, JSON.stringify(filtered, null, 2), "utf-8");
    logger.info("consent:recorded", { email: emailLower, consentType });
    return true;
  } catch (error: any) {
    logger.error("consent:record_error", { email, error: error?.message });
    return false;
  }
}

/**
 * Revoke consent
 */
export function revokeConsent(email: string): boolean {
  try {
    if (!fs.existsSync(CONSENT_FILE)) {
      return false;
    }
    
    const content = fs.readFileSync(CONSENT_FILE, "utf-8");
    const records: ConsentRecord[] = JSON.parse(content);
    const emailLower = email.toLowerCase();
    
    const updated = records.map(r => {
      if (r.email.toLowerCase() === emailLower && !r.revokedAt) {
        return { ...r, revokedAt: new Date().toISOString() };
      }
      return r;
    });
    
    fs.writeFileSync(CONSENT_FILE, JSON.stringify(updated, null, 2), "utf-8");
    logger.info("consent:revoked", { email: emailLower });
    return true;
  } catch (error: any) {
    logger.error("consent:revoke_error", { email, error: error?.message });
    return false;
  }
}

/**
 * Generate privacy policy HTML
 */
export function generatePrivacyPolicy(companyName: string, contactEmail: string, websiteUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - ${companyName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    p { margin: 15px 0; }
    ul { margin: 15px 0; padding-left: 30px; }
    .last-updated { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="last-updated">Last Updated: ${new Date().toLocaleDateString()}</p>
  
  <h2>1. Introduction</h2>
  <p>${companyName} ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.</p>
  
  <h2>2. Information We Collect</h2>
  <p>We may collect the following types of information:</p>
  <ul>
    <li><strong>Personal Information:</strong> Name, email address, phone number, company name, job title</li>
    <li><strong>Usage Data:</strong> How you interact with our emails (opens, clicks)</li>
    <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
  </ul>
  
  <h2>3. How We Use Your Information</h2>
  <p>We use your information to:</p>
  <ul>
    <li>Send you marketing communications (with your consent)</li>
    <li>Improve our services</li>
    <li>Comply with legal obligations</li>
  </ul>
  
  <h2>4. Legal Basis for Processing (GDPR)</h2>
  <p>We process your personal data based on:</p>
  <ul>
    <li><strong>Consent:</strong> You have given clear consent for us to process your data</li>
    <li><strong>Legitimate Interest:</strong> For business communications with existing customers</li>
  </ul>
  
  <h2>5. Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li>Access your personal data</li>
    <li>Rectify inaccurate data</li>
    <li>Request deletion of your data</li>
    <li>Object to processing</li>
    <li>Data portability</li>
    <li>Withdraw consent at any time</li>
  </ul>
  
  <h2>6. Email Tracking</h2>
  <p>Our emails may contain tracking pixels to measure engagement. You can disable image loading in your email client to prevent tracking.</p>
  
  <h2>7. Data Retention</h2>
  <p>We retain your personal data only as long as necessary for the purposes outlined in this policy, or as required by law.</p>
  
  <h2>8. Data Security</h2>
  <p>We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.</p>
  
  <h2>9. Third-Party Services</h2>
  <p>We may use third-party services (e.g., email providers, analytics) that have their own privacy policies.</p>
  
  <h2>10. Contact Us</h2>
  <p>If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:</p>
  <ul>
    <li>Email: ${contactEmail}</li>
    ${websiteUrl ? `<li>Website: <a href="${websiteUrl}">${websiteUrl}</a></li>` : ''}
  </ul>
  
  <h2>11. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
</body>
</html>`;
}

