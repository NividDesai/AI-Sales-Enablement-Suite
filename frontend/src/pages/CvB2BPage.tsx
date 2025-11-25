import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as mammoth from 'mammoth/mammoth.browser'
import type { UserProfile, JobPosting, CompanyInfo } from '../cvdoc/agent'
import TemplateBuilder from '../components/TemplateBuilder'
import { incUsage, addTask } from '../utils/usage'
import { SmartInput, SmartTextarea, SmartSelect } from '../components/ui/smart-input'
import { SectionCard } from '../components/ui/section-card'
import { AIButton } from '../components/ui/ai-button'
import { PageHeader } from '../components/ui/page-header'
import { 
  FileText, Sparkles, Target, Mail, Upload, Download, Eye, 
  User, Briefcase, Building2, Globe, Link as LinkIcon, 
  Palette, Image as ImageIcon, Video, Languages, FileCode
} from 'lucide-react'

export default function CvB2BPage() {
  // CV/Doc state
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [parsedProfile, setParsedProfile] = useState<UserProfile | null>(null)
  const [cvStatus, setCvStatus] = useState('')
  const [isParsing, setIsParsing] = useState(false)

  // Tailoring form state
  const [jobCompany, setJobCompany] = useState('')
  const [jobPosition, setJobPosition] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobRequirements, setJobRequirements] = useState('')
  const [jobPreferences, setJobPreferences] = useState('')
  const [cvFormat, setCvFormat] = useState<'pdf' | 'html' | 'docx'>('pdf')
  const [jobUrl, setJobUrl] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [cvTemplateCss] = useState('')
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)

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

  function injectCss(html: string, css: string): string {
    if (!css) return html
    const styleTag = `<style>${css}</style>`
    let out = html
    if (out.includes('</head>')) return out.replace('</head>', styleTag + '</head>')
    return styleTag + out
  }

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

  async function importJobFromUrl() {
    try {
      if (!jobUrl) return
      setCvStatus('Importing job details...')
      const resp = await fetch('http://localhost:4000/api/docs/job-from-url', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: jobUrl }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'failed to parse job url')
      const j = data.job || {}
      setJobCompany(j.company || '')
      setJobPosition(j.position || '')
      setJobDescription(j.description || '')
      setJobRequirements(Array.isArray(j.requirements) ? j.requirements.join(', ') : '')
      setCvStatus('Job details imported successfully.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to import job'))
    }
  }

  async function parseCV() {
    try {
      if (!cvFile) {
        setCvStatus('Please select a CV file (.pdf, .docx, .txt).')
        return
      }
      setIsParsing(true)
      setCvStatus('Parsing CV...')
      const fd = new FormData()
      const file = cvFile as File
      fd.append('file', file, file.name)
      const resp = await fetch('http://localhost:4000/api/docs/parse-cv', { method: 'POST', body: fd })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'parse failed')
      let prof: any = data.profile || {}
      if (!prof.photoDataUrl && file.name.toLowerCase().endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          await (mammoth as any).convertToHtml({ arrayBuffer }, {
            convertImage: (mammoth as any).images.imgElement(async (image: any) => {
              const b64 = await image.read('base64')
              const contentType = image.contentType || 'image/png'
              const dataUrl = `data:${contentType};base64,${b64}`
              if (!prof.photoDataUrl) prof.photoDataUrl = dataUrl
              return { src: dataUrl }
            })
          })
        } catch {}
      }
      setParsedProfile(prof as any)
      setCvStatus('CV parsed successfully.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to parse CV'))
    } finally {
      setIsParsing(false)
    }
  }

  async function generateTailoredPreviewHtml() {
    try {
      if (!parsedProfile) {
        setCvStatus('Parse a CV first.')
        return
      }
      if (!jobCompany || !jobPosition) {
        setCvStatus('Enter target company and position.')
        return
      }
      setIsGeneratingPreview(true)
      setCvStatus('Generating HTML preview...')
      const job: JobPosting = {
        company: jobCompany,
        position: jobPosition,
        description: jobDescription,
        requirements: jobRequirements.split(',').map(s => s.trim()).filter(Boolean),
        preferences: jobPreferences.split(',').map(s => s.trim()).filter(Boolean),
      }
      const payload = { profile: parsedProfile, job, format: 'html' }
      const resp = await fetch('http://localhost:4000/api/docs/tailored-cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'failed')
      }
      let html = await resp.text()
      const dataMap: Record<string, any> = {
        name: parsedProfile.name,
        email: parsedProfile.email,
        phone: parsedProfile.phone,
        summary: parsedProfile.summary,
        photo: parsedProfile.photoDataUrl,
        skills: parsedProfile?.skills,
        job: job,
        company: job.company,
        position: job.position,
      }
      let interpolated = interpolateTemplate(html, dataMap)
      const looksLikePlain = !/(<html|<head|<body|<div|<section|<h1|<h2|<h3|<p|<ul|<ol|<table)/i.test(interpolated)
      if (looksLikePlain) {
        const safeBody = `<div class="page"><div class="content"><h2>${job.company} — ${job.position}</h2><p class="muted">Preview</p><div style="margin-top:10px; white-space:pre-wrap;">${interpolated}</div></div></div>`
        interpolated = `<!doctype html><html><head><meta charset=\"utf-8\"></head><body>${safeBody}</body></html>`
      }
      if (cvTemplateCss) {
        interpolated = injectCss(interpolated, cvTemplateCss)
      }
      setPreviewHtml(interpolated)
      setCvStatus('Preview ready.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to generate preview'))
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  async function rewriteSummary() {
    try {
      if (!parsedProfile?.summary) return
      setCvStatus('Rewriting summary with AI...')
      const resp = await fetch('http://localhost:4000/api/docs/phrase', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: parsedProfile.summary, style: 'concise professional', context: jobDescription || '' }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'rewrite failed')
      const newSummary = data.text as string
      setParsedProfile(prev => prev ? { ...prev, summary: newSummary } : prev)
      setCvStatus('Summary rewritten successfully.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to rewrite'))
    }
  }

  function downloadPreviewHtml() {
    if (!previewHtml) return
    const blob = new Blob([previewHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cv-preview-${(parsedProfile?.name || 'candidate').replace(/\s+/g, '_')}.html`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  async function generateTailoredCVDownload() {
    try {
      if (!parsedProfile) {
        setCvStatus('Parse a CV first.')
        return
      }
      if (!jobCompany || !jobPosition) {
        setCvStatus('Enter target company and position.')
        return
      }
      setCvStatus('Generating tailored CV...')
      const job: JobPosting = {
        company: jobCompany,
        position: jobPosition,
        description: jobDescription,
        requirements: jobRequirements.split(',').map(s => s.trim()).filter(Boolean),
        preferences: jobPreferences.split(',').map(s => s.trim()).filter(Boolean),
      }
      const payload = { profile: parsedProfile, job, format: cvFormat }
      const resp = await fetch('http://localhost:4000/api/docs/tailored-cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'failed to generate')
      }
      if (cvFormat === 'html') {
        let html = await resp.text()
        if (cvTemplateCss) html = injectCss(html, cvTemplateCss)
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cv-${(parsedProfile.name || 'candidate').replace(/\s+/g, '_')}-${job.position.replace(/\s+/g, '_')}.html`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const ext = cvFormat === 'pdf' ? 'pdf' : 'docx'
        a.download = `cv-${(parsedProfile.name || 'candidate').replace(/\s+/g, '_')}-${job.position.replace(/\s+/g, '_')}.${ext}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
      setCvStatus('Tailored CV generated.')
      try {
        incUsage({ docsGenerated: 1 })
        addTask({ id: String(Date.now()), type: 'doc', title: `Generated CV (${job.position})`, at: Date.now(), meta: { company: job.company, format: cvFormat } })
      } catch {}
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to generate CV'))
    }
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
    <div className="min-h-screen bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <PageHeader
          title="AI-Powered Document Generator"
          description="Create tailored CVs and B2B documents with AI assistance"
          icon={<FileText className="w-6 h-6 text-white" />}
        />

        {/* Status Messages */}
        <AnimatePresence>
          {(cvStatus || b2bStatus) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm p-4 text-sm text-blue-300"
            >
              {cvStatus || b2bStatus}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 1: Resume Summary / AI Rewrite */}
        <SectionCard
          title="Resume Summary & AI Rewrite"
          description="Upload and enhance your CV with AI-powered rewriting"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload CV
              </label>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative"
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 rounded-xl bg-black/20 backdrop-blur-sm border border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-white/20 file:text-sm file:font-medium file:bg-white file:text-black hover:file:bg-white/90 hover:file:text-black cursor-pointer transition-all hover:bg-black/30 hover:border-white/20"
                />
              </motion.div>
            </div>

            <div className="flex gap-3">
              <AIButton
                onClick={parseCV}
                disabled={!cvFile || isParsing}
                loading={isParsing}
                className="flex-1"
              >
                Parse CV
              </AIButton>
            </div>

            {/* Parsed Profile Display */}
            {parsedProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/50 mb-1">Name</div>
                    <div className="text-white font-medium">{parsedProfile.name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">Email</div>
                    <div className="text-white">{parsedProfile.email || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">Phone</div>
                    <div className="text-white">{parsedProfile.phone || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">Title</div>
                    <div className="text-white">{parsedProfile.title || 'N/A'}</div>
                  </div>
                </div>

                {parsedProfile.photoDataUrl && (
                  <div className="flex items-center gap-4">
                    <img
                      src={parsedProfile.photoDataUrl}
                      alt="Profile"
                      className="w-24 h-24 rounded-xl object-cover border-2 border-white/20"
                    />
                    <div className="text-sm text-white/60">Photo extracted</div>
                  </div>
                )}

                {parsedProfile.skills?.technical && parsedProfile.skills.technical.length > 0 && (
                  <div>
                    <div className="text-xs text-white/50 mb-2">Technical Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {parsedProfile.skills.technical.slice(0, 15).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <SmartTextarea
                  label="Summary (editable)"
                  value={parsedProfile.summary || ''}
                  onChange={(e) => setParsedProfile(prev => prev ? { ...prev, summary: e.target.value } : prev)}
                  rows={4}
                  expandable
                  aiAssist
                  onAiAssist={rewriteSummary}
                  icon={<Sparkles className="w-4 h-4" />}
                />

                <div className="flex gap-3">
                  <AIButton
                    onClick={rewriteSummary}
                    disabled={!parsedProfile.summary}
                    variant="secondary"
                    size="sm"
                  >
                    Rewrite Summary
                  </AIButton>
                </div>
              </motion.div>
            )}
          </div>
        </SectionCard>

        {/* Section 2: Job Targeting */}
        <SectionCard
          title="Job Targeting"
          description="Tailor your CV for specific job opportunities"
          icon={<Target className="w-5 h-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartInput
              label="Target Company"
              value={jobCompany}
              onChange={(e) => setJobCompany(e.target.value)}
              placeholder="e.g., Acme Inc."
              icon={<Building2 className="w-4 h-4" />}
            />
            <SmartInput
              label="Target Position"
              value={jobPosition}
              onChange={(e) => setJobPosition(e.target.value)}
              placeholder="e.g., Senior PM"
              icon={<Briefcase className="w-4 h-4" />}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-white/60" />
              <SmartInput
                label="Job Posting URL"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <motion.button
                onClick={importJobFromUrl}
                disabled={!jobUrl}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                Import
              </motion.button>
            </div>
          </div>

          <SmartTextarea
            label="Job Description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={4}
            expandable
            placeholder="Paste job description here..."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartInput
              label="Requirements (comma separated)"
              value={jobRequirements}
              onChange={(e) => setJobRequirements(e.target.value)}
              placeholder="req1, req2"
            />
            <SmartInput
              label="Preferences (comma separated)"
              value={jobPreferences}
              onChange={(e) => setJobPreferences(e.target.value)}
              placeholder="pref1, pref2"
            />
          </div>

          <SmartSelect
            label="Format"
            value={cvFormat}
            onChange={(e) => setCvFormat(e.target.value as any)}
            options={[
              { value: 'pdf', label: 'PDF (Recommended)' },
              { value: 'html', label: 'HTML' },
              { value: 'docx', label: 'DOCX' },
            ]}
            icon={<FileCode className="w-4 h-4" />}
          />

          <div className="flex flex-wrap gap-3">
            <AIButton
              onClick={generateTailoredCVDownload}
              disabled={!parsedProfile}
              className="flex-1 min-w-[200px]"
            >
              Generate Tailored CV
            </AIButton>
            <motion.button
              onClick={generateTailoredPreviewHtml}
              disabled={!parsedProfile || isGeneratingPreview}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {isGeneratingPreview ? 'Generating...' : 'Preview'}
            </motion.button>
          </div>

          {previewHtml && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">Live Preview</h4>
                <motion.button
                  onClick={downloadPreviewHtml}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </motion.button>
              </div>
              <div className="rounded-lg overflow-hidden border border-white/10 bg-white" style={{ height: '500px' }}>
                <iframe title="cv-preview" className="w-full h-full border-0" srcDoc={previewHtml}></iframe>
              </div>
            </motion.div>
          )}
        </SectionCard>

        {/* Section 3: Email Generation / B2B Outreach */}
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
