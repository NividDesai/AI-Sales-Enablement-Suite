import fetch from 'node-fetch'
import { config } from '../config'
import { logger } from '../utils/logger'

let apolloDisabled = false

export async function apolloPeopleSearch(domain: string, title?: string, limit = 5, locations?: string[]): Promise<any[]> {
  if (!config.apolloEnabled) { logger.info('apollo:disabled:config'); return [] }
  if (!config.apolloApiKey) return []
  if (apolloDisabled) { logger.info('apollo:disabled:plan'); return [] }
  // Include api_key as query param for compatibility, still send header
  const url = `https://api.apollo.io/v1/mixed_people/search?api_key=${encodeURIComponent(config.apolloApiKey)}`
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'X-Api-Key': config.apolloApiKey, 'Authorization': `Bearer ${config.apolloApiKey}` }
    const payload: Record<string, any> = {
      page: 1,
      per_page: limit,
      q_organization_domains: [domain],
    }
    if (title) {
      // Provide multiple fields to maximize match likelihood across API versions
      payload.title = title
      payload.person_titles = [title]
    }
    if (locations && locations.length) {
      payload.person_locations = locations
    }
    logger.info('apollo:people:req', { domain, title, limit })
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      let err: any = null
      try { err = await res.json() } catch {}
      const code = err?.error_code || ''
      logger.warn('apollo:people:http', { status: res.status, domain, code })
      if (res.status === 403 || code === 'API_INACCESSIBLE') {
        apolloDisabled = true
        logger.warn('apollo:disabled:plan')
        return []
      }
      // Fallback to people/search endpoint with alternative payload naming
      return await apolloPeopleFallback(domain, title, limit, locations, headers)
    }
    const data = await res.json()
    let people = data?.people || []
    if (!Array.isArray(people) || people.length === 0) {
      logger.info('apollo:people:empty', { domain })
      people = await apolloPeopleFallback(domain, title, limit, locations, headers)
    } else {
      logger.info('apollo:people:ok', { count: people.length })
    }
    return people
  } catch (e) {
    logger.warn('apollo:people:error', { domain })
    return []
  }
}

async function apolloPeopleFallback(domain: string, title: string | undefined, limit: number, locations: string[] | undefined, headers: Record<string, string>): Promise<any[]> {
  try {
    const url2 = `https://api.apollo.io/v1/people/search?api_key=${encodeURIComponent(config.apolloApiKey)}`
    const payload2: Record<string, any> = {
      page: 1,
      per_page: limit,
      q_organization_domains: [domain],
    }
    if (title) {
      payload2.person_titles = [title]
      payload2.title = title
    }
    if (locations && locations.length) {
      payload2.person_locations = locations
      payload2.locations = locations
    }
    logger.info('apollo:people:req:fallback', { domain, title, limit })
    const res2 = await fetch(url2, { method: 'POST', headers, body: JSON.stringify(payload2) })
    if (!res2.ok) {
      let err: any = null
      try { err = await res2.json() } catch {}
      const code = err?.error_code || ''
      logger.warn('apollo:people:http:fallback', { status: res2.status, domain, code })
      if (res2.status === 403 || code === 'API_INACCESSIBLE') {
        apolloDisabled = true
        logger.warn('apollo:disabled:plan')
        return []
      }
      return []
    }
    const data2 = await res2.json()
    const people2 = data2?.people || []
    logger.info('apollo:people:ok:fallback', { count: Array.isArray(people2) ? people2.length : 0 })
    return people2
  } catch {
    return []
  }
}


