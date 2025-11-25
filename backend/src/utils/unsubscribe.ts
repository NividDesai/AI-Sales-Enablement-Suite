/**
 * Unsubscribe management for email compliance
 * Stores unsubscribed emails to prevent future emails (CAN-SPAM, GDPR, CASL requirement)
 */

import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

const UNSUBSCRIBE_FILE = path.join(process.cwd(), "data", "unsubscribes.json");

// Ensure data directory exists
const dataDir = path.dirname(UNSUBSCRIBE_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

interface UnsubscribeRecord {
  email: string;
  unsubscribedAt: string;
  source?: string;
}

/**
 * Load unsubscribed emails from file
 */
function loadUnsubscribes(): Set<string> {
  try {
    if (!fs.existsSync(UNSUBSCRIBE_FILE)) {
      return new Set();
    }
    const content = fs.readFileSync(UNSUBSCRIBE_FILE, "utf-8");
    const records: UnsubscribeRecord[] = JSON.parse(content);
    return new Set(records.map(r => r.email.toLowerCase()));
  } catch (error: any) {
    logger.warn("unsubscribe:load_error", { error: error?.message });
    return new Set();
  }
}

/**
 * Save unsubscribed email to file
 */
function saveUnsubscribe(email: string, source?: string): void {
  try {
    const records: UnsubscribeRecord[] = [];
    
    // Load existing records
    if (fs.existsSync(UNSUBSCRIBE_FILE)) {
      const content = fs.readFileSync(UNSUBSCRIBE_FILE, "utf-8");
      const existing = JSON.parse(content);
      records.push(...existing);
    }
    
    // Add new unsubscribe (avoid duplicates)
    const emailLower = email.toLowerCase();
    if (!records.some(r => r.email.toLowerCase() === emailLower)) {
      records.push({
        email: emailLower,
        unsubscribedAt: new Date().toISOString(),
        source,
      });
      
      fs.writeFileSync(UNSUBSCRIBE_FILE, JSON.stringify(records, null, 2), "utf-8");
      logger.info("unsubscribe:saved", { email: emailLower });
    }
  } catch (error: any) {
    logger.error("unsubscribe:save_error", { email, error: error?.message });
  }
}

/**
 * Check if email is unsubscribed
 */
export function isUnsubscribed(email: string): boolean {
  const unsubscribes = loadUnsubscribes();
  return unsubscribes.has(email.toLowerCase());
}

/**
 * Add email to unsubscribe list
 */
export function unsubscribeEmail(email: string, source?: string): boolean {
  try {
    saveUnsubscribe(email, source);
    return true;
  } catch (error: any) {
    logger.error("unsubscribe:error", { email, error: error?.message });
    return false;
  }
}

/**
 * Get all unsubscribed emails (for admin/debugging)
 */
export function getAllUnsubscribes(): UnsubscribeRecord[] {
  try {
    if (!fs.existsSync(UNSUBSCRIBE_FILE)) {
      return [];
    }
    const content = fs.readFileSync(UNSUBSCRIBE_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    logger.warn("unsubscribe:get_all_error", { error: error?.message });
    return [];
  }
}

