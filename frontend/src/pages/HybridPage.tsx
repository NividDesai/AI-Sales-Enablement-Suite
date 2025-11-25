import { useState, useEffect, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { incUsage, addTask } from '../utils/usage'
import { SmartInput, SmartSelect, SmartToggle } from '../components/ui/smart-input'
import { SectionCard } from '../components/ui/section-card'
import { AIButton } from '../components/ui/ai-button'
import { PremiumButton } from '../components/ui/premium-button'
import { PageHeader } from '../components/ui/page-header'
import {
  Search, MapPin, Users, Building2, Calendar, Code, Database,
  Sparkles, Download, ExternalLink, Mail,
  Linkedin, Briefcase, TrendingUp, Video, Loader2
} from 'lucide-react'

type Lead = Record<string, any>

const STORAGE_KEY = 'leadforge_leads'
const STORAGE_STATS_KEY = 'leadforge_stats'

export default function HybridPage() {
  const [industry, setIndustry] = useState('')
  const [role, setRole] = useState('')
  const [locations, setLocations] = useState('')
  const [numLeads, setNumLeads] = useState(10)
  const [useAi] = useState(true) // Always enabled and locked
  const [status, setStatus] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [verifyEmails, setVerifyEmails] = useState(false)
  const [stats, setStats] = useState<{ total: number; hunter: number; verified: number } | null>(null)
  const [isStartup, setIsStartup] = useState(false)
  const [sectors, setSectors] = useState('')
  const [technologies, setTechnologies] = useState('')
  const [companySizeRange, setCompanySizeRange] = useState('')
  const [foundedYearMin, setFoundedYearMin] = useState('')
  const [foundedYearMax, setFoundedYearMax] = useState('')
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [creatingPersona, setCreatingPersona] = useState<string | null>(null)

  // Load leads from localStorage on mount
  useEffect(() => {
    try {
      const storedLeads = localStorage.getItem(STORAGE_KEY)
      if (storedLeads) {
        const parsedLeads = JSON.parse(storedLeads)
        if (Array.isArray(parsedLeads) && parsedLeads.length > 0) {
          setLeads(parsedLeads)
          setStatus(`Loaded ${parsedLeads.length} leads from previous session.`)
        }
      }
      const storedStats = localStorage.getItem(STORAGE_STATS_KEY)
      if (storedStats) {
        const parsedStats = JSON.parse(storedStats)
        setStats(parsedStats)
      }
    } catch (e) {
      console.warn('Failed to load leads from localStorage:', e)
    }
  }, [])

  // Save leads to localStorage whenever they change
  useEffect(() => {
    if (leads.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leads))
        // Also store in window for backward compatibility
        ;(window as any).__LEADS__ = leads
      } catch (e) {
        console.warn('Failed to save leads to localStorage:', e)
      }
    }
  }, [leads])

  // Save stats to localStorage whenever they change
  useEffect(() => {
    if (stats) {
      try {
        localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats))
      } catch (e) {
        console.warn('Failed to save stats to localStorage:', e)
      }
    }
  }, [stats])


  async function run() {
    setStatus('Discovering...')
    setLeads([])
    setIsDiscovering(true)
    const locs = locations.split(',').map((s: string) => s.trim()).filter(Boolean)
    try {
      const discoverResp = await fetch('http://localhost:4000/api/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          industry,
          roleOrTitle: role,
          locations: locs,
          numLeads,
          isStartup,
          sectors: sectors.split(',').map((s: string)=>s.trim()).filter(Boolean),
          technologies: technologies.split(',').map((s: string)=>s.trim()).filter(Boolean),
          companySizeRange: companySizeRange || undefined,
          foundedYearMin: foundedYearMin ? Number(foundedYearMin) : undefined,
          foundedYearMax: foundedYearMax ? Number(foundedYearMax) : undefined,
        }),
      })
      const discover = await discoverResp.json()
      setStatus(`Found ${discover.urls?.length || 0} candidate URLs. Enriching...`)
      const enrichBody = {
        urls: discover.urls || [],
        limit: numLeads,
        useAi,
        title: role,
        locations: locs,
        isStartup,
        sectors: sectors.split(',').map((s: string)=>s.trim()).filter(Boolean),
        technologies: technologies.split(',').map((s: string)=>s.trim()).filter(Boolean),
        companySizeRange: companySizeRange || undefined,
        foundedYearMin: foundedYearMin ? Number(foundedYearMin) : undefined,
        foundedYearMax: foundedYearMax ? Number(foundedYearMax) : undefined,
        providers: { verify: verifyEmails },
      }
      const enrichResp = await fetch('http://localhost:4000/api/enrich', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(enrichBody),
      })
      const { leads, stats } = await enrichResp.json()
      setLeads(leads)
      setStats(stats || null)
      setStatus(`Done. ${leads?.length || 0} leads.`)
      try {
        incUsage({ leadsRuns: 1 })
        addTask({ id: String(Date.now()), type: 'leads', title: `Discover: ${role || 'Role'} (${leads?.length || 0})`, at: Date.now(), meta: { industry, locations: locs } })
      } catch {}
    } catch (e: any) {
      setStatus('Error: ' + (e?.message || 'unknown'))
    } finally {
      setIsDiscovering(false)
    }
  }

  async function exportCsv() {
    const resp = await fetch('http://localhost:4000/api/export/csv', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leads }),
    })
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function createPersonaFromLead(lead: Lead) {
    setCreatingPersona(lead.leadId || '')
    try {
      const resp = await fetch('http://localhost:4000/api/avatar/personas/from-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lead),
      })
      if (!resp.ok) throw new Error('Failed to create persona')
      const persona = await resp.json()
      setStatus(`Persona "${persona.name}" created! You can now practice with them in AI Avatar Practice.`)
      // Optionally navigate to avatar page
      setTimeout(() => {
        window.location.href = '/avatar'
      }, 2000)
    } catch (e: any) {
      setStatus('Error creating persona: ' + (e?.message || 'unknown'))
    } finally {
      setCreatingPersona(null)
    }
  }

  const hasLeads = Array.isArray(leads) && leads.length > 0

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <PageHeader
          title="Lead Generation"
          description="Discover and enrich leads with AI-powered intelligence"
          icon={<Users className="w-6 h-6 text-white" />}
        />

        {/* Status Messages */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm p-4 text-sm text-blue-300"
            >
              {status}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Criteria */}
        <SectionCard
          title="Search Criteria"
          description="Define your target audience and requirements"
          icon={<Search className="w-5 h-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartInput
              label="Industry"
              value={industry}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setIndustry(e.target.value)}
              placeholder="e.g., SaaS"
              icon={<Building2 className="w-4 h-4" />}
            />
            <SmartInput
              label="Role/Title"
              value={role}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
              placeholder="e.g., Head of Marketing"
              icon={<Briefcase className="w-4 h-4" />}
            />
            <SmartInput
              label="Location(s) (comma-separated)"
              value={locations}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLocations(e.target.value)}
              placeholder="e.g., SF Bay Area, New York"
              icon={<MapPin className="w-4 h-4" />}
            />
            <SmartInput
              label="Number of leads"
              type="number"
              min={1}
              max={200}
              value={numLeads}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNumLeads(Number(e.target.value) || 10)}
            />
          </div>
        </SectionCard>

        {/* Advanced Filters */}
        <SectionCard
          title="Advanced Filters"
          description="Refine your search with additional criteria"
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartToggle
              label="Startup only"
              checked={isStartup}
              onChange={setIsStartup}
            />
            <SmartInput
              label="Sectors/Tags (comma-separated)"
              value={sectors}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSectors(e.target.value)}
              placeholder="e.g., fintech, ai, saas"
              icon={<Code className="w-4 h-4" />}
            />
            <SmartInput
              label="Technologies (comma-separated)"
              value={technologies}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTechnologies(e.target.value)}
              placeholder="e.g., react, python, aws"
              icon={<Database className="w-4 h-4" />}
            />
            <SmartSelect
              label="Company Size"
              value={companySizeRange}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCompanySizeRange(e.target.value)}
              options={[
                { value: '', label: 'Any' },
                { value: '1-10', label: '1-10' },
                { value: '11-50', label: '11-50' },
                { value: '51-200', label: '51-200' },
                { value: '201-1000', label: '201-1000' },
                { value: '1001+', label: '1001+' },
              ]}
            />
            <SmartInput
              label="Founded Year Min"
              type="number"
              value={foundedYearMin}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFoundedYearMin(e.target.value)}
              placeholder="e.g., 2018"
              icon={<Calendar className="w-4 h-4" />}
            />
            <SmartInput
              label="Founded Year Max"
              type="number"
              value={foundedYearMax}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFoundedYearMax(e.target.value)}
              placeholder="e.g., 2024"
              icon={<Calendar className="w-4 h-4" />}
            />
            <div className="relative">
              <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span>AI Structuring</span>
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-black/20 text-white border border-white/20">Always On</span>
              </label>
              <div className="rounded-lg bg-black/20 border border-white/10 px-4 py-3 flex items-center justify-between">
                <span className="text-white/60 text-sm">AI-powered lead structuring is enabled</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-sm font-medium">Active</span>
                </div>
              </div>
            </div>
            <SmartSelect
              label="Verify Emails"
              value={verifyEmails ? 'yes' : 'no'}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setVerifyEmails(e.target.value === 'yes')}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <AIButton
              onClick={run}
              disabled={isDiscovering}
              loading={isDiscovering}
              className="flex-1 min-w-[200px]"
            >
              Discover + Enrich
            </AIButton>
            <PremiumButton
              onClick={exportCsv}
              disabled={!hasLeads}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </PremiumButton>
          </div>
        </SectionCard>

        {/* Provider Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 sm:p-6"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Provider Usage
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/50 mb-2">Total</div>
                <div className="text-2xl sm:text-3xl font-bold text-white">{stats.total}</div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-white/50 mb-2">Hunter</div>
                <div className="text-2xl sm:text-3xl font-bold text-white">{stats.hunter}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Generated Leads Table */}
        {hasLeads && (
          <SectionCard
            title={`Generated Leads (${leads.length})`}
            description="View and manage your discovered leads"
            icon={<Users className="w-5 h-5" />}
          >
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden max-h-[600px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">LinkedIn</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Jobs</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider min-w-[220px]">Personality</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider min-w-[160px]">Strengths</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider min-w-[160px]">Weaknesses</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider min-w-[220px]">Talking Points</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider min-w-[220px]">Recent News</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/5 divide-y divide-white/10">
                      {leads.map((l, idx) => {
                        const strengths = Array.isArray(l.strengths) ? l.strengths.join(', ') : l.strengths || ''
                        const weaknesses = Array.isArray(l.weaknesses) ? l.weaknesses.join(', ') : l.weaknesses || ''
                        const talkingPoints = Array.isArray(l.talkingPoints) ? (l.talkingPoints as string[]).join(' • ') : l.talkingPoints || ''
                        const news = Array.isArray(l?.companyContext?.recentNews) ? l.companyContext.recentNews : []
                        const careers = Array.isArray(l?.careersLinks) ? l.careersLinks : []
                        const newsTip = news.slice(0, 3).map((n: any) => `• ${n?.title || ''}`).join('\n')
                        const jobsTip = careers.slice(0, 3).map((u: string, i: number) => `• [${i+1}] ${u}`).join('\n')
                        return (
                          <tr key={l.leadId || idx} className="hover:bg-white/10 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white">{l.name || ''}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">{l.title || ''}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">{l.companyDomain || l.company || ''}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {l.email ? (
                                <a href={`mailto:${l.email}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {l.email}
                                </a>
                              ) : ''}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">{l.phoneNumber || ''}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {l.linkedinUrl ? (
                                <a href={l.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                  <Linkedin className="w-3 h-3" />
                                  Profile
                                </a>
                              ) : ''}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm" title={jobsTip}>
                              {careers.length > 0 ? (
                                <a href={careers[0]} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  Jobs{typeof l.activeJobCount === 'number' ? ` (${l.activeJobCount})` : ''}
                                </a>
                              ) : ''}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70">{l.personalitySummary || ''}</td>
                            <td className="px-4 py-3 text-sm text-white/70">{strengths}</td>
                            <td className="px-4 py-3 text-sm text-white/70">{weaknesses}</td>
                            <td className="px-4 py-3 text-sm text-white/70">{talkingPoints}</td>
                            <td className="px-4 py-3 text-sm" title={newsTip}>
                              {news.length > 0 ? (
                                <a href={news[0].url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  {news[0].title}
                                </a>
                              ) : ''}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <button
                                onClick={() => createPersonaFromLead(l)}
                                disabled={creatingPersona === (l.leadId || '')}
                                className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {creatingPersona === (l.leadId || '') ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Video className="w-3 h-3" />
                                    Practice
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
