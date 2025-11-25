import { Budget, costOf } from '../utils/budget'
import { hunterDomainSearch } from '../providers/hunter'
import { logger } from '../utils/logger'

export type AgentOptions = {
  title?: string
  domains: string[]
  prefer: Array<'hunter'>
  perDomainLimit?: number
  locations?: string[]
}

export async function agentEnrichEmails(opts: AgentOptions): Promise<Array<{ domain: string; email: string; name?: string; title?: string; source: string; linkedinUrl?: string; location?: string; phoneNumber?: string }>> {
  const out: Array<{ domain: string; email: string; name?: string; title?: string; source: string; linkedinUrl?: string; location?: string; phoneNumber?: string }> = []
  const budget = new Budget()

  for (const domain of opts.domains) {
    let domainCount = 0
    const perLimit = opts.perDomainLimit || 3
    for (const provider of opts.prefer) {
      if (provider === 'hunter') {
        const unit = costOf('hunterDomain')
        if (!budget.canSpend(unit)) { logger.info('agent:budget_exhausted'); return out }
        const emails = await hunterDomainSearch(domain)
        budget.spend(unit)
        for (const e of emails) {
          out.push({
            domain,
            email: e.value,
            name: [e.first_name, e.last_name].filter(Boolean).join(' ') || undefined,
            title: e.position,
            source: 'hunter',
            linkedinUrl: (e as any).linkedin as string | undefined,
          })
          domainCount++
          if (domainCount >= perLimit) break
        }
        if (domainCount >= perLimit) break
      }
    }
  }
  return out
}


