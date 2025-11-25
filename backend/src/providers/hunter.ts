import fetch from 'node-fetch'
import { config } from '../config'
import { logger } from '../utils/logger'

type HunterEmail = {
  value: string
  type?: string
  confidence?: number
  first_name?: string
  last_name?: string
  position?: string
  verification?: {
    status?: string // valid, accept_all, webmail, disposable, invalid, unknown
    score?: number
  }
  linkedin?: string
}

export async function hunterDomainSearch(domain: string): Promise<HunterEmail[]> {
  if (!config.hunterApiKey) return []
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${config.hunterApiKey}&limit=${config.hunterMaxEmailsPerDomain}`
  try {
    logger.info('hunter:domain:req', { domain, limit: config.hunterMaxEmailsPerDomain, keyLoaded: Boolean(config.hunterApiKey) })
    const res = await fetch(url)
    if (!res.ok) {
      if (res.status === 429) {
        // Rate limited - wait 2 seconds before returning empty (don't waste more requests)
        logger.warn('hunter:domain:rateLimited', { domain, status: res.status })
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        return []
      }
      logger.warn('hunter:domain:http', { status: res.status, domain })
      return []
    }
    const data = await res.json()
    const emails: HunterEmail[] = data?.data?.emails || []
    logger.info('hunter:domain:ok', { count: emails.length })
    return emails
  } catch (e) {
    logger.warn('hunter:domain:error', { domain })
    return []
  }
}

export async function hunterVerify(email: string): Promise<{ status?: string; score?: number } | null> {
  if (!config.hunterApiKey) return null
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${config.hunterApiKey}`
  try {
    logger.info('hunter:verify:req', { email, keyLoaded: Boolean(config.hunterApiKey) })
    const res = await fetch(url)
    if (!res.ok) {
      logger.warn('hunter:verify:http', { status: res.status })
      return null
    }
    const data = await res.json()
    logger.info('hunter:verify:ok', { status: data?.data?.status, score: data?.data?.score })
    return data?.data || null
  } catch (e) {
    logger.warn('hunter:verify:error')
    return null
  }
}


