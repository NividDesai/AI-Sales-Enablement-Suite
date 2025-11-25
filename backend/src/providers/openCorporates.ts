import fetch from 'node-fetch'
import { config } from '../config'
import { logger } from '../utils/logger'

export async function ocSearchCompanies(query: string, jurisdictionCode?: string): Promise<{ name: string; company_number?: string; jurisdiction_code?: string }[]> {
  if (!config.openCorporatesApiKey) return []
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}${jurisdictionCode ? `&jurisdiction_code=${jurisdictionCode}` : ''}&api_token=${config.openCorporatesApiKey}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const items = data?.results?.companies || []
    return items.map((c: any) => c.company).map((c: any) => ({ name: c?.name, company_number: c?.company_number, jurisdiction_code: c?.jurisdiction_code }))
  } catch (e) {
    logger.warn('opencorporates:error', { query })
    return []
  }
}


