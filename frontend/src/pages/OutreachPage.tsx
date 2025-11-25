import { useState, useEffect, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { incUsage, addTask } from '../utils/usage'
import { SmartInput, SmartTextarea, SmartSelect, SmartToggle } from '../components/ui/smart-input'
import { SectionCard } from '../components/ui/section-card'
import { AIButton } from '../components/ui/ai-button'
import { useAuth } from '../components/AuthProvider'
import { PageHeader } from '../components/ui/page-header'
import {
  Mail, Upload, MessageSquare, Sparkles, Send, CheckCircle2,
  XCircle, Download, RefreshCw, FileText, Settings, AlertTriangle, ExternalLink
} from 'lucide-react'

type Lead = Record<string, any>

export default function OutreachPage() {
  const { user } = useAuth()
  
  // Outreach state - all profile data comes from user profile
  const [emailTone, setEmailTone] = useState<'professional'|'casual'|'friendly'>('professional')
  const [valueProp, setValueProp] = useState('')
  const [keyBenefits, setKeyBenefits] = useState('')
  const [differentiators, setDifferentiators] = useState('')
  const [drafts, setDrafts] = useState<any[]>([])
  const [outreachStatus, setOutreachStatus] = useState('')
  const [lastSendFailed, setLastSendFailed] = useState<Array<{ to: string; error: string }>>([])
  const [uploadedLeads, setUploadedLeads] = useState<Lead[]>([])
  const [useUploaded, setUseUploaded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)

  function splitCsvLine(line: string): string[] {
    const res: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        res.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    res.push(cur)
    return res.map(s => s.trim())
  }

  function parseCsvToLeads(csv: string): Lead[] {
    const lines = csv.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return []
    const header = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase())
    const idx = (name: string) => header.findIndex(h => h === name.toLowerCase())
    const iName = idx('name'), iTitle = idx('title'), iCompany = idx('company'), iEmail = idx('email')
    const iPhone = idx('phone'), iLinkedin = (idx('linkedin') >= 0 ? idx('linkedin') : idx('linkedinurl'))
    const iDomain = (idx('companydomain') >= 0 ? idx('companydomain') : idx('domain'))
    const iLocation = idx('location')
    const out: Lead[] = []
    for (let li = 1; li < lines.length; li++) {
      const row = splitCsvLine(lines[li])
      if (!row || row.length === 0) continue
      const email = (iEmail >= 0 ? row[iEmail] : '') || ''
      if (!email) continue
      const companyDomain = iDomain >= 0 ? (row[iDomain] || '') : ''
      out.push({
        leadId: `${(companyDomain || (iCompany >= 0 ? row[iCompany] : 'csv'))}_${email}`,
        name: iName >= 0 ? row[iName] : undefined,
        title: iTitle >= 0 ? row[iTitle] : undefined,
        company: iCompany >= 0 ? row[iCompany] : undefined,
        companyDomain: companyDomain || undefined,
        companyWebsite: companyDomain ? `https://${companyDomain}` : undefined,
        email,
        phoneNumber: iPhone >= 0 ? row[iPhone] : undefined,
        linkedinUrl: iLinkedin >= 0 ? row[iLinkedin] : undefined,
        location: iLocation >= 0 ? row[iLocation] : undefined,
        notes: 'source=csv',
      } as any)
    }
    return out
  }

  async function generateOutreach() {
    setOutreachStatus('Generating personalized emails...')
    setIsGenerating(true)
    try {
      const leadsToUse = uploadedLeads.length > 0 ? uploadedLeads : []
      if (!leadsToUse || leadsToUse.length === 0) {
        setOutreachStatus('No leads to generate emails for. Upload a CSV first.')
        return
      }
      if (!user?.name || !user?.position || !user?.company || !user?.email) {
        setOutreachStatus('Please fill Name, Title, Company, and Email in your account settings.')
        return
      }
      const profile = {
        name: user.name,
        title: user.position,
        company: user.company,
        email: user.email,
        phone: user.phone || undefined,
        meetingLink: user.meetingLink || undefined,
        websiteUrl: user.websiteUrl || undefined,
        linkedinUrl: user.linkedinUrl || undefined,
        emailTone,
        emailLength: 'short' as const,
        valueProposition: valueProp || undefined,
        keyBenefits: keyBenefits ? keyBenefits.split(',').map(s => s.trim()).filter(Boolean) : [],
        differentiators: differentiators ? differentiators.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
      const resp = await fetch('http://localhost:4000/api/outreach/preview', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leads: leadsToUse, profile }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'failed to generate drafts')
      setDrafts(Array.isArray(data?.drafts) ? data.drafts.map((d: any) => ({ ...d, approved: false })) : [])
      setOutreachStatus(`Generated ${Array.isArray(data?.drafts) ? data.drafts.length : 0} drafts.`)
      try {
        const count = Array.isArray(data?.drafts) ? data.drafts.length : 0
        if (count > 0) {
          incUsage({ emailsGenerated: count as any })
          addTask({ id: String(Date.now()), type: 'emails', title: `Generated ${count} email drafts`, at: Date.now() })
        }
      } catch {}
    } catch (e: any) {
      setOutreachStatus('Error: ' + (e?.message || 'failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function sendOutreach() {
    setOutreachStatus('Sending emails...')
    setIsSending(true)
    try {
      if (!drafts || drafts.length === 0) {
        setOutreachStatus('No drafts to send.')
        return
      }
      const approvedDrafts = drafts.filter((d) => d.approved)
      if (approvedDrafts.length === 0) {
        setOutreachStatus('No approved drafts. Please approve at least one draft before sending.')
        return
      }
      // Load email settings from user profile
      const emailSettings = user?.emailSettings || {}
      const sendProvider = emailSettings.sendProvider || 'gmail'
      const emailConfig = sendProvider === 'gmail' ?
        { user: emailSettings.smtpUser || user?.email || '', pass: emailSettings.smtpPass || '' } :
        { 
          host: emailSettings.smtpHost || '', 
          port: emailSettings.smtpPort || 587, 
          secure: Boolean(emailSettings.smtpSecure), 
          user: emailSettings.smtpUser || '', 
          pass: emailSettings.smtpPass || '' 
        }
      const resp = await fetch('http://localhost:4000/api/outreach/send', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ drafts: approvedDrafts, provider: sendProvider, emailConfig }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'failed to send')
      const failedList: Array<{ to: string; error: string }> = Array.isArray(data?.failed) ? data.failed.map((f: any) => ({ to: f?.to || f?.lead?.email || '(unknown)', error: f?.error || 'send failed' })) : []
      setLastSendFailed(failedList)
      const firstErr = failedList[0]?.error
      setOutreachStatus(`Sent: ${data?.sent?.length || 0}, Failed: ${failedList.length}${firstErr ? ` — First error: ${firstErr}` : ''}`)
    } catch (e: any) {
      setOutreachStatus('Error: ' + (e?.message || 'failed'))
    } finally {
      setIsSending(false)
    }
  }

  async function regenerateDraft(index: number) {
    const d = drafts[index]
    if (!d) return
    try {
      setOutreachStatus(`Regenerating draft ${index+1}...`)
      const profile = {
        name: user?.name || '',
        title: user?.position || '',
        company: user?.company || '',
        email: user?.email || '',
        phone: user?.phone || undefined,
        meetingLink: user?.meetingLink || undefined,
        websiteUrl: user?.websiteUrl || undefined,
        linkedinUrl: user?.linkedinUrl || undefined,
        emailTone,
        emailLength: 'short' as const,
        valueProposition: valueProp || undefined,
        keyBenefits: keyBenefits ? keyBenefits.split(',').map(s => s.trim()).filter(Boolean) : [],
        differentiators: differentiators ? differentiators.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
      const resp = await fetch('http://localhost:4000/api/outreach/preview', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leads: [d.lead], profile }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'failed to regenerate')
      const nd = Array.isArray(data?.drafts) && data.drafts[0]
      if (nd) {
        setDrafts(prev => prev.map((x, idx) => idx === index ? { ...nd, approved: x.approved } : x))
        setOutreachStatus(`Regenerated draft ${index+1}.`)
      } else {
        setOutreachStatus('Regeneration returned no draft')
      }
    } catch (e: any) {
      setOutreachStatus('Error: ' + (e?.message || 'failed'))
    }
  }

  function downloadDrafts() {
    const blob = new Blob([JSON.stringify(drafts, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'drafts.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <PageHeader
          title="Email Outreach Generator"
          description="Create personalized email campaigns with AI-powered content generation"
          icon={<Mail className="w-6 h-6 text-white" />}
        />

        {/* Status Messages */}
        <AnimatePresence>
          {outreachStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm p-4 text-sm text-blue-300"
            >
              {outreachStatus}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 1: CSV Upload & Lead Management */}
        <SectionCard
          title="Lead Management"
          description="Upload CSV file with lead information"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload CSV (columns: name, title, company, email, phone, linkedinUrl, companyDomain, location)
              </label>
              <motion.input
                type="file"
                accept="text/csv,.csv"
                onChange={async (e) => {
                  try {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const text = await file.text()
                    const parsed = parseCsvToLeads(text)
                    setUploadedLeads(parsed)
                    setOutreachStatus(`Uploaded ${parsed.length} leads from CSV.`)
                  } catch (err: any) {
                    setOutreachStatus('Error parsing CSV: ' + (err?.message || 'unknown'))
                  }
                }}
                whileHover={{ scale: 1.02 }}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base bg-black/20 backdrop-blur-sm border border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-white/20 file:text-sm file:font-medium file:bg-white file:text-black hover:file:bg-white/90 hover:file:text-black cursor-pointer transition-all hover:bg-black/30 hover:border-white/20"
              />
            </div>

            {uploadedLeads.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 flex items-center justify-between flex-wrap gap-3"
              >
                <div className="flex items-center gap-3">
                  <SmartToggle
                    label={`Use uploaded leads (${uploadedLeads.length})`}
                    checked={useUploaded}
                    onChange={setUseUploaded}
                  />
                </div>
                <motion.button
                  onClick={() => { setUploadedLeads([]); setUseUploaded(false); }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm font-medium transition-all"
                >
                  Clear
                </motion.button>
              </motion.div>
            )}
          </div>
        </SectionCard>


        {/* Section 3: Email Configuration */}
        <SectionCard
          title="Email Configuration"
          description="Customize tone, messaging, and value proposition"
          icon={<MessageSquare className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <SmartSelect
              label="Email Tone"
              value={emailTone}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setEmailTone(e.target.value as any)}
              options={[
                { value: 'professional', label: 'Professional' },
                { value: 'casual', label: 'Casual' },
                { value: 'friendly', label: 'Friendly' },
              ]}
              icon={<Sparkles className="w-4 h-4" />}
            />
            <SmartInput
              label="Value Proposition (optional)"
              value={valueProp}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setValueProp(e.target.value)}
              placeholder="1 line value prop"
            />
            <SmartInput
              label="Key Benefits (comma separated)"
              value={keyBenefits}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyBenefits(e.target.value)}
              placeholder="benefit1, benefit2"
            />
            <SmartInput
              label="Differentiators (comma separated)"
              value={differentiators}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDifferentiators(e.target.value)}
              placeholder="diff1, diff2"
            />
            <div className="flex flex-wrap gap-3 pt-2">
              <AIButton
                onClick={generateOutreach}
                disabled={uploadedLeads.length === 0 || isGenerating}
                loading={isGenerating}
                className="flex-1 min-w-[200px]"
              >
                Generate Draft Emails
              </AIButton>
            </div>
          </div>
        </SectionCard>

        {/* Section 4: Email Drafts */}
        {drafts.length > 0 && (
          <SectionCard
            title={`Email Drafts (${drafts.length})`}
            description="Review and edit generated email drafts"
            icon={<Mail className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <motion.button
                  onClick={() => setDrafts(prev => prev.map((d) => ({ ...d, approved: true })))}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve All
                </motion.button>
                <motion.button
                  onClick={downloadDrafts}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </motion.button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {drafts.map((d, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 sm:p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <SmartToggle
                          label="Approve"
                          checked={!!d.approved}
                          onChange={(checked: boolean) => setDrafts(prev => prev.map((x, idx) => idx === i ? { ...x, approved: checked } : x))}
                        />
                        <div className="text-sm text-white/70">
                          <span className="font-medium text-white">To:</span> {d.to}
                        </div>
                      </div>
                    </div>

                    <SmartInput
                      label="Subject"
                      value={d.subject}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setDrafts(prev => prev.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))}
                    />

                    <SmartTextarea
                      label="Body"
                      value={d.body}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDrafts(prev => prev.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))}
                      rows={6}
                      expandable
                    />

                    <div className="flex gap-3">
                      <motion.button
                        onClick={() => regenerateDraft(i)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Regenerate
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {/* Section 5: Send Configuration */}
        {drafts.length > 0 && (
          <SectionCard
            title="Send Emails"
            description="Email settings are configured in Settings page"
            icon={<Send className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                <Settings className="w-5 h-5 text-white mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-white/80 mb-1">Email provider settings are managed in your Settings page</p>
                  <a 
                    href="/settings" 
                    className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    Configure email settings
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60">Current Provider:</span>
                  <span className="text-sm font-medium text-white">
                    {user?.emailSettings?.sendProvider === 'smtp' ? 'SMTP' : 'Gmail'}
                  </span>
                </div>
                {user?.emailSettings?.sendProvider === 'smtp' && (
                  <div className="mt-2 space-y-1 text-xs text-white/50">
                    <div>Host: {user.emailSettings.smtpHost || 'Not configured'}</div>
                    <div>Port: {user.emailSettings.smtpPort || 587}</div>
                  </div>
                )}
                {(!user?.emailSettings?.smtpUser || !user?.emailSettings?.smtpPass) && (
                  <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs">
                    ⚠️ Email credentials not configured. Please set them up in Settings.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <AIButton
                  onClick={sendOutreach}
                  disabled={drafts.length === 0 || isSending || !user?.emailSettings?.smtpUser || !user?.emailSettings?.smtpPass}
                  loading={isSending}
                  className="flex-1 min-w-[200px]"
                >
                  Send Emails
                </AIButton>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Failed Recipients */}
        {lastSendFailed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-white" />
              <h4 className="text-white font-semibold">Failed Recipients ({lastSendFailed.length})</h4>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              {lastSendFailed.slice(0, 5).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-white">{f.to}</span>: {f.error}
                  </div>
                </li>
              ))}
            </ul>
            {lastSendFailed.length > 5 && (
              <div className="mt-3 text-xs text-white/50">
                …and {lastSendFailed.length - 5} more
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
