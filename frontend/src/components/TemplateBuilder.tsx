import { useState } from 'react'

type TemplateBuilderProps = {
  onSave: (template: { name: string; html: string; css: string }) => void
  onCancel: () => void
}

export default function TemplateBuilder({ onSave, onCancel }: TemplateBuilderProps) {
  const [name, setName] = useState('')
  const [html, setHtml] = useState(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>{{CSS}}</style>
</head>
<body>
  <div class="page">
    <header>
      <h1>{{company}} → {{lead_company}}</h1>
      {{#if logo}}<img src="{{logo}}" alt="logo" style="height:48px"/>{{/if}}
    </header>
    
    <h2>{{subject}}</h2>
    
    {{#if hero}}<img src="{{hero}}" alt="hero" style="max-width:100%"/>{{/if}}
    
    <section>
      <h3>Introduction</h3>
      {{opening}}
    </section>
    
    <section>
      <h3>The Challenge</h3>
      {{problem}}
    </section>
    
    <section>
      <h3>Our Solution</h3>
      {{solution}}
    </section>
    
    <section>
      <h3>Key Benefits</h3>
      {{benefits}}
    </section>
    
    <section>
      <h3>Proven Results</h3>
      {{proof}}
    </section>
    
    <section>
      <h3>Next Steps</h3>
      {{cta}}
    </section>
    
    <footer>
      {{closing}}
    </footer>
  </div>
</body>
</html>`)
  
  const [css, setCss] = useState(`body {
  margin: 0;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
  background: #f8f9fa;
}

.page {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 30px;
}

h1 {
  margin: 0;
  font-size: 28px;
  color: #111;
}

h2 {
  color: #0d6efd;
  font-size: 24px;
  margin: 20px 0;
}

h3 {
  font-size: 18px;
  color: #333;
  margin: 24px 0 12px 0;
}

section {
  margin: 24px 0;
}

ul {
  padding-left: 24px;
}

li {
  margin: 8px 0;
  line-height: 1.6;
}

footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  color: #666;
}`)

  const [showPreview, setShowPreview] = useState(false)

  const generatePreview = () => {
    const fullHtml = html.replace('{{CSS}}', css)
      .replace(/\{\{(\w+)\}\}/g, (_, token) => {
        const samples: Record<string, string> = {
          company: 'Acme Corp',
          lead_company: 'Target Inc',
          subject: 'Partnership Opportunity',
          opening: '<p>Hello Team, we believe there\'s a strong fit between our companies.</p>',
          problem: '<p>Many companies struggle with scaling efficiently.</p>',
          solution: '<p>Our platform provides automated solutions that reduce overhead by 40%.</p>',
          benefits: '<ul><li>Fast implementation</li><li>Proven ROI</li><li>24/7 support</li></ul>',
          proof: '<ul><li>500+ customers</li><li>95% satisfaction rate</li></ul>',
          cta: '<p>Can we schedule a 15-minute call next week?</p>',
          closing: '<p>Best regards,<br/>Acme Corp Team</p>',
          logo: 'https://via.placeholder.com/120x40/0d6efd/ffffff?text=Logo',
          hero: 'https://via.placeholder.com/800x300/f0f0f0/666666?text=Hero+Image',
        }
        return samples[token] || `{{${token}}}`
      })
      .replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, _token, content) => content)
    
    return fullHtml
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a template name')
      return
    }
    onSave({ name: name.trim(), html, css })
  }

  const insertToken = (token: string) => {
    const textarea = document.getElementById('html-editor') as HTMLTextAreaElement
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newHtml = html.substring(0, start) + `{{${token}}}` + html.substring(end)
    setHtml(newHtml)
    
    // Set cursor after inserted token
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length + 4, start + token.length + 4)
    }, 0)
  }

  const tokens = [
    { name: 'Company', value: 'company' },
    { name: 'Lead Company', value: 'lead_company' },
    { name: 'Lead Name', value: 'lead_name' },
    { name: 'Subject', value: 'subject' },
    { name: 'Opening', value: 'opening' },
    { name: 'Problem', value: 'problem' },
    { name: 'Solution', value: 'solution' },
    { name: 'Benefits', value: 'benefits' },
    { name: 'Proof', value: 'proof' },
    { name: 'CTA', value: 'cta' },
    { name: 'Closing', value: 'closing' },
    { name: 'Logo', value: 'logo' },
    { name: 'Hero', value: 'hero' },
    { name: 'Brand Color', value: 'brand_color' },
  ]

  return (
    <div style={{ padding: 20, background: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Template Builder</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowPreview(!showPreview)} style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {showPreview ? '📝 Edit' : '👁️ Preview'}
            </button>
            <button onClick={handleSave} style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              💾 Save Template
            </button>
            <button onClick={onCancel} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              ✖️ Cancel
            </button>
          </div>
        </div>

        {showPreview ? (
          <div style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid #dee2e6' }}>
            <h3>Preview with Sample Data</h3>
            <iframe 
              srcDoc={generatePreview()} 
              style={{ width: '100%', height: '800px', border: '1px solid #dee2e6', borderRadius: 6 }}
              title="preview"
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
            {/* Token Palette */}
            <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #dee2e6', height: 'fit-content' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Available Tokens</h3>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Click to insert at cursor</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tokens.map(token => (
                  <button
                    key={token.value}
                    onClick={() => insertToken(token.value)}
                    style={{ 
                      padding: '6px 10px', 
                      background: '#f8f9fa', 
                      border: '1px solid #dee2e6', 
                      borderRadius: 4, 
                      cursor: 'pointer',
                      fontSize: 12,
                      textAlign: 'left'
                    }}
                  >
                    {token.name}
                  </button>
                ))}
              </div>
              
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #dee2e6' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Conditionals</h4>
                <code style={{ fontSize: 11, background: '#f8f9fa', padding: 4, display: 'block', borderRadius: 4 }}>
                  {'{{#if logo}}'}<br/>
                  {'  content'}<br/>
                  {'{{/if}}'}
                </code>
              </div>
            </div>

            {/* Editor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Template Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Professional B2B Proposal"
                  style={{ width: '100%', padding: 10, border: '1px solid #dee2e6', borderRadius: 6, fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>HTML Template</label>
                <textarea
                  id="html-editor"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  style={{ 
                    width: '100%', 
                    height: 400, 
                    padding: 12, 
                    border: '1px solid #dee2e6', 
                    borderRadius: 6, 
                    fontFamily: 'monospace',
                    fontSize: 13,
                    lineHeight: 1.5
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>CSS Styles</label>
                <textarea
                  value={css}
                  onChange={(e) => setCss(e.target.value)}
                  style={{ 
                    width: '100%', 
                    height: 300, 
                    padding: 12, 
                    border: '1px solid #dee2e6', 
                    borderRadius: 6, 
                    fontFamily: 'monospace',
                    fontSize: 13,
                    lineHeight: 1.5
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
