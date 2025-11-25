import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as mammoth from 'mammoth/mammoth.browser'
import type { UserProfile, JobPosting } from '../cvdoc/agent'
import { incUsage, addTask } from '../utils/usage'
import { SmartInput, SmartTextarea, SmartSelect } from '../components/ui/smart-input'
import { SectionCard } from '../components/ui/section-card'
import { AIButton } from '../components/ui/ai-button'
import { PageHeader } from '../components/ui/page-header'
import { 
  FileText, Sparkles, Target, Upload, Download, Eye, 
  Briefcase, Building2, Link as LinkIcon, FileCode
} from 'lucide-react'

export default function CVPage() {
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

  function injectCss(html: string, css: string): string {
    if (!css) return html
    const styleTag = `<style>${css}</style>`
    let out = html
    if (out.includes('</head>')) return out.replace('</head>', styleTag + '</head>')
    return styleTag + out
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
      setJobPreferences(Array.isArray(j.preferences) ? j.preferences.join(', ') : '')
      setCvStatus('Job details imported.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to import'))
    }
  }

  async function parseCV() {
    if (!cvFile) return
    setIsParsing(true)
    setCvStatus('Parsing CV...')
    try {
      const fd = new FormData()
      const file = cvFile as File
      fd.append('file', file, file.name)
      const resp = await fetch('http://localhost:4000/api/docs/parse-cv', { 
        method: 'POST', 
        body: fd 
      })
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
        } catch {}
      }
      setParsedProfile(prof)
      setCvStatus('CV parsed successfully.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to parse'))
    } finally {
      setIsParsing(false)
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
      setCvStatus('Generating preview...')
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
        throw new Error(err?.error || 'failed to generate')
      }
      let html = await resp.text()
      if (cvTemplateCss) html = injectCss(html, cvTemplateCss)
      setPreviewHtml(html)
      setCvStatus('Preview ready.')
    } catch (e: any) {
      setCvStatus('Error: ' + (e?.message || 'failed to generate preview'))
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <PageHeader
          title="AI-Powered CV Generator"
          description="Create tailored resumes with AI assistance"
          icon={<FileText className="w-6 h-6 text-white" />}
        />

        {/* Status Messages */}
        <AnimatePresence>
          {cvStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm p-4 text-sm text-blue-300"
            >
              {cvStatus}
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
      </div>
    </div>
  )
}

