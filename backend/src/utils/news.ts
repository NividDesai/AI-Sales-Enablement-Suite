import fetch from 'node-fetch'
import { config } from '../config'
import { logger } from './logger'

type CompanyNewsArticle = { title: string; url: string; source: string; publishedAt: string }

function deriveNewsTerms(raw: string): { query: string; matchTerms: string[] } {
  const trimmed = (raw || '').trim()
  if (!trimmed) return { query: '', matchTerms: [] }

  // Check if we received something that looks like a domain
  const looksLikeDomain = /^[\w.-]+\.[a-z]{2,}$/i.test(trimmed) && !/\s/.test(trimmed)
  const terms = new Set<string>()

  if (looksLikeDomain) {
    const domain = trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./i, '')
      .toLowerCase()

    if (domain) {
      terms.add(domain)
      const parts = domain.split('.')
      let baseParts = parts.slice(0, -1)

      // Handle multi-level TLDs like .co.uk
      if (parts.length >= 3 && parts[parts.length - 1].length === 2 && parts[parts.length - 2].length <= 3) {
        baseParts = parts.slice(0, -2)
      }

      const base = baseParts.join(' ')
      if (base) {
        terms.add(base.replace(/[-_]/g, ' ').trim())
      }
    }
  } else {
    const cleaned = trimmed.replace(/[^\w\s&.-]/g, ' ').replace(/\s+/g, ' ').trim()
    if (cleaned) terms.add(cleaned)
  }

  const matchTerms = Array.from(terms).map((t) => t.toLowerCase()).filter((t) => t.length > 2)
  const query = Array.from(terms)
    .filter(Boolean)
    .map((term) => `"${term}"`)
    .join(' OR ')

  return { query, matchTerms }
}

function filterArticlesByTerms(articles: any[], matchTerms: string[]): any[] {
  if (!matchTerms.length) return articles
  return articles.filter((article) => {
    const haystack = `${article?.title || ''} ${article?.description || ''} ${article?.source?.name || ''}`.toLowerCase()
    return matchTerms.some((term) => haystack.includes(term))
  })
}

// Fetch recent news for a company using NewsAPI
// Returns a compact list of { title, url, source, publishedAt }
export async function fetchCompanyNews(companyDomainOrName: string): Promise<Array<CompanyNewsArticle>> {
  if (!config.newsApiKey) return []
  try {
    const { query, matchTerms } = deriveNewsTerms(companyDomainOrName)
    const finalQuery = query || `"${companyDomainOrName}"`
    const q = encodeURIComponent(finalQuery)
    const url = `https://newsapi.org/v2/everything?q=${q}&pageSize=5&sortBy=publishedAt&language=en`
    const res = await fetch(url, { headers: { 'X-Api-Key': config.newsApiKey } } as any)
    if (!res.ok) {
      logger.warn('news:http', { status: res.status, q: companyDomainOrName })
      return []
    }
    const data = await res.json()
    const items = Array.isArray(data?.articles) ? data.articles : []
    const filtered = filterArticlesByTerms(items, matchTerms)
    const out = filtered
      .map((a: any) => ({
        title: a?.title,
        url: a?.url,
        source: a?.source?.name,
        publishedAt: a?.publishedAt,
      }))
      .filter((x: any) => x.title && x.url)
    logger.info('news:ok', { q: companyDomainOrName, count: out.length })
    return out
  } catch (e: any) {
    logger.warn('news:error', { q: companyDomainOrName, error: e?.message })
    return []
  }
}
