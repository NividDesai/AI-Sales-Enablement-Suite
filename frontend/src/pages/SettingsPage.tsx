import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { SectionCard } from '../components/ui/section-card'
import { useAuth } from '../components/AuthProvider'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/ui/page-header'
import {
  Mail, User, Save, CheckCircle2,
  Video, Plus, Trash2, FileText, Upload, X, Settings
} from 'lucide-react'

export default function SettingsPage() {
  const { user, updateProfile } = useAuth()
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    company: user?.company || '',
    position: user?.position || '',
    bio: user?.bio || '',
    meetingLink: user?.meetingLink || '',
    websiteUrl: user?.websiteUrl || '',
    linkedinUrl: user?.linkedinUrl || '',
  })
  const [emailSettings, setEmailSettings] = useState({
    sendProvider: (user?.emailSettings?.sendProvider || 'gmail') as 'gmail' | 'smtp',
    smtpHost: user?.emailSettings?.smtpHost || '',
    smtpPort: user?.emailSettings?.smtpPort || 587,
    smtpSecure: user?.emailSettings?.smtpSecure || false,
    smtpUser: user?.emailSettings?.smtpUser || '',
    smtpPass: user?.emailSettings?.smtpPass || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Persona management state
  const [personas, setPersonas] = useState<any[]>([])
  const [showPersonaForm, setShowPersonaForm] = useState(false)
  const [newPersona, setNewPersona] = useState({
    name: '',
    role: '',
    description: '',
    avatar_url: '',
    avatar_file: null as File | null,
    speaking_style: 'professional and friendly',
  })
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [documentText, setDocumentText] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [loadingPersonas, setLoadingPersonas] = useState(false)

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        phone: user.phone || '',
        company: user.company || '',
        position: user.position || '',
        bio: user.bio || '',
        meetingLink: user.meetingLink || '',
        websiteUrl: user.websiteUrl || '',
        linkedinUrl: user.linkedinUrl || '',
      })
      setEmailSettings({
        sendProvider: user.emailSettings?.sendProvider || 'gmail',
        smtpHost: user.emailSettings?.smtpHost || '',
        smtpPort: user.emailSettings?.smtpPort || 587,
        smtpSecure: user.emailSettings?.smtpSecure || false,
        smtpUser: user.emailSettings?.smtpUser || '',
        smtpPass: user.emailSettings?.smtpPass || '',
      })
    }
  }, [user])

  useEffect(() => {
    loadPersonas()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const result = await updateProfile({
        ...profile,
        emailSettings,
      })
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  // Auto-save on change with debounce (excluding password for security)
  useEffect(() => {
    if (!user) return
    // Skip initial mount
    const isInitialMount = !user.name && !user.phone && !user.company && !user.position && !user.bio && !user.meetingLink && !user.websiteUrl && !user.linkedinUrl
    if (isInitialMount && !profile.name && !profile.phone && !profile.company && !profile.position && !profile.bio && !profile.meetingLink && !profile.websiteUrl && !profile.linkedinUrl) return
    
    const timer = setTimeout(() => {
      // Auto-save everything except password (password requires manual save)
      updateProfile({
        ...profile,
        emailSettings: {
          ...emailSettings,
          smtpPass: user.emailSettings?.smtpPass || emailSettings.smtpPass, // Keep existing password if not changed
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 2000) // 2 second debounce
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.name, profile.phone, profile.company, profile.position, profile.bio, profile.meetingLink, profile.websiteUrl, profile.linkedinUrl, emailSettings.sendProvider, emailSettings.smtpHost, emailSettings.smtpPort, emailSettings.smtpSecure, emailSettings.smtpUser])
  
  // Note: Password changes require manual save via Save Changes button for security

  async function loadPersonas() {
    setLoadingPersonas(true)
    try {
      const res = await fetch('http://localhost:4000/api/avatar/personas')
      if (!res.ok) throw new Error('Failed to load personas')
      const data = await res.json()
      setPersonas(data)
    } catch (err: any) {
      console.error('Failed to load personas:', err)
    } finally {
      setLoadingPersonas(false)
    }
  }

  async function createPersona() {
    try {
      // First create knowledge base for this persona
      const kbRes = await fetch('http://localhost:4000/api/avatar/knowledge/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${newPersona.name} Knowledge Base`,
          description: `Knowledge base for ${newPersona.name}`,
          persona_ids: [],
        }),
      })
      const kb = await kbRes.json()

      // Create persona with Nivid-like defaults
      const personaData: any = {
        name: newPersona.name,
        role: newPersona.role,
        description: newPersona.description,
        speaking_style: newPersona.speaking_style,
        avatar_id: 'rpm_default', // Default like Nivid - uses same animation system
        voice_id: 'alloy', // Default voice (same as Nivid uses)
        personality_traits: {
          empathy: 0.6,
          formality: 0.3,
          enthusiasm: 0.6,
          humor: 0.8,
          patience: 0.5,
          assertiveness: 0.8,
        },
        knowledge_base_ids: [kb.id],
      }

      // Handle avatar
      if (newPersona.avatar_file) {
        // Upload file first
        const formData = new FormData()
        formData.append('avatar', newPersona.avatar_file)
        const uploadRes = await fetch('http://localhost:4000/api/avatar/personas/temp-avatar', {
          method: 'POST',
          body: formData,
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          personaData.avatar_url = uploadData.url
        }
      } else if (newPersona.avatar_url) {
        personaData.avatar_url = newPersona.avatar_url
      }

      const res = await fetch('http://localhost:4000/api/avatar/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personaData),
      })

      if (!res.ok) throw new Error('Failed to create persona')

      // Update knowledge base with persona ID
      const persona = await res.json()
      await fetch(`http://localhost:4000/api/avatar/knowledge/${kb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_ids: [persona.id] }),
      })

      // Reset form and reload
      setShowPersonaForm(false)
      setNewPersona({
        name: '',
        role: '',
        description: '',
        avatar_url: '',
        avatar_file: null,
        speaking_style: 'professional and friendly',
      })
      loadPersonas()
    } catch (err: any) {
      console.error('Failed to create persona:', err)
      alert('Failed to create persona: ' + (err?.message || 'unknown error'))
    }
  }

  async function deletePersona(personaId: string) {
    if (!confirm('Are you sure you want to delete this persona?')) return

    try {
      const res = await fetch(`http://localhost:4000/api/avatar/personas/${personaId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete persona')
      loadPersonas()
    } catch (err: any) {
      console.error('Failed to delete persona:', err)
      alert('Failed to delete persona: ' + (err?.message || 'unknown error'))
    }
  }

  async function addDocumentToPersona(personaId: string, content: string) {
    if (!content.trim()) return

    try {
      // Find persona's knowledge base
      const persona = personas.find((p) => p.id === personaId)
      if (!persona || !persona.knowledge_base_ids || persona.knowledge_base_ids.length === 0) {
        // Create KB if doesn't exist
        const kbRes = await fetch('http://localhost:4000/api/avatar/knowledge/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${persona.name} Knowledge Base`,
            persona_ids: [personaId],
          }),
        })
        const kb = await kbRes.json()

        // Add document
        await fetch(`http://localhost:4000/api/avatar/knowledge/${kb.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Manual Entry',
            content: content,
            source: 'manual',
          }),
        })

        // Update persona with KB ID
        await fetch(`http://localhost:4000/api/avatar/personas/${personaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledge_base_ids: [kb.id] }),
        })
      } else {
        // Add to existing KB
        await fetch(`http://localhost:4000/api/avatar/knowledge/${persona.knowledge_base_ids[0]}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Manual Entry',
            content: content,
            source: 'manual',
          }),
        })
      }

      setDocumentText('')
      alert('Document added successfully!')
    } catch (err: any) {
      console.error('Failed to add document:', err)
      alert('Failed to add document: ' + (err?.message || 'unknown error'))
    }
  }

  async function uploadDocumentToPersona(personaId: string, file: File) {
    if (!file) return

    try {
      const persona = personas.find((p) => p.id === personaId)
      if (!persona) {
        alert('Persona not found')
        return
      }
      
      if (!persona.knowledge_base_ids || persona.knowledge_base_ids.length === 0) {
        // Create KB if doesn't exist
        const kbRes = await fetch('http://localhost:4000/api/avatar/knowledge/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${persona.name} Knowledge Base`,
            persona_ids: [personaId],
          }),
        })
        const kb = await kbRes.json()

        // Upload document
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`http://localhost:4000/api/avatar/knowledge/${kb.id}/documents/upload`, {
          method: 'POST',
          body: formData,
        })

        // Update persona
        await fetch(`http://localhost:4000/api/avatar/personas/${personaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledge_base_ids: [kb.id] }),
        })
      } else {
        // Upload to existing KB
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`http://localhost:4000/api/avatar/knowledge/${persona.knowledge_base_ids[0]}/documents/upload`, {
          method: 'POST',
          body: formData,
        })
      }

      setDocumentFile(null)
      alert('Document uploaded successfully!')
    } catch (err: any) {
      console.error('Failed to upload document:', err)
      alert('Failed to upload document: ' + (err?.message || 'unknown error'))
    }
  }

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <PageHeader
          title="Settings"
          description="Manage your account profile and email settings"
          icon={<Settings className="w-6 h-6 text-white" />}
        />

        {/* Account Profile */}
        <SectionCard
          title="Account Profile"
          description="Manage your personal information and account details"
          icon={<User className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Full Name</label>
                <Input
                  value={profile.name}
                  onChange={(e) => {
                    setProfile({ ...profile, name: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="Your full name"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Email</label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-white/5 border-white/10 text-white/60"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Phone</label>
                <Input
                  value={profile.phone}
                  onChange={(e) => {
                    setProfile({ ...profile, phone: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="Your phone number"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Company</label>
                <Input
                  value={profile.company}
                  onChange={(e) => {
                    setProfile({ ...profile, company: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="Your company name"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-white/60 mb-2">Position/Title</label>
                <Input
                  value={profile.position}
                  onChange={(e) => {
                    setProfile({ ...profile, position: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="Your job title or position"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-white/60 mb-2">Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => {
                    setProfile({ ...profile, bio: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Meeting Link</label>
                <Input
                  value={profile.meetingLink}
                  onChange={(e) => {
                    setProfile({ ...profile, meetingLink: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="https://cal.com/your-link"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Website</label>
                <Input
                  value={profile.websiteUrl}
                  onChange={(e) => {
                    setProfile({ ...profile, websiteUrl: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="https://yourcompany.com"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-white/60 mb-2">LinkedIn URL</label>
                <Input
                  value={profile.linkedinUrl}
                  onChange={(e) => {
                    setProfile({ ...profile, linkedinUrl: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="https://linkedin.com/in/you"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-white text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Changes saved automatically</span>
                  </motion.div>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Email Settings */}
        <SectionCard
          title="Email Configuration"
          description="Configure your email provider settings for sending outreach emails"
          icon={<Mail className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Email Provider</label>
                <select
                  value={emailSettings.sendProvider}
                  onChange={(e) => {
                    setEmailSettings({ ...emailSettings, sendProvider: e.target.value as 'gmail' | 'smtp' })
                    setSaved(false)
                  }}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="gmail">Gmail</option>
                  <option value="smtp">SMTP</option>
                </select>
              </div>
            </div>

            {emailSettings.sendProvider === 'smtp' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">SMTP Host</label>
                  <Input
                    value={emailSettings.smtpHost}
                    onChange={(e) => {
                      setEmailSettings({ ...emailSettings, smtpHost: e.target.value })
                      setSaved(false)
                    }}
                    placeholder="smtp.example.com"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">SMTP Port</label>
                  <Input
                    type="number"
                    value={emailSettings.smtpPort}
                    onChange={(e) => {
                      setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) || 587 })
                      setSaved(false)
                    }}
                    placeholder="587"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Secure (TLS)</label>
                  <select
                    value={emailSettings.smtpSecure ? 'yes' : 'no'}
                    onChange={(e) => {
                      setEmailSettings({ ...emailSettings, smtpSecure: e.target.value === 'yes' })
                      setSaved(false)
                    }}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Email User / Address</label>
                <Input
                  value={emailSettings.smtpUser}
                  onChange={(e) => {
                    setEmailSettings({ ...emailSettings, smtpUser: e.target.value })
                    setSaved(false)
                  }}
                  placeholder={emailSettings.sendProvider === 'gmail' ? 'your.email@gmail.com' : 'email@example.com'}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Password / App Password</label>
                <Input
                  type="password"
                  value={emailSettings.smtpPass}
                  onChange={(e) => {
                    setEmailSettings({ ...emailSettings, smtpPass: e.target.value })
                    setSaved(false)
                  }}
                  placeholder="password"
                  className="bg-white/5 border-white/10 text-white"
                />
                {emailSettings.sendProvider === 'gmail' && (
                  <p className="text-xs text-white/40 mt-1">Use Gmail App Password for better security</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-white text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Email settings saved</span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* AI Avatar Personas */}
        <SectionCard
          title="AI Avatar Personas"
          description="Manage personas for AI Avatar Practice. Add personas, upload avatars, and link knowledge documents."
          icon={<Video className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {/* Personas List */}
            <div className="space-y-2">
              {loadingPersonas ? (
                <div className="text-center py-8 text-white/60">Loading personas...</div>
              ) : personas.length === 0 ? (
                <div className="text-center py-8 text-white/60">No personas yet. Create one to get started!</div>
              ) : (
                personas.map((persona) => (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-1">{persona.name}</h3>
                        <p className="text-white/60 text-sm mb-2">{persona.role}</p>
                        {persona.description && (
                          <p className="text-white/40 text-xs mb-2">{persona.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            onClick={() => setSelectedPersona(selectedPersona === persona.id ? null : persona.id)}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            {selectedPersona === persona.id ? 'Hide' : 'Manage'} Documents
                          </Button>
                        </div>
                      </div>
                      <Button
                        onClick={() => deletePersona(persona.id)}
                        variant="ghost"
                        size="sm"
                        className="text-white hover:text-white/80 hover:bg-white/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Document Management for this persona */}
                    {selectedPersona === persona.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-white/10"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-white/60 mb-2">Add Document (Paste Text)</label>
                            <textarea
                              value={documentText}
                              onChange={(e) => setDocumentText(e.target.value)}
                              placeholder="Paste document content here..."
                              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white min-h-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <Button
                              onClick={() => addDocumentToPersona(persona.id, documentText)}
                              disabled={!documentText.trim()}
                              size="sm"
                              className="mt-2"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Add Document
                            </Button>
                          </div>
                          <div>
                            <label className="block text-sm text-white/60 mb-2">Or Upload File (.txt, .md)</label>
                            <input
                              type="file"
                              accept=".txt,.md"
                              onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                              className="hidden"
                              id={`file-${persona.id}`}
                            />
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`file-${persona.id}`}
                                className="cursor-pointer px-3 py-2 rounded-md border border-white/10 bg-white text-black text-sm hover:bg-white/90 transition-colors"
                              >
                                <Upload className="w-4 h-4 inline mr-2" />
                                Choose File
                              </label>
                              {documentFile && (
                                <span className="text-white/60 text-sm">{documentFile.name}</span>
                              )}
                              {documentFile && (
                                <Button
                                  onClick={() => uploadDocumentToPersona(persona.id, documentFile)}
                                  size="sm"
                                >
                                  Upload
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Add New Persona Button */}
            {!showPersonaForm && (
              <Button
                onClick={() => setShowPersonaForm(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Persona
              </Button>
            )}

            {/* New Persona Form */}
            {showPersonaForm && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">Create New Persona</h3>
                    <Button
                      onClick={() => {
                        setShowPersonaForm(false)
                        setNewPersona({
                          name: '',
                          role: '',
                          description: '',
                          avatar_url: '',
                          avatar_file: null,
                          speaking_style: 'professional and friendly',
                        })
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Name *</label>
                      <Input
                        value={newPersona.name}
                        onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
                        placeholder="John Doe"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Role *</label>
                      <Input
                        value={newPersona.role}
                        onChange={(e) => setNewPersona({ ...newPersona, role: e.target.value })}
                        placeholder="Software Engineer"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-white/60 mb-2">Description</label>
                      <Input
                        value={newPersona.description}
                        onChange={(e) => setNewPersona({ ...newPersona, description: e.target.value })}
                        placeholder="A brief description of this persona"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-white/60 mb-2">Speaking Style</label>
                      <Input
                        value={newPersona.speaking_style}
                        onChange={(e) => setNewPersona({ ...newPersona, speaking_style: e.target.value })}
                        placeholder="professional and friendly"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-white/60 mb-2">Avatar URL (Ready Player Me GLB)</label>
                      <Input
                        value={newPersona.avatar_url}
                        onChange={(e) => setNewPersona({ ...newPersona, avatar_url: e.target.value })}
                        placeholder="https://models.readyplayer.me/..."
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-white/60 mb-2">Or Upload Avatar File (.glb)</label>
                      <input
                        type="file"
                        accept=".glb"
                        onChange={(e) => setNewPersona({ ...newPersona, avatar_file: e.target.files?.[0] || null })}
                        className="block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-white/20 file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-white/90 hover:file:text-black"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={createPersona}
                    disabled={!newPersona.name || !newPersona.role}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Persona
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

