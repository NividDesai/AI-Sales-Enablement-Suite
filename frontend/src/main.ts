import './style.css'

type ChatState = {
  industry: string
  roleOrTitle: string
  locations: string
  numLeads: number
  useAi: boolean
}

const state: ChatState = {
  industry: '',
  roleOrTitle: '',
  locations: '',
  numLeads: 10,
  useAi: false,
}

const app = document.querySelector<HTMLDivElement>('#app')!

function renderForm() {
  app.innerHTML = `
  <div class="container">
    <h1>Hybrid Lead Generation</h1>
    <div class="form">
      <label>Industry</label>
      <input id="industry" placeholder="e.g., SaaS" value="${state.industry}" />
      <label>Role/Title</label>
      <input id="role" placeholder="e.g., Head of Marketing" value="${state.roleOrTitle}" />
      <label>Location(s) (comma-separated)</label>
      <input id="locations" placeholder="e.g., SF Bay Area, New York" value="${state.locations}" />
      <label>Number of leads</label>
      <input id="num" type="number" min="1" max="200" value="${state.numLeads}" />
      <label>Use AI?</label>
      <select id="useAi">
        <option value="no" ${state.useAi ? '' : 'selected'}>No</option>
        <option value="yes" ${state.useAi ? 'selected' : ''}>Yes</option>
      </select>
      <div class="actions">
        <button id="run">Discover + Enrich</button>
        <button id="export" disabled>Export CSV</button>
      </div>
    </div>
    <div id="status"></div>
    <pre id="results" class="results"></pre>
  </div>
  `

  document.querySelector<HTMLInputElement>('#industry')!.oninput = (e) => {
    state.industry = (e.target as HTMLInputElement).value
  }
  document.querySelector<HTMLInputElement>('#role')!.oninput = (e) => {
    state.roleOrTitle = (e.target as HTMLInputElement).value
  }
  document.querySelector<HTMLInputElement>('#locations')!.oninput = (e) => {
    state.locations = (e.target as HTMLInputElement).value
  }
  document.querySelector<HTMLInputElement>('#num')!.oninput = (e) => {
    state.numLeads = Number((e.target as HTMLInputElement).value) || 10
  }
  document.querySelector<HTMLSelectElement>('#useAi')!.onchange = (e) => {
    state.useAi = (e.target as HTMLSelectElement).value === 'yes'
  }

  document.querySelector<HTMLButtonElement>('#run')!.onclick = onRun
  document.querySelector<HTMLButtonElement>('#export')!.onclick = onExport
}

async function onRun() {
  const status = document.querySelector<HTMLDivElement>('#status')!
  const resultsEl = document.querySelector<HTMLPreElement>('#results')!
  status.textContent = 'Discovering...'
  resultsEl.textContent = ''

  const locations = state.locations
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    const discoverResp = await fetch('http://localhost:4000/api/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        industry: state.industry,
        roleOrTitle: state.roleOrTitle,
        locations,
        numLeads: state.numLeads,
        useAi: state.useAi,
        engine: 'bing',
      }),
    })
    const discover = await discoverResp.json()
    status.textContent = `Found ${discover.urls?.length || 0} candidate URLs. Enriching...`

    const enrichResp = await fetch('http://localhost:4000/api/enrich', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        urls: discover.urls || [],
        limit: state.numLeads,
        useAi: state.useAi,
      }),
    })
    const { leads } = await enrichResp.json()
    ;(window as any).__LEADS__ = leads
    resultsEl.textContent = JSON.stringify(leads, null, 2)
    status.textContent = `Done. ${leads?.length || 0} leads.`
    document.querySelector<HTMLButtonElement>('#export')!.disabled = !leads?.length
  } catch (e: any) {
    status.textContent = 'Error: ' + (e?.message || 'unknown')
  }
}

async function onExport() {
  const leads = (window as any).__LEADS__ || []
  if (!leads.length) return
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

renderForm()

