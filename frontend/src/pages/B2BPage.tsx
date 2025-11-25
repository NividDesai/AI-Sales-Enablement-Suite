import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CompanyInfo } from '../cvdoc/agent'
import TemplateBuilder from '../components/TemplateBuilder'
import { incUsage, addTask } from '../utils/usage'
import { SmartInput, SmartTextarea, SmartSelect } from '../components/ui/smart-input'
import { SectionCard } from '../components/ui/section-card'
import { AIButton } from '../components/ui/ai-button'
import { PageHeader } from '../components/ui/page-header'
import { 
  Mail, Download, User, Building2, Globe, 
  Palette, Image as ImageIcon, Video, Languages, FileCode, Briefcase
} from 'lucide-react'

export default function B2BPage() {
  // B2B doc state
  const [b2bCompanyName, setB2bCompanyName] = useState('')
  const [b2bIndustry, setB2bIndustry] = useState('')
  const [b2bWebsite, setB2bWebsite] = useState('')
  const [b2bValueProp, setB2bValueProp] = useState('')
  const [b2bDiffs, setB2bDiffs] = useState('')
  const [leadCompany, setLeadCompany] = useState('')
  const [leadPerson, setLeadPerson] = useState('')
  const [leadTitle, setLeadTitle] = useState('')
  const [b2bContext, setB2bContext] = useState('')
  const [b2bFormat, setB2bFormat] = useState<'pdf' | 'pptx' | 'html'>('pdf')
  const [b2bStatus, setB2bStatus] = useState('')
  const [b2bLang, setB2bLang] = useState<'en'|'fr'|'es'|'de'|'hi'>('en')
  const [b2bTemplateId, setB2bTemplateId] = useState('')
  const [leadWebsite, setLeadWebsite] = useState('')
  const [leadIndustry, setLeadIndustry] = useState('')
  const [leadSize, setLeadSize] = useState('')
  const [leadLogoUrl, setLeadLogoUrl] = useState('')
  const [leadBrandColor, setLeadBrandColor] = useState('#0d6efd')
  const [leadHeroImageUrl, setLeadHeroImageUrl] = useState('')
  const [leadVideoUrl, setLeadVideoUrl] = useState('')
  const [b2bPreviewHtml, setB2bPreviewHtml] = useState<string>('')
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false)
  const [isGeneratingB2B, setIsGeneratingB2B] = useState(false)

  function interpolateTemplate(html: string, data: Record<string, any>): string {
    if (!html) return html
    let out = html
    out = out.replace(/\{#if\s+([\w_.]+)\}([\s\S]*?)\{\/if\}/g, (_m, key, inner) => {
      const val = key.split('.').reduce((acc: any, k: string) => acc && acc[k], data)
      return val ? inner : ''
    })
    out = out.replace(/\{\{#if\s+([\w_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, key, inner) => {
      const val = key.split('.').reduce((acc: any, k: string) => acc && acc[k], data)
      return val ? inner : ''
    })
    out = out.replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_m, key) => {
      const val = key.split('.').reduce((acc: any, k: string) => acc && acc[k], data)
      return (val !== undefined && val !== null) ? String(val) : ''
    })
    return out
  }

  async function generateB2BPreview() {
    try {
      if (!b2bCompanyName || !leadCompany) {
        setB2bStatus('Enter your company and the lead company.')
        return
      }
      setIsGeneratingB2B(true)
      setB2bStatus('Generating preview...')
      const company: CompanyInfo = {
        name: b2bCompanyName,
        industry: b2bIndustry || undefined,
        website: b2bWebsite || undefined,
        valueProposition: b2bValueProp || undefined,
        differentiators: b2bDiffs.split(',').map(s => s.trim()).filter(Boolean),
      }
      const lead: any = { company: leadCompany, name: leadPerson || undefined, title: leadTitle || undefined }
      const leadDetails = {
        website: leadWebsite || undefined,
        industry: leadIndustry || undefined,
        size: leadSize || undefined,
        logoUrl: leadLogoUrl || undefined,
        brandColor: leadBrandColor || undefined,
        heroImageUrl: leadHeroImageUrl || undefined,
        videoUrl: leadVideoUrl || undefined,
      }
      const resp = await fetch('http://localhost:4000/api/docs/b2b', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company, lead, context: b2bContext || undefined, leadDetails, lang: b2bLang, format: 'html', designStyle: b2bTemplateId || 'modern' }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'failed to generate')
      }
      const html = await resp.text()
      const dataMap: Record<string, any> = {
        company: company.name,
        company_industry: company.industry,
        website: company.website,
        value_proposition: company.valueProposition,
        differentiators: company.differentiators,
        lead_company: lead.company,
        lead_name: lead.name,
        lead_title: lead.title,
        lead_industry: leadDetails.industry,
        lead_size: leadDetails.size,
        logo: leadDetails.logoUrl,
        brand_color: leadDetails.brandColor || leadBrandColor,
        hero: leadDetails.heroImageUrl,
        video: leadDetails.videoUrl,
        subject: `${company.name} → ${lead.company}`,
        opening: b2bContext,
      }
      const interpolated = interpolateTemplate(html, dataMap)
      setB2bPreviewHtml(interpolated)
      setB2bStatus('Preview ready.')
    } catch (e: any) {
      setB2bStatus('Error: ' + (e?.message || 'failed to generate preview'))
    } finally {
      setIsGeneratingB2B(false)
    }
  }

  async function generateB2BDoc(formatOverride?: string) {
    try {
      if (!b2bCompanyName || !leadCompany) {
        setB2bStatus('Enter your company and the lead company.')
        return
      }
      const actualFormat = formatOverride || b2bFormat
      setB2bStatus('Generating B2B document...')
      const company: CompanyInfo = {
        name: b2bCompanyName,
        industry: b2bIndustry || undefined,
        website: b2bWebsite || undefined,
        valueProposition: b2bValueProp || undefined,
        differentiators: b2bDiffs.split(',').map(s => s.trim()).filter(Boolean),
      }
      const lead: any = { company: leadCompany, name: leadPerson || undefined, title: leadTitle || undefined }
      const leadDetails = {
        website: leadWebsite || undefined,
        industry: leadIndustry || undefined,
        size: leadSize || undefined,
        logoUrl: leadLogoUrl || undefined,
        brandColor: leadBrandColor || undefined,
        heroImageUrl: leadHeroImageUrl || undefined,
        videoUrl: leadVideoUrl || undefined,
      }
      const resp = await fetch('http://localhost:4000/api/docs/b2b', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company, lead, context: b2bContext || undefined, leadDetails, lang: b2bLang, format: actualFormat, designStyle: b2bTemplateId || 'modern' }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'failed to generate')
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = actualFormat === 'pdf' ? 'pdf' : actualFormat === 'pptx' ? 'pptx' : 'html'
      a.download = `b2b-${company.name.replace(/\s+/g, '_')}-to-${lead.company.replace(/\s+/g, '_')}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setB2bStatus('B2B document generated.')
      try {
        incUsage({ docsGenerated: 1 })
        addTask({ id: String(Date.now()), type: 'doc', title: `Generated B2B ${ext.toUpperCase()} (${company.name} → ${lead.company})`, at: Date.now() })
      } catch {}
    } catch (e: any) {
      setB2bStatus('Error: ' + (e?.message || 'failed to generate document'))
    }
  }

  return (
    <div className="min-h-screen w-full bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <PageHeader
          title="B2B Outreach Document Generator"
          description="Create personalized B2B proposals and outreach materials"
          icon={<Briefcase className="w-6 h-6 text-white" />}
        />

        {/* Status Messages */}
        <AnimatePresence>
          {b2bStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm p-4 text-sm text-blue-300"
            >
              {b2bStatus}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section: B2B Outreach Document Generation */}
        <SectionCard
          title="B2B Outreach Document Generation"
          description="Create personalized B2B proposals and outreach materials"
          icon={<Mail className="w-5 h-5" />}
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Your Company
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmartInput
                  label="Company Name"
                  value={b2bCompanyName}
                  onChange={(e) => setB2bCompanyName(e.target.value)}
                  placeholder="e.g., Contoso"
                />
                <SmartInput
                  label="Industry"
                  value={b2bIndustry}
                  onChange={(e) => setB2bIndustry(e.target.value)}
                  placeholder="e.g., FinTech"
                />
                <SmartInput
                  label="Website"
                  value={b2bWebsite}
                  onChange={(e) => setB2bWebsite(e.target.value)}
                  placeholder="https://..."
                  icon={<Globe className="w-4 h-4" />}
                />
                <SmartInput
                  label="Value Proposition"
                  value={b2bValueProp}
                  onChange={(e) => setB2bValueProp(e.target.value)}
                  placeholder="1-liner value prop"
                />
                <SmartInput
                  label="Key Differentiators (comma separated)"
                  value={b2bDiffs}
                  onChange={(e) => setB2bDiffs(e.target.value)}
                  placeholder="diff1, diff2"
                />
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Lead Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmartInput
                  label="Lead Company"
                  value={leadCompany}
                  onChange={(e) => setLeadCompany(e.target.value)}
                  placeholder="e.g., Globex"
                />
                <SmartInput
                  label="Lead Person (optional)"
                  value={leadPerson}
                  onChange={(e) => setLeadPerson(e.target.value)}
                  placeholder="e.g., John Smith"
                />
                <SmartInput
                  label="Lead Title (optional)"
                  value={leadTitle}
                  onChange={(e) => setLeadTitle(e.target.value)}
                  placeholder="e.g., VP Ops"
                />
                <SmartInput
                  label="Target Website"
                  value={leadWebsite}
                  onChange={(e) => setLeadWebsite(e.target.value)}
                  placeholder="https://target.com"
                  icon={<Globe className="w-4 h-4" />}
                />
                <SmartInput
                  label="Target Industry"
                  value={leadIndustry}
                  onChange={(e) => setLeadIndustry(e.target.value)}
                  placeholder="e.g., Healthcare"
                />
                <SmartInput
                  label="Target Size"
                  value={leadSize}
                  onChange={(e) => setLeadSize(e.target.value)}
                  placeholder="e.g., 500-1000"
                />
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Branding & Visuals
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmartInput
                  label="Logo URL"
                  value={leadLogoUrl}
                  onChange={(e) => setLeadLogoUrl(e.target.value)}
                  placeholder="https://...logo.png"
                  icon={<ImageIcon className="w-4 h-4" />}
                />
                <SmartInput
                  label="Brand Color (hex)"
                  value={leadBrandColor}
                  onChange={(e) => setLeadBrandColor(e.target.value)}
                  placeholder="#0d6efd"
                  icon={<Palette className="w-4 h-4" />}
                />
                <SmartInput
                  label="Hero Image URL"
                  value={leadHeroImageUrl}
                  onChange={(e) => setLeadHeroImageUrl(e.target.value)}
                  placeholder="https://.../hero.jpg"
                  icon={<ImageIcon className="w-4 h-4" />}
                />
                <SmartInput
                  label="Video URL"
                  value={leadVideoUrl}
                  onChange={(e) => setLeadVideoUrl(e.target.value)}
                  placeholder="https://.../video"
                  icon={<Video className="w-4 h-4" />}
                />
              </div>
            </div>

            <SmartTextarea
              label="Additional Context (optional)"
              value={b2bContext}
              onChange={(e) => setB2bContext(e.target.value)}
              rows={3}
              expandable
              placeholder="Any additional context or notes..."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SmartSelect
                label="Format"
                value={b2bFormat}
                onChange={(e) => setB2bFormat(e.target.value as any)}
                options={[
                  { value: 'pdf', label: 'PDF' },
                  { value: 'html', label: 'HTML' },
                ]}
                icon={<FileCode className="w-4 h-4" />}
              />
              <SmartSelect
                label="Language"
                value={b2bLang}
                onChange={(e) => setB2bLang(e.target.value as any)}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                  { value: 'es', label: 'Español' },
                  { value: 'de', label: 'Deutsch' },
                  { value: 'hi', label: 'हिन्दी' },
                ]}
                icon={<Languages className="w-4 h-4" />}
              />
            </div>

            <SmartSelect
              label="Design Style"
              value={b2bTemplateId}
              onChange={(e) => setB2bTemplateId(e.target.value)}
              options={[
                { value: '', label: 'Modern & Professional (Default)' },
                { value: 'modern-b2b', label: 'Executive Proposal' },
                { value: 'creative', label: 'Creative & Bold' },
                { value: 'minimal', label: 'Minimal & Clean' },
                { value: 'tech', label: 'Tech & Innovation' },
              ]}
            />

            <div className="flex flex-wrap gap-3">
              <AIButton
                onClick={generateB2BPreview}
                disabled={!b2bCompanyName || !leadCompany || isGeneratingB2B}
                loading={isGeneratingB2B}
                className="flex-1 min-w-[200px]"
              >
                Generate Preview
              </AIButton>
              <motion.button
                onClick={() => generateB2BDoc('pdf')}
                disabled={!b2bCompanyName || !leadCompany}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </motion.button>
              <motion.button
                onClick={() => generateB2BDoc('html')}
                disabled={!b2bCompanyName || !leadCompany}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download HTML
              </motion.button>
            </div>

            {b2bPreviewHtml && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6"
              >
                <h4 className="text-white font-semibold mb-4">Live Preview</h4>
                <div className="rounded-lg overflow-hidden border border-white/10 bg-white" style={{ height: '700px' }}>
                  <iframe title="b2b-preview" className="w-full h-full border-0" srcDoc={b2bPreviewHtml}></iframe>
                </div>
              </motion.div>
            )}
          </div>
        </SectionCard>
      </div>

      {showTemplateBuilder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <TemplateBuilder
            onSave={async (template) => {
              try {
                setB2bStatus('Saving template...')
                const r = await fetch('http://localhost:4000/api/docs/templates', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(template)
                })
                const data = await r.json()
                if (!r.ok) throw new Error(data?.error || 'save failed')
                setB2bStatus('Template saved!')
                setB2bTemplateId(data?.template?.id || '')
                setShowTemplateBuilder(false)
              } catch (e: any) {
                setB2bStatus('Save error: ' + (e?.message || 'failed'))
              }
            }}
            onCancel={() => setShowTemplateBuilder(false)}
          />
        </div>
      )}
    </div>
  )
}

