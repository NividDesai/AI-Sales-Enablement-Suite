# AI Sales Enablement Suite

AI-first platform that discovers and enriches B2B leads, generates collateral (CVs, proposals, decks), and powers a real-time 3D avatar chat assistant. The repository is structured as a monorepo with a TypeScript/Express backend plus a Vite/React frontend.

Frontend preview - https://ai-sales-enablement-suite-frontend.vercel.app/

## Contents
- [Repository Layout](#repository-layout)
- [Core Capabilities](#core-capabilities)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Backend Configuration](#backend-configuration)
- [Running the Apps](#running-the-apps)
- [Backend APIs & Services](#backend-apis--services)
- [Frontend Modules](#frontend-modules)
- [Operational Notes](#operational-notes)
- [Preparing for GitHub](#preparing-for-github)

## Repository Layout
```
.
├── backend/                  # Express + WebSocket API (TypeScript)
│   ├── src/                  # Source code
│   ├── dist/                 # Build artifacts
│   ├── data/                 # Runtime caches (ignored by git)
│   ├── env.example           # Copy to .env before running
│   ├── package.json
│   └── BACKEND_OVERVIEW.md   # In-depth architecture notes
├── frontend/                 # Vite + React SPA
│   ├── src/                  # Components, pages, 3D avatar UI
│   ├── public/               # Static assets (FBX animations, hero video)
│   └── package.json
├── .gitignore
└── README.md (this file)
```

## Core Capabilities
- **Lead intelligence** – AI-assisted domain discovery, Hunter/Apollo enrichment, news/jobs scraping, CSV export, outreach automation.
- **Document automation** – CV parsing, proposal/B2B deck generation, template management, Figma-powered layouts.
- **Avatar copilot** – Persona management, RAG-backed chat, OpenAI responses, WebSocket streaming, TTS audio + phoneme data for lip sync.
- **Real-time dashboard** – React app with 3D avatar scene, hybrid lead workflows, analytics widgets, protected routes.

## Feature Highlights
### 01 · Smart Lead Discovery
- Query by **industry, role/title, geo, company size, tech stack, startup status, sectors, founding year**, and more.
- The discovery API combines search scraping, GPT-powered domain suggestions, and heuristic filters to surface high-fit accounts. The UI exposes a dashboard to monitor industries (Tech, SaaS, Healthcare, etc.), roles (CTO, VP Engineering, Director), and locations (SF, NYC, Remote).
- Bulk discovery from pasted URLs/domains flows straight into enrichment so you can import spreadsheets and immediately score them.

### 02 · Lead Enrichment
- Hunter.io verifies work emails while the enrichment service gathers company metadata (industry, size, revenue, HQ), social links (LinkedIn), phones, job listings, and recent news.
- AI structuring normalizes titles, locations, and personas so downstream workflows stay clean.
- Enrichment telemetry is surfaced through the dashboard showing which data points (email, company context, LinkedIn) are complete per record.

### 03 · AI Email Outreach
- Generates individualized cold emails using lead + company signals plus recent activity cues.
- Choose tone presets (professional, casual, friendly) and edit value props before sending.
- Supports bulk generation so every enriched lead immediately gets a personalized draft; previews show copy such as “Hi John, I noticed [Company] recently…”.

### 04 · AI CV Generator
- Upload CVs in **PDF/DOCX/HTML**, parse them into structured sections, then tailor to a specific job description (company, position, requirements).
- Offers multiple polished templates and exports to PDF, DOCX, or HTML for multi-channel use.
- Perfect for job seekers needing rapid customization across openings; frontend wizard includes “Upload CV”, “Job Details”, “Output” steps.

### 05 · B2B Document Generator
- Creates proposals, pitch decks, outreach packets, and other collateral in **PDF/HTML/PPTX**.
- Auto-fetches logos/branding, injects value propositions, proof points, and benefits per target account.
- Multilingual output (English, French, Spanish, German, Hindi) so teams can localize easily.

### 06 · AI Avatar Practice
- Real-time 3D avatars deliver voice-driven practice sessions for interviews, meetings, and presentations.
- Animated ReadyPlayerMe models synchronize lip movements with generated speech and emit emotion cues.
- Multiple personas simulate different stakeholders; scenarios include interactive Q&A, pitch rehearsals, or customer calls with live feedback.

## Prerequisites
- Node.js 20.x (recommended) and npm 10.x
- Accounts + API keys for: OpenAI, Hunter.io, Apollo.io (optional), Clearbit (optional), OpenCorporates (optional), NewsAPI (optional), Figma tokens for template rendering.
- Git (to push to [github.com/NividDesai/AI-Sales-Enablement-Suite](https://github.com/NividDesai/AI-Sales-Enablement-Suite))

## Getting Started
1. **Clone**
   ```bash
   git clone <repo-url>
   cd "final_generator with ui"
   ```
2. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. **Create local env file**
   ```bash
   cd backend
   copy env.example .env   # Windows (or `cp env.example .env` on macOS/Linux)
   ```
   Fill each variable with your own keys (see next section).
4. **Optional** – create runtime cache folders (`backend/data/audio`, `avatars`, `documents`, `knowledge_bases`, `personas`, `templates`). The backend will auto-create them on demand if missing.

## Backend Configuration
All server settings live in `backend/.env` (ignored by git). Start from `backend/env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | ✅ | HTTP + WebSocket port (default 4000). |
| `OPENAI_API_KEY` | ✅ | GPT-4/4o + TTS + embeddings. |
| `HUNTER_API_KEY` | ✅ | Email discovery. |
| `APOLLO_API_KEY`, `APOLLO_ENABLED` | Optional | Apollo people search. |
| `CLEARBIT_API_KEY`, `OPENCORPORATES_API_KEY` | Optional | Additional enrichment providers. |
| `NEWS_API_KEY` | Optional | Company news ingestion. |
| `RUN_BUDGET_USD`, `PARALLELISM`, `REQUEST_TIMEOUT_MS`, `HUNTER_MAX_EMAILS_PER_DOMAIN`, `COST_*` | Optional | Cost guards + concurrency tuning. |
| `CANVA_API_KEY` | Optional | Placeholder if Canva automation is added. |
| `FIGMA_TOKEN`, `FIGMA_*` | Optional | Pull CV/B2B layout components from Figma. |

Any value left blank simply disables that integration; the backend contains fallbacks and descriptive error messages.

## Running the Apps
### Backend (API + WebSocket)
```bash
cd backend
npm run dev      # TypeScript watcher
# or
npm run build && npm start
```
Key endpoints appear under `http://localhost:4000/api/*` (see `backend/BACKEND_OVERVIEW.md` for the full list). The WebSocket endpoint lives at `/api/avatar/ws/chat/:sessionId`.

### Frontend (Vite SPA)
```bash
cd frontend
npm run dev      # default localhost:5173
```
The SPA currently calls `http://localhost:4000` directly. To point at another backend, search for `http://localhost:4000` in `frontend/src` (e.g. `AvatarChatPage.tsx`, `HybridPage.tsx`) and replace it with your deployment URL or wrap it in a helper before building for production.

### Production build
- Backend: `npm run build` creates `backend/dist`.
- Frontend: `npm run build` outputs static assets to `frontend/dist`; deploy those to any static host (Netlify, Vercel, S3) and configure a proxy to the backend API.

## Backend APIs & Services
The backend groups HTTP routes under `backend/src/routes`, business logic under `backend/src/services`, and reusable helpers under `backend/src/utils`.

### Lead Intelligence Routes (`routes/leads.ts`)
| Endpoint | Key Function(s) | Description |
| --- | --- | --- |
| `POST /api/discover` | `aiSuggestDomains()` | Generates company domains by feeding industry, roles, filters, and geos to GPT and returns `domains` + `urls`. |
| `POST /api/enrich` | `enrichFromUrls()`, `maybeStructureWithAi()` | Pulls Hunter/Apollo data, applies strict title/location filters via `matchesLeadFilters`, and optionally restructures leads with AI. |
| `POST /api/discover-and-enrich` | `discover()` → `enrich()` | Convenience flow that chains the previous two endpoints. |
| `POST /api/export/csv` | `leadsToCsv()` | Streams a CSV built from lead objects. |
| `POST /api/outreach/preview` | `generateDraftEmail()` | Builds personalized email drafts per lead/persona. |
| `POST /api/outreach/send` | `sendEmails()` | Sends approved drafts through Gmail/SMTP with tracking pixels. |
| `GET /api/track/:leadId` | transparent GIF handler | Serves the tracking pixel and increments open stats. |

### Document Automation Routes (`routes/docs.ts`)
- `POST /api/docs/parse-cv` → `parseCvFile()` parses PDF/DOCX resumes via `pdf-parse`/`mammoth`.
- `POST /api/docs/generate-cv` and `generate-proposal`/`generate-b2b` use the template engine plus optional Figma nodes to output PDF/DOCX/PPTX.
- `POST /api/docs/templates` CRUD plus `POST /api/docs/templates/from-url` for scraping remote HTML/CSS.
- `POST /api/docs/job-from-url` scrapes a job description and extracts structured bullets before routing into CV tailoring endpoints.
- Error handlers log with `logger.info/error` and fall back to non-AI summaries when `OPENAI_API_KEY` is absent.

### Avatar & Knowledge Routes (`routes/avatar.ts`)
- **Persona management** (`GET/POST/PUT/DELETE /api/avatar/personas`) wraps `services/avatar/personaManager`.
- **Knowledge bases** (`/api/avatar/knowledge/...`) rely on `documentStore` for JSON-backed KBs with chunking + embeddings.
- **Sessions** (`/api/avatar/session/*`) coordinate with `sessionManager` to persist history and guard access.
- **Assets** (`/api/avatar/assets/:file`, `/api/avatar/audio/:file`) stream cached `.glb` models and generated `.mp3` files.
- **Documents upload** endpoints push files through `multer`, add them to KBs, and kick off embedding jobs.

### WebSocket Chat (`routes/avatar.ts` + `services/avatar/websocketHandler.ts`)
- `ws://localhost:4000/api/avatar/ws/chat/:sessionId` upgrades connections.
- Handler stack:
  1. Validate session/persona via `sessionManager.getSession`.
  2. Retrieve contextual docs using `ragSystem.retrieveContext`.
  3. Generate a reply through `llmService.generateResponse`.
  4. Convert text to speech (`ttsService.synthesizeToFile`) and derive phonemes (`phonemeService.generatePhonemes`).
  5. Emit events (`response`, `audio_ready`, `phonemes`, `emotion`) back to the browser.

### Core Services Snapshot
| Service | File | Highlights |
| --- | --- | --- |
| Discovery | `services/discovery.ts` | `buildBaseQueries`, `simulateSearch`, `extractDomains` orchestrate search-engine scraping with provider fallbacks and blacklist filtering. |
| Enrichment | `services/enrichment.ts` | Coordinates Hunter, phone scraping, news/jobs fetching, and budget tracking via `utils/budget`. |
| Agent | `services/agent.ts` | `agentEnrichEmails` batches Hunter calls, tracks costs, and enforces per-domain quotas. |
| Templates | `services/templates.ts` | CRUD for stored HTML/CSS and a renderer that injects leads/persona placeholders. |
| Avatar | `services/avatar/*` | `personaManager`, `sessionManager`, `llmService`, `ttsService`, `phonemeService`, `ragSystem`, and `documentStore` together power the avatar pipeline. |
| Figma | `services/figma.ts` | Pulls node images/components for CV/B2B layouts when `FIGMA_*` env vars are set. |

### Utility Layer (`backend/src/utils`)
- `ai.ts` wraps OpenAI (GPT-4o, TTS) with safety guards.
- `budget.ts` keeps per-operation costs bounded.
- `csv.ts`, `jobs.ts`, `news.ts`, `phone.ts`, `scrape.ts`, `outreach.ts`, and `logger.ts` provide one-responsibility helpers invoked across services and routes.

## Frontend Modules
The Vite/React app under `frontend/src` mirrors backend features and exposes them via routed pages plus a 3D avatar shell.

- `main.tsx` bootstraps React Router, theme providers, and the shared `AuthProvider`.
- `components/avatar/*` renders the ReadyPlayerMe scene (`AvatarScene`, `ScrollableAvatarScene`), streams audio + phonemes, and wraps WebSocket errors via `ErrorBoundary`.
- `components/ui/*` contains shadcn-inspired primitives plus custom `MotionButton`, `PageBackground`, `TemplateBuilder`, and `VisualEditor`.
- `pages/*` map 1:1 to backend flows:
  - `HybridPage`, `B2BPage`, `OutreachPage` orchestrate discovery → enrichment → outreach using the routes listed above.
  - `CVPage` and `CvB2BPage` cover resume tailoring, job scraping, and document generation.
  - `AvatarChatPage` manages persona selection, session creation, and WebSocket message lifecycle (including `buildWsUrl`, audio preloading, and fallback HTTP messaging).
  - `SettingsPage` exposes persona/knowledge CRUD, file uploads, and template management.
  - `Dashboard` visualizes usage via `MetaBaseChart` helpers (`utils/metaBaseApi.ts`), and `Landing/Login` handle the marketing/auth shells.
- `lib/utils.ts` and `utils/*` (e.g., `ai.ts`, `usage.ts`, `logger.ts`) keep browser-side concerns—API host resolution, animation helpers, telemetry—in one place.

## Operational Notes
- **Runtime data** – Everything under `backend/data` (avatars, audio, knowledge bases, personas, uploaded docs) is git-ignored so sensitive information never leaves your machine. Back up only what you intend to share.
- **Logging** – `backend/src/utils/logger.ts` writes structured logs (console by default). Pipe stdout to a log aggregator in production.
- **Budgets & rate limits** – Tune `RUN_BUDGET_USD`, `PARALLELISM`, and `HUNTER_MAX_EMAILS_PER_DOMAIN` to stay within API quotas. Providers automatically back off on 429s.
- **Avatar pipeline** – Persona → RAG lookup → LLM response → TTS (`data/audio`) → phonemes for lip sync. If audio playback fails, ensure the backend static file routes are accessible and CORS is enabled (`express` server already sets permissive headers).
- **Document templates** – Upload HTML/CSS via `/api/docs/templates` or point to Figma nodes using `FIGMA_*` env vars.

## Preparing for GitHub
1. **Verify git status**
   ```bash
   git init
   git status
   ```
   Ensure only intended files (not `backend/data` or `.env`) show up.
2. **Scan for secrets** – before committing, run pattern searches such as `rg "sk-" -n` or use a scanner like `npx trufflehog filesystem .`.
3. **Commit**
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/NividDesai/AI-Sales-Enablement-Suite.git
   git push -u origin main
   ```
4. **Post-push checklist**
   - Rotate any keys that were previously checked into history.
   - Configure repository secrets (GitHub Actions, deployment platforms) instead of hardcoding values.



