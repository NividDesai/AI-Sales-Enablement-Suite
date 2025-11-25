import { useState, useEffect, type ChangeEvent } from 'react'
import * as mammoth from 'mammoth/mammoth.browser'
import type { UserProfile, JobPosting, CompanyInfo } from './cvdoc/agent'
import TemplateBuilder from './components/TemplateBuilder'
import { incUsage, addTask } from './utils/usage'

type Lead = Record<string, any>

export default function App() {
  const [industry, setIndustry] = useState('')
  const [role, setRole] = useState('')
  const [locations, setLocations] = useState('')
  const [numLeads, setNumLeads] = useState(10)
  const [useAi, setUseAi] = useState(false)
  const [status, setStatus] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  // Export button is disabled until leads are available
  const [verifyEmails, setVerifyEmails] = useState(false)
  const [stats, setStats] = useState<{ total: number; hunter: number; verified: number } | null>(null)
  // OpenCorporates removed per request
  // Advanced lead filters state
  const [isStartup, setIsStartup] = useState(false)
  const [sectors, setSectors] = useState('')
  const [technologies, setTechnologies] = useState('')
  const [companySizeRange, setCompanySizeRange] = useState('')
  const [foundedYearMin, setFoundedYearMin] = useState('')
  const [foundedYearMax, setFoundedYearMax] = useState('')

  // Outreach state
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const [senderCompany, setSenderCompany] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [emailTone, setEmailTone] = useState<'professional'|'casual'|'friendly'>('professional')
  const [valueProp, setValueProp] = useState('')
  const [keyBenefits, setKeyBenefits] = useState('')
  const [differentiators, setDifferentiators] = useState('')
  const [drafts, setDrafts] = useState<any[]>([])
  const [outreachStatus, setOutreachStatus] = useState('')
  const [lastSendFailed, setLastSendFailed] = useState<Array<{ to: string; error: string }>>([])
  const [sendProvider, setSendProvider] = useState<'gmail'|'smtp'>('gmail')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  // CSV upload for manual outreach
  const [uploadedLeads, setUploadedLeads] = useState<Lead[]>([])
  const [useUploaded, setUseUploaded] = useState(false)

  // CV/Doc state (backend only)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [parsedProfile, setParsedProfile] = useState<UserProfile | null>(null)
  const [cvStatus, setCvStatus] = useState('')

  // Tailoring form state
  const [jobCompany, setJobCompany] = useState('')
  const [jobPosition, setJobPosition] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobRequirements, setJobRequirements] = useState('')
  const [jobPreferences, setJobPreferences] = useState('')
  const [cvFormat, setCvFormat] = useState<'pdf' | 'html' | 'docx'>('pdf')
  const [cvLang, setCvLang] = useState<'en'|'fr'|'es'|'de'|'hi'>('en')
  const [jobUrl, setJobUrl] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  // Templates
  const [tplBuiltin, setTplBuiltin] = useState<Array<{ id: string; name: string }>>([])
  const [tplUser, setTplUser] = useState<Array<{ id: string; name: string }>>([])
  const [cvTemplateId, setCvTemplateId] = useState('')
  const [cvTemplateHtml, setCvTemplateHtml] = useState('')
  const [cvTemplateCss, setCvTemplateCss] = useState('')
  const [cvTemplateImportUrl, setCvTemplateImportUrl] = useState('')
  const [cvFont, setCvFont] = useState<'Inter'|'Poppins'|'Georgia'|'Times New Roman'|'Roboto Mono'>('Inter')
  const [cvAccent, setCvAccent] = useState<string>('#0d6efd')
  const [cvLayout, setCvLayout] = useState<'single'|'sidebar'>('single')
  const [cvHeaderStyle, setCvHeaderStyle] = useState<'left'|'centered'>('left')
  const [cvDensity, setCvDensity] = useState<'compact'|'normal'|'spacious'>('normal')
  const [autoPreview, setAutoPreview] = useState(true)
  const [cvPreset, setCvPreset] = useState<'modern'|'minimal'|'creative'|'corporate'|'tech'>('modern')
  const [cvEnsurePhotoFirst, _setCvEnsurePhotoFirst] = useState(true)
  const [cvBgStyle, setCvBgStyle] = useState<'none'|'subtle'|'gradient'|'solid'>('subtle')
  const [cvBgColor, setCvBgColor] = useState<string>('#ffffff')

  function buildCvCss(font: string, accent: string, layout: 'single'|'sidebar', header: 'left'|'centered', density: 'compact'|'normal'|'spacious', preset: 'modern'|'minimal'|'creative'|'corporate'|'tech', ensurePhotoFirst: boolean, bgStyle: 'none'|'subtle'|'gradient'|'solid', bgColor: string) {
    // Quote font names that contain spaces
    const fontFamily = font.includes(' ') ? `"${font}"` : font
    const baseSize = density === 'compact' ? '12px' : density === 'spacious' ? '16px' : '14px'
    const sectionSpace = density === 'compact' ? '10px' : density === 'spacious' ? '24px' : '16px'
    const lineH = density === 'compact' ? 1.3 : density === 'spacious' ? 1.7 : 1.5
    const bgCss = bgStyle === 'solid' ? `
    body { background: ${bgColor || '#ffffff'} !important; }
    ` : bgStyle === 'gradient' ? `
    body { background: radial-gradient(1000px 600px at 10% 10%, ${accent}12, transparent 60%), linear-gradient(180deg, #ffffff, ${bgColor || '#ffffff'}); }
    ` : bgStyle === 'subtle' ? `
    body { background: linear-gradient(135deg, ${accent}10, #ffffff 70%); }
    ` : ''
    const pageBg = bgStyle === 'none' ? '#fff' : 'transparent'
    const sidebarCss = layout === 'sidebar' ? `
    .page { display: grid; grid-template-columns: 28% 1fr; gap: 18px; }
    .sidebar { background: #f8f9fb; padding: 16px; border-radius: 8px; }
    .content { padding: 0; }
    ` : `
    .page { display: block; }
    .content { }
    `
    const headerCss = header === 'centered' ? `
    .header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .header .name { font-size: 28px; font-weight: 700; }
    .header .meta { color: #666; }
    ` : `
    .header { text-align: left; display: flex; align-items: center; gap: 14px; }
    .header .name { font-size: 26px; font-weight: 700; }
    .header .meta { color: #666; }
    `
    const presetCss = preset === 'minimal' ? `
    body { color: #111; }
    .page { background: #fff; border: 1px solid #ddd; }
    h2 { border-bottom: 1px solid #e6e6e6; }
    .tag { background: #f2f2f2; color: #333; }
    ` : preset === 'creative' ? `
    body { background: linear-gradient(135deg, ${accent}22, #ffffff 60%); }
    .page { box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    h1,h2,h3 { letter-spacing: 0.3px; }
    h2 { border: none; background: linear-gradient(90deg, ${accent}, transparent); -webkit-background-clip: text; color: transparent; }
    ` : preset === 'corporate' ? `
    .page { border: 1px solid #dbe1f0; }
    h2 { border-bottom: 3px solid ${accent}; }
    .sidebar { background: #f4f7ff; }
    ` : preset === 'tech' ? `
    body { font-feature-settings: 'ss01' 1; }
    .page { background: #0b0f14; color: #e6edf3; border: 1px solid #111723; }
    a, .accent, h3 { color: ${accent}; }
    h2 { color: #e6edf3; border-bottom: 2px solid ${accent}; }
    .tag { background: ${accent}22; color: ${accent}; }
    .muted { color: #9aa4af; }
    ` : `
    /* modern */
    .page { background: #fff; }
    `
    const photoOrderCss = ensurePhotoFirst ? `
    .header { flex-wrap: wrap; }
    .header .photo, .header img, img.photo { order: -1; }
    header .photo, header img { order: -1; }
    ` : ''
    return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@400;600;700&family=Georgia&family=Roboto+Mono:wght@400;600&display=swap');
html, body { margin: 0; padding: 0; }
body { font-family: ${fontFamily}, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: ${baseSize}; line-height: ${lineH}; color: #222; }
*, *::before, *::after { box-sizing: border-box; }
${bgCss}
.page { max-width: 800px; margin: 0 auto; background: ${pageBg}; padding: 24px; border: 1px solid #eee; border-radius: 10px; }
${sidebarCss}
.accent { color: ${accent} !important; }
a { color: ${accent} !important; text-decoration: none; }
h1,h2,h3 { margin: 0 0 8px 0; color: #111; }
h1 + .meta, .header .meta { margin-top: 4px; }
h4,h5,h6 { margin: 0 0 6px 0; }
p { margin: 0 0 8px 0; }
ul, ol { margin: 8px 0 8px 18px; padding: 0; }
li { margin: 4px 0; }
h1, h2, h3, p, li, .content, .page { overflow-wrap: anywhere; word-break: break-word; }
img { max-width: 100%; height: auto; display: inline-block; }
h1 { font-size: 22px; }
h2 { font-size: 18px; border-bottom: 2px solid ${accent}; padding-bottom: 4px; }
h3 { font-size: 15px; color: ${accent} !important; }
.section, section { margin-top: ${sectionSpace}; }
.bullet { list-style: disc; padding-left: 18px; }
.tag { display: inline-block; background: ${accent}15; color: ${accent}; padding: 2px 8px; border-radius: 999px; font-size: 12px; margin: 2px 6px 0 0; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid #e9e9ef; border-radius: 999px; font-size: 12px; }
.muted { color: #666; }
.header .name { letter-spacing: 0.2px; }
.header .role { color: ${accent} !important; font-weight: 600; }
.photo { width: 88px; height: 88px; object-fit: cover; border-radius: ${layout === 'sidebar' ? '8px' : '50%'}; border: 3px solid ${accent}33; }
/* Common structured blocks to avoid overlap and ensure tidy layout */
.experience-item, .education-item, .project-item, .section-block { margin-top: ${sectionSpace}; padding-top: 6px; }
.meta, .subtle { color: #666; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 720px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
${headerCss}
${presetCss}
${photoOrderCss}
`
  }

  function prefixCssWithScope(css: string, scopeSelector: string): string {
    if (!css) return css
    // Do not prefix @imports or @media/@page blocks start lines; handle inner rules approximately
    // Transform body/html selectors to class-qualified versions so they still apply under scoping
    let transformed = css
      .replace(/(^|\n)\s*html\s*,\s*body\s*\{/g, (_m, p1) => `${p1}html.cv-root, body.cv-scope{`)
      .replace(/(^|\n)\s*body\s*\{/g, (_m, p1) => `${p1}body.cv-scope{`)
      .replace(/(^|\n)\s*html\s*\{/g, (_m, p1) => `${p1}html.cv-root{`)
    // Prefix simple rule blocks by injecting scope before the selector list
    transformed = transformed.replace(/(^|\n)\s*([^@\n][^{}]*?)\s*\{/g, (_m, p1, sel) => `${p1}${scopeSelector} ${sel}{`)
    return transformed
  }

  function injectCss(html: string, css: string, layout: 'single'|'sidebar'): string {
    if (!css) return html
    const scope = '.cv-scope'
    const prefixed = prefixCssWithScope(css, scope)
    const styleTag = `<style>${prefixed}</style>`
    let out = html
    // Add class to html
    if (/<html[^>]*class=\"[^\"]*\"[^>]*>/.test(out)) {
      out = out.replace(/<html([^>]*)class=\"([^\"]*)\"([^>]*)>/, (_m, a, cls, b) => `<html${a}class=\"${cls} cv-root\"${b}>`)
    } else if (/<html[^>]*>/.test(out)) {
      out = out.replace(/<html([^>]*)>/, (_m, rest) => `<html${rest} class=\"cv-root\">`)
    }
    // Add scope + layout class to body
    if (/<body[^>]*class=\"[^\"]*\"[^>]*>/.test(out)) {
      out = out.replace(/<body([^>]*)class=\"([^\"]*)\"([^>]*)>/, (_m, a, cls, b) => `<body${a}class=\"${cls} cv-scope cv-layout-${layout}\"${b}>`)
    } else if (/<body[^>]*>/.test(out)) {
      out = out.replace(/<body([^>]*)>/, (_m, rest) => `<body${rest} class=\"cv-scope cv-layout-${layout}\">`)
    }
    // Inject style in head if present, else prepend
    if (out.includes('</head>')) return out.replace('</head>', styleTag + '</head>')
    return styleTag + out
  }

  function applyDesignPreset(p: 'modern'|'minimal'|'creative'|'corporate'|'tech') {
    setCvPreset(p)
    if (p === 'modern') {
      setCvFont('Inter'); setCvAccent('#0d6efd'); setCvLayout('single'); setCvHeaderStyle('left'); setCvDensity('normal')
    } else if (p === 'minimal') {
      setCvFont('Georgia'); setCvAccent('#111111'); setCvLayout('single'); setCvHeaderStyle('left'); setCvDensity('spacious')
    } else if (p === 'creative') {
      setCvFont('Poppins'); setCvAccent('#e83e8c'); setCvLayout('single'); setCvHeaderStyle('centered'); setCvDensity('normal')
    } else if (p === 'corporate') {
      setCvFont('Inter'); setCvAccent('#1f3a93'); setCvLayout('sidebar'); setCvHeaderStyle('left'); setCvDensity('compact')
    } else if (p === 'tech') {
      setCvFont('Roboto Mono'); setCvAccent('#00e5ff'); setCvLayout('sidebar'); setCvHeaderStyle('left'); setCvDensity('normal')
    }
  }

  function interpolateTemplate(html: string, data: Record<string, any>): string {
    if (!html) return html
    let out = html
    // {#if key}...{/if}
    out = out.replace(/\{#if\s+([\w_.]+)\}([\s\S]*?)\{\/if\}/g, (_m, key, inner) => {
      const val = key.split('.').reduce((acc: any, k: string) => acc && acc[k], data)
      return val ? inner : ''
    })
    // {{#if key}}...{{/if}}
    out = out.replace(/\{\{#if\s+([\w_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, key, inner) => {
      const val = key.split('.').reduce((acc: any, k: string) => acc && acc[k], data)
      return val ? inner : ''
    })
    // {{key}}
    out = out.replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_m, key) => {
      const val = key.split('.').reduce((acc: any, k: string) => acc && acc[k], data)
      return (val !== undefined && val !== null) ? String(val) : ''
    })
    return out
  }

  useEffect(() => {
    // Rebuild CSS when design knobs change
    const css = buildCvCss(cvFont, cvAccent, cvLayout, cvHeaderStyle, cvDensity, cvPreset, cvEnsurePhotoFirst, cvBgStyle, cvBgColor)
    setCvTemplateCss(css)
  }, [cvFont, cvAccent, cvLayout, cvHeaderStyle, cvDensity, cvPreset, cvEnsurePhotoFirst, cvBgStyle, cvBgColor])

  useEffect(() => {
    // Regenerate preview when template or CSS changes
    const canPreview = parsedProfile && jobCompany && jobPosition
    if (autoPreview && canPreview) {
      generateTailoredPreviewHtml()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvTemplateId, cvTemplateCss, cvTemplateHtml])

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
  // Backend is always used for CV/docs
  const [b2bLang, setB2bLang] = useState<'en'|'fr'|'es'|'de'|'hi'>('en')
  const [b2bTemplateId, setB2bTemplateId] = useState('')
  // Target (lead) visuals & metadata
  const [leadWebsite, setLeadWebsite] = useState('')
  const [leadIndustry, setLeadIndustry] = useState('')
  const [leadSize, setLeadSize] = useState('')
  const [leadLogoUrl, setLeadLogoUrl] = useState('')
  const [leadBrandColor, setLeadBrandColor] = useState('#0d6efd')
  const [leadHeroImageUrl, setLeadHeroImageUrl] = useState('')
  const [leadVideoUrl, setLeadVideoUrl] = useState('')
  const [b2bPreviewHtml, setB2bPreviewHtml] = useState<string>('')
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false)

  async function importJobFromUrl() {
    try {
      if (!jobUrl) return
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
      setCvStatus('Imported job details from URL.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to import job'))
    }
  }

  async function loadTemplates() {
    try {
      const resp = await fetch('http://localhost:4000/api/docs/templates')
      const data = await resp.json()
      // Filter to only show working CV templates (modern-b2b is for B2B proposals only)
      const cvTemplateIds = new Set(['clean-a4-cv'])
      if (Array.isArray(data?.builtin)) setTplBuiltin(data.builtin.filter((t: any) => cvTemplateIds.has(t.id)))
      if (Array.isArray(data?.user)) setTplUser(data.user.filter((t: any) => cvTemplateIds.has(t.id)))
    } catch {}
  }

  useEffect(() => { loadTemplates() }, [])

  async function parseCV() {
    try {
      if (!cvFile) {
        setCvStatus('Please select a CV file (.pdf, .docx, .txt).')
        return
      }
      setCvStatus('Parsing CV...')
      const fd = new FormData()
      const file = cvFile as File
      fd.append('file', file, file.name)
      const resp = await fetch('http://localhost:4000/api/docs/parse-cv', { method: 'POST', body: fd })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'parse failed')
      let prof: any = data.profile || {}
      // Fallback: if no photo from backend and the file is DOCX, extract first embedded image client-side
      if (!prof.photoDataUrl && file.name.toLowerCase().endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const htmlResult: any = await (mammoth as any).convertToHtml({ arrayBuffer }, {
            convertImage: (mammoth as any).images.imgElement(async (image: any) => {
              const b64 = await image.read('base64')
              const contentType = image.contentType || 'image/png'
              const dataUrl = `data:${contentType};base64,${b64}`
              if (!prof.photoDataUrl) prof.photoDataUrl = dataUrl
              return { src: dataUrl }
            })
          })
          // no need to use htmlResult here; we only needed images
        } catch {}
      }
      setParsedProfile(prof as any)
      setCvStatus('Parsed CV successfully.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to parse CV'))
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
      setCvStatus('Generating HTML preview...')
      const job: JobPosting = {
        company: jobCompany,
        position: jobPosition,
        description: jobDescription,
        requirements: jobRequirements.split(',').map(s => s.trim()).filter(Boolean),
        preferences: jobPreferences.split(',').map(s => s.trim()).filter(Boolean),
      }
      // Simplified payload - English only, professional template
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
      // If backend returned plain text or placeholder-only content (e.g., job description), wrap it in a minimal CV shell
      const looksLikePlain = !/(<html|<head|<body|<div|<section|<h1|<h2|<h3|<p|<ul|<ol|<table)/i.test(interpolated)
      if (looksLikePlain) {
        const safeBody = `<div class="page"><div class="content"><h2>${job.company} — ${job.position}</h2><p class="muted">Preview</p><div style="margin-top:10px; white-space:pre-wrap;">${interpolated}</div></div></div>`
        interpolated = `<!doctype html><html><head><meta charset=\"utf-8\"></head><body>${safeBody}</body></html>`
      }
      // Inject design CSS client-side so the preview reflects your choices, regardless of template source
      if (cvTemplateCss) {
        interpolated = injectCss(interpolated, cvTemplateCss, cvLayout)
      }
      setPreviewHtml(interpolated)
      setCvStatus('Preview ready.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to generate preview'))
    }
  }

  async function rewriteSummary() {
    try {
      if (!parsedProfile?.summary) return
      const resp = await fetch('http://localhost:4000/api/docs/phrase', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: parsedProfile.summary, style: 'concise professional', context: jobDescription || '' }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'rewrite failed')
      const newSummary = data.text as string
      setParsedProfile(prev => prev ? { ...prev, summary: newSummary } : prev)
      setCvStatus('Summary rewritten.')
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
      // Simplified payload - English only, professional template
      const payload = { profile: parsedProfile, job, format: cvFormat }

      const resp = await fetch('http://localhost:4000/api/docs/tailored-cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'failed to generate')
      }

      if (cvFormat === 'html') {
        // Post-process HTML export to ensure CSS (esp. background) is present
        let html = await resp.text()
        if (cvTemplateCss) html = injectCss(html, cvTemplateCss, cvLayout)
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
        // pdf/docx
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

  async function run() {
    setStatus('Discovering...')
    setLeads([])
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
          // backend uses AI-only discovery; no engine needed
        }),
      })
      const discover = await discoverResp.json()
      setStatus(`Found ${discover.urls?.length || 0} candidate URLs. Enriching...`)
      // Enrich with provider flags (single request)
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

  async function generateOutreach() {
    setOutreachStatus('Generating personalized emails...')
    try {
      const leadsToUse = (useUploaded && uploadedLeads.length > 0) ? uploadedLeads : leads
      if (!leadsToUse || leadsToUse.length === 0) {
        setOutreachStatus('No leads to generate emails for. Upload a CSV or run enrichment first.')
        return
      }
      if (!senderName || !senderTitle || !senderCompany || !senderEmail) {
        setOutreachStatus('Please fill Name, Title, Company, and Email in the sender profile.')
        return
      }
      const profile = {
        name: senderName,
        title: senderTitle,
        company: senderCompany,
        email: senderEmail,
        phone: senderPhone || undefined,
        meetingLink: meetingLink || undefined,
        websiteUrl: websiteUrl || undefined,
        linkedinUrl: linkedinUrl || undefined,
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
    }
  }

  async function sendOutreach() {
    setOutreachStatus('Sending emails...')
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
      const emailConfig = sendProvider === 'gmail' ?
        { user: smtpUser || senderEmail, pass: smtpPass } :
        { host: smtpHost, port: Number(smtpPort)||587, secure: Boolean(smtpSecure), user: smtpUser, pass: smtpPass }
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
    }
  }

  function parseNotes(notes?: string): { source?: string; verify_status?: string; verify_score?: string } {
    const n = String(notes || '')
    const get = (k: string) => {
      const m = n.match(new RegExp(k + '=([^;]+)'))
      return m ? m[1] : undefined
    }
    return {
      source: get('source'),
      verify_status: get('verify_status'),
      verify_score: get('verify_score'),
    }
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

  const hasLeads = Array.isArray(leads) && leads.length > 0

  return (
    <div id="hybrid-section" className="container">
      <h1>Hybrid Lead Generation</h1>
      <div className="form">
        <label>Industry</label>
        <input value={industry} onChange={(e: ChangeEvent<HTMLInputElement>) => setIndustry(e.target.value)} placeholder="e.g., SaaS" />

        <label>Role/Title</label>
        <input value={role} onChange={(e: ChangeEvent<HTMLInputElement>) => setRole(e.target.value)} placeholder="e.g., Head of Marketing" />

        <label>Location(s) (comma-separated)</label>
        <input value={locations} onChange={(e: ChangeEvent<HTMLInputElement>) => setLocations(e.target.value)} placeholder="e.g., SF Bay Area, New York" />

        <label>Number of leads</label>
        <input type="number" min={1} max={200} value={numLeads} onChange={(e: ChangeEvent<HTMLInputElement>) => setNumLeads(Number(e.target.value) || 10)} />

        <label>Startup only</label>
        <select value={isStartup ? 'yes' : 'no'} onChange={(e: ChangeEvent<HTMLSelectElement>) => setIsStartup(e.target.value === 'yes')}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>

        <label>Sectors/Tags (comma-separated)</label>
        <input value={sectors} onChange={(e: ChangeEvent<HTMLInputElement>) => setSectors(e.target.value)} placeholder="e.g., fintech, ai, saas" />

        <label>Technologies (comma-separated)</label>
        <input value={technologies} onChange={(e: ChangeEvent<HTMLInputElement>) => setTechnologies(e.target.value)} placeholder="e.g., react, python, aws" />

        <label>Company Size</label>
        <select value={companySizeRange} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCompanySizeRange(e.target.value)}>
          <option value="">Any</option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="201-1000">201-1000</option>
          <option value="1001+">1001+</option>
        </select>

        <label>Founded Year Min</label>
        <input type="number" value={foundedYearMin} onChange={(e: ChangeEvent<HTMLInputElement>) => setFoundedYearMin(e.target.value)} placeholder="e.g., 2018" />

        <label>Founded Year Max</label>
        <input type="number" value={foundedYearMax} onChange={(e: ChangeEvent<HTMLInputElement>) => setFoundedYearMax(e.target.value)} placeholder="e.g., 2024" />

        <label>Use AI (structuring)?</label>
        <select value={useAi ? 'yes' : 'no'} onChange={(e: ChangeEvent<HTMLSelectElement>) => setUseAi(e.target.value === 'yes')}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>

        <label>Verify Emails</label>
        <select value={verifyEmails ? 'yes' : 'no'} onChange={(e: ChangeEvent<HTMLSelectElement>) => setVerifyEmails(e.target.value === 'yes')}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>

        {/* Apollo removed */}

        {/* OpenCorporates toggle removed */}

        <div className="actions">
          <button onClick={run}>Discover + Enrich</button>
          <button onClick={exportCsv} disabled={!hasLeads}>Export CSV</button>
        </div>
        {/* Preview moved into CV section */}
      </div>

      <div id="status">{status}</div>
      {stats && (
        <div className="provider-stats">
          <strong>Provider usage:</strong>
          <div>Total: {stats.total}</div>
          <div>Hunter: {stats.hunter}</div>
        </div>
      )}
      {hasLeads && (
        <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="leads-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>Name</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>Title</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>Company</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>Email</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>Phone</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>LinkedIn</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px' }}>Jobs</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px', minWidth: 220 }}>Personality Summary</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px', minWidth: 160 }}>Strengths</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px', minWidth: 160 }}>Weaknesses</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px', minWidth: 220 }}>Talking Points</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px', minWidth: 220 }}>Recent News</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, idx) => {
                const meta = parseNotes(l.notes as string)
                const strengths = Array.isArray(l.strengths) ? l.strengths.join(', ') : l.strengths || ''
                const weaknesses = Array.isArray(l.weaknesses) ? l.weaknesses.join(', ') : l.weaknesses || ''
                const talkingPoints = Array.isArray(l.talkingPoints) ? (l.talkingPoints as string[]).join(' • ') : l.talkingPoints || ''
                const news = Array.isArray(l?.companyContext?.recentNews) ? l.companyContext.recentNews : []
                const careers = Array.isArray(l?.careersLinks) ? l.careersLinks : []
                const newsTip = news.slice(0, 3).map((n: any) => `• ${n?.title || ''}`).join('\n')
                const jobsTip = careers.slice(0, 3).map((u: string, i: number) => `• [${i+1}] ${u}`).join('\n')
                return (
                  <tr key={l.leadId || idx}>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.name || ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.title || ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.companyDomain || l.company || ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.phoneNumber || ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.linkedinUrl ? <a href={l.linkedinUrl} target="_blank" rel="noreferrer">Profile</a> : ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }} title={jobsTip}>{careers.length > 0 ? <a href={careers[0]} target="_blank" rel="noreferrer">Jobs{typeof l.activeJobCount === 'number' ? ` (${l.activeJobCount})` : ''}</a> : ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{l.personalitySummary || ''}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{strengths}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{weaknesses}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }}>{talkingPoints}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '6px' }} title={newsTip}>{news.length > 0 ? <a href={news[0].url} target="_blank" rel="noreferrer">{news[0].title}</a> : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Outreach Section */}
      <div id="outreach-section" style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <h2>Email Outreach</h2>
        <div style={{ marginBottom: 8 }}>
          <label>Upload CSV (columns: name, title, company, email, phone, linkedinUrl, companyDomain, location)</label>
          <input
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
          />
          {uploadedLeads.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={useUploaded} onChange={(e) => setUseUploaded(e.target.checked)} />
                Use uploaded leads ({uploadedLeads.length})
              </label>
              <button onClick={() => { setUploadedLeads([]); setUseUploaded(false); }}>Clear</button>
            </div>
          )}
        </div>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div>
            <label>Your Name</label>
            <input value={senderName} onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderName(e.target.value)} placeholder="e.g., Jane Doe" />
          </div>
          <div>
            <label>Your Title</label>
            <input value={senderTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderTitle(e.target.value)} placeholder="e.g., Founder" />
          </div>
          <div>
            <label>Your Company</label>
            <input value={senderCompany} onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderCompany(e.target.value)} placeholder="e.g., Acme Inc." />
          </div>
          <div>
            <label>Your Email</label>
            <input value={senderEmail} onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          <div>
            <label>Phone (optional)</label>
            <input value={senderPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => setSenderPhone(e.target.value)} placeholder="+1 415 555 1234" />
          </div>
          <div>
            <label>Meeting Link (optional)</label>
            <input value={meetingLink} onChange={(e: ChangeEvent<HTMLInputElement>) => setMeetingLink(e.target.value)} placeholder="https://cal.com/your-link" />
          </div>
          <div>
            <label>Website (optional)</label>
            <input value={websiteUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsiteUrl(e.target.value)} placeholder="https://yourcompany.com" />
          </div>
          <div>
            <label>LinkedIn (optional)</label>
            <input value={linkedinUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/you" />
          </div>
          <div>
            <label>Tone</label>
            <select value={emailTone} onChange={(e: ChangeEvent<HTMLSelectElement>) => setEmailTone(e.target.value as any)}>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
            </select>
          </div>
          <div>
            <label>Value Proposition (optional)</label>
            <input value={valueProp} onChange={(e: ChangeEvent<HTMLInputElement>) => setValueProp(e.target.value)} placeholder="1 line value prop" />
          </div>
          <div>
            <label>Key Benefits (comma separated)</label>
            <input value={keyBenefits} onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyBenefits(e.target.value)} placeholder="benefit1, benefit2" />
          </div>
          <div>
            <label>Differentiators (comma separated)</label>
            <input value={differentiators} onChange={(e: ChangeEvent<HTMLInputElement>) => setDifferentiators(e.target.value)} placeholder="diff1, diff2" />
          </div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button onClick={generateOutreach} disabled={!(hasLeads || uploadedLeads.length > 0)}>Generate Draft Emails</button>
        </div>
        <div style={{ marginTop: 8, color: '#555' }}>{outreachStatus}</div>
        {lastSendFailed.length > 0 && (
          <div style={{ marginTop: 6, color: '#a33' }}>
            <div><strong>Failed recipients ({lastSendFailed.length}):</strong></div>
            <ul style={{ margin: '6px 0 0 18px' }}>
              {lastSendFailed.slice(0, 5).map((f, i) => (
                <li key={i}><strong>{f.to}</strong>: {f.error}</li>
              ))}
            </ul>
            {lastSendFailed.length > 5 && <div>…and {lastSendFailed.length - 5} more</div>}
          </div>
        )}
        <div className="actions" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => setDrafts(prev => prev.map((d) => ({ ...d, approved: true })))} disabled={drafts.length === 0}>Approve All</button>
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(drafts, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'drafts.json';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
          }} disabled={drafts.length === 0}>Download Drafts (JSON)</button>
        </div>

        {drafts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3>Drafts ({drafts.length})</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
              {drafts.map((d, i) => (
                <div key={i} style={{ padding: 8, borderBottom: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={!!d.approved} onChange={(e) => setDrafts(prev => prev.map((x, idx) => idx === i ? { ...x, approved: e.target.checked } : x))} />
                      Approve
                    </label>
                    <div><strong>To:</strong> {d.to}</div>
                  </div>
                  <div>
                    <label>Subject</label>
                    <input value={d.subject} onChange={(e) => setDrafts(prev => prev.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))} />
                  </div>
                  <div>
                    <label>Body</label>
                    <textarea rows={5} value={d.body} onChange={(e) => setDrafts(prev => prev.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))} />
                  </div>
                  <div className="actions" style={{ display: 'flex', gap: 8 }}>
                    <button onClick={async () => {
                      try {
                        setOutreachStatus(`Regenerating draft ${i+1}...`)
                        const profile = {
                          name: senderName,
                          title: senderTitle,
                          company: senderCompany,
                          email: senderEmail,
                          phone: senderPhone || undefined,
                          meetingLink: meetingLink || undefined,
                          websiteUrl: websiteUrl || undefined,
                          linkedinUrl: linkedinUrl || undefined,
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
                          setDrafts(prev => prev.map((x, idx) => idx === i ? { ...nd, approved: x.approved } : x))
                          setOutreachStatus(`Regenerated draft ${i+1}.`)
                        } else {
                          setOutreachStatus('Regeneration returned no draft')
                        }
                      } catch (e: any) {
                        setOutreachStatus('Error: ' + (e?.message || 'failed'))
                      }
                    }}>Regenerate</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <h4>Send Emails</h4>
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <label>Provider</label>
                  <select value={sendProvider} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSendProvider(e.target.value as any)}>
                    <option value="gmail">Gmail</option>
                    <option value="smtp">SMTP</option>
                  </select>
                </div>
                {sendProvider === 'smtp' && (
                  <>
                    <div>
                      <label>SMTP Host</label>
                      <input value={smtpHost} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
                    </div>
                    <div>
                      <label>SMTP Port</label>
                      <input type="number" value={smtpPort} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpPort(Number(e.target.value)||587)} />
                    </div>
                    <div>
                      <label>Secure (TLS)</label>
                      <select value={smtpSecure ? 'yes' : 'no'} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSmtpSecure(e.target.value === 'yes')}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label>User</label>
                  <input value={smtpUser} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpUser(e.target.value)} placeholder="email user / address" />
                </div>
                <div>
                  <label>Password / App Password</label>
                  <input type="password" value={smtpPass} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpPass(e.target.value)} placeholder="password" />
                </div>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <button onClick={sendOutreach} disabled={drafts.length === 0}>Send Emails</button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* CV & Document Section */}
      <div id="cv-section" style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <h2>CV Builder & B2B Documents</h2>
        {/* Backend is always used now */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div>
            <h3>1) Upload and Parse CV</h3>
            <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setCvFile(e.target.files?.[0] || null)} />
            <div className="actions" style={{ marginTop: 8 }}>
              <button onClick={parseCV} disabled={!cvFile}>Parse CV</button>
            </div>
            <div style={{ marginTop: 6, color: '#555' }}>{cvStatus}</div>
            {parsedProfile && (
              <div style={{ marginTop: 8, background: '#fafafa', border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
                <div><strong>Name:</strong> {parsedProfile.name}</div>
                <div><strong>Email:</strong> {parsedProfile.email}</div>
                <div><strong>Phone:</strong> {parsedProfile.phone || ''}</div>
                {parsedProfile.photoDataUrl && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 600 }}>Extracted Photo:</div>
                    <img
                      src={parsedProfile.photoDataUrl}
                      alt="Extracted headshot"
                      style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '2px solid #eee' }}
                    />
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: '#777' }}>
                  Photo detected: {parsedProfile.photoDataUrl ? 'Yes' : 'No'}
                </div>
                <div><strong>Skills:</strong> {parsedProfile.skills?.technical?.slice(0, 10).join(', ') || ''}</div>
                <div style={{ marginTop: 8 }}>
                  <label>Summary (editable)</label>
                  <textarea rows={3} value={parsedProfile.summary || ''} onChange={(e) => setParsedProfile(prev => prev ? { ...prev, summary: e.target.value } : prev)} />
                  <div className="actions" style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <button onClick={rewriteSummary} disabled={!parsedProfile.summary}>Rewrite Summary (AI)</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3>2) Tailor for Job</h3>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label>Target Company</label>
                <input value={jobCompany} onChange={(e: ChangeEvent<HTMLInputElement>) => setJobCompany(e.target.value)} placeholder="e.g., Acme Inc." />
              </div>
              <div>
                <label>Target Position</label>
                <input value={jobPosition} onChange={(e: ChangeEvent<HTMLInputElement>) => setJobPosition(e.target.value)} placeholder="e.g., Senior PM" />
              </div>
            </div>
            <div>
              <label>Job Description</label>
              <textarea rows={4} value={jobDescription} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJobDescription(e.target.value)} />
            </div>
            <div>
              <label>Job Posting URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={jobUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setJobUrl(e.target.value)} placeholder="https://..." />
                <button onClick={importJobFromUrl} disabled={!jobUrl}>Import From URL</button>
              </div>
            </div>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label>Requirements (comma separated)</label>
                <input value={jobRequirements} onChange={(e: ChangeEvent<HTMLInputElement>) => setJobRequirements(e.target.value)} placeholder="req1, req2" />
              </div>
              <div>
                <label>Preferences (comma separated)</label>
                <input value={jobPreferences} onChange={(e: ChangeEvent<HTMLInputElement>) => setJobPreferences(e.target.value)} placeholder="pref1, pref2" />
              </div>
            </div>
            <div>
              <label>Format</label>
              <select value={cvFormat} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCvFormat(e.target.value as any)}>
                <option value="pdf">PDF (Recommended)</option>
                <option value="html">HTML</option>
                <option value="docx">DOCX</option>
              </select>
              <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                ✨ CV will be generated in English only using AI-powered extraction and tailoring.
                {' '}Job descriptions in any language will be automatically translated to English.
              </p>
            </div>
            <div className="actions" style={{ marginTop: 8 }}>
              <button onClick={generateTailoredCVDownload} disabled={!parsedProfile}>Generate Tailored CV</button>
              <button onClick={generateTailoredPreviewHtml} disabled={!parsedProfile} style={{ marginLeft: 8 }}>Generate Preview (HTML)</button>
            </div>
            {previewHtml && (
              <div style={{ marginTop: 12 }}>
                <h3>Live Preview (HTML)</h3>
                <div style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', height: 420 }}>
                  <iframe title="cv-preview" style={{ width: '100%', height: '100%', border: '0' }} srcDoc={previewHtml}></iframe>
                </div>
                <div className="actions" style={{ marginTop: 8 }}>
                  <button onClick={downloadPreviewHtml}>Download Preview (HTML)</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label>Edit Preview (HTML)</label>
                  <textarea rows={10} value={previewHtml} onChange={(e) => setPreviewHtml(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div>
            <h3>3) Generate B2B Outreach Document</h3>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label>Your Company</label>
                <input value={b2bCompanyName} onChange={(e: ChangeEvent<HTMLInputElement>) => setB2bCompanyName(e.target.value)} placeholder="e.g., Contoso" />
              </div>
              <div>
                <label>Industry</label>
                <input value={b2bIndustry} onChange={(e: ChangeEvent<HTMLInputElement>) => setB2bIndustry(e.target.value)} placeholder="e.g., FinTech" />
              </div>
              <div>
                <label>Website</label>
                <input value={b2bWebsite} onChange={(e: ChangeEvent<HTMLInputElement>) => setB2bWebsite(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label>Value Proposition</label>
                <input value={b2bValueProp} onChange={(e: ChangeEvent<HTMLInputElement>) => setB2bValueProp(e.target.value)} placeholder="1-liner" />
              </div>
              <div>
                <label>Key Differentiators (comma separated)</label>
                <input value={b2bDiffs} onChange={(e: ChangeEvent<HTMLInputElement>) => setB2bDiffs(e.target.value)} placeholder="diff1, diff2" />
              </div>
            </div>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 8 }}>
              <div>
                <label>Lead Company</label>
                <input value={leadCompany} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadCompany(e.target.value)} placeholder="e.g., Globex" />
              </div>
              <div>
                <label>Lead Person (optional)</label>
                <input value={leadPerson} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadPerson(e.target.value)} placeholder="e.g., John Smith" />
              </div>
              <div>
                <label>Lead Title (optional)</label>
                <input value={leadTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadTitle(e.target.value)} placeholder="e.g., VP Ops" />
              </div>
              <div>
                <label>Target Website</label>
                <input value={leadWebsite} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadWebsite(e.target.value)} placeholder="https://target.com" />
              </div>
              <div>
                <label>Target Industry</label>
                <input value={leadIndustry} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadIndustry(e.target.value)} placeholder="e.g., Healthcare" />
              </div>
              <div>
                <label>Target Size</label>
                <input value={leadSize} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadSize(e.target.value)} placeholder="e.g., 500-1000" />
              </div>
              <div>
                <label>Target Logo URL</label>
                <input value={leadLogoUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadLogoUrl(e.target.value)} placeholder="https://...logo.png" />
              </div>
              <div>
                <label>Brand Color (hex)</label>
                <input value={leadBrandColor} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadBrandColor(e.target.value)} placeholder="#0d6efd" />
              </div>
              <div>
                <label>Hero Image URL</label>
                <input value={leadHeroImageUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadHeroImageUrl(e.target.value)} placeholder="https://.../hero.jpg" />
              </div>
              <div>
                <label>Video URL</label>
                <input value={leadVideoUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setLeadVideoUrl(e.target.value)} placeholder="https://.../video" />
              </div>
            </div>
            <div>
              <label>Additional Context (optional)</label>
              <textarea rows={3} value={b2bContext} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setB2bContext(e.target.value)} />
            </div>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label>Format</label>
                <select value={b2bFormat} onChange={(e: ChangeEvent<HTMLSelectElement>) => setB2bFormat(e.target.value as any)}>
                  <option value="pdf">PDF</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <div>
                <label>Language</label>
                <select value={b2bLang} onChange={(e: ChangeEvent<HTMLSelectElement>) => setB2bLang(e.target.value as any)}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Design Style (AI will create stunning visuals)</label>
              <select value={b2bTemplateId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setB2bTemplateId(e.target.value)}>
                <option value="">Modern & Professional (Default)</option>
                <option value="modern-b2b">Executive Proposal</option>
                <option value="creative">Creative & Bold</option>
                <option value="minimal">Minimal & Clean</option>
                <option value="tech">Tech & Innovation</option>
              </select>
              <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>AI will automatically generate relevant images, backgrounds, and design elements</p>
            </div>
            <div className="actions" style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={generateB2BPreview} style={{ background: '#0d6efd', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>👁️ Generate Preview</button>
              <button onClick={() => generateB2BDoc('pdf')} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>📄 Download PDF</button>
              <button onClick={() => generateB2BDoc('html')} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>🌐 Download HTML</button>
            </div>
            {b2bPreviewHtml && (
              <div style={{ marginTop: 12 }}>
                <h3>Live Preview</h3>
                <div style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', height: 700, background: 'white' }}>
                  <iframe title="b2b-preview" style={{ width: '100%', height: '100%', border: '0' }} srcDoc={b2bPreviewHtml}></iframe>
                </div>
              </div>
            )}
            <div style={{ marginTop: 6, color: '#555' }}>{b2bStatus}</div>
          </div>
        </div>
      </div>

      <pre className="results">{JSON.stringify(leads, null, 2)}</pre>

      {showTemplateBuilder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, overflow: 'auto' }}>
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
                loadTemplates()
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


