# Backend Architecture Overview

## Project Purpose
This is a **Lead Generation & AI Avatar Chat Backend** built with Node.js/TypeScript. It provides:
1. **Lead Discovery & Enrichment**: Find and enrich business leads from various sources
2. **AI Avatar Chat System**: Interactive 3D avatars with voice, lip-sync, and RAG-based knowledge

---

## 🏗️ Architecture Overview

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js (REST API)
- **WebSocket**: ws library (for real-time avatar chat)
- **AI/ML**: OpenAI GPT-4 (for domain suggestions, lead structuring, TTS)
- **Data Providers**: Hunter.io, Apollo.io, OpenCorporates
- **File Processing**: PDF parsing, document extraction
- **3D Avatars**: ReadyPlayerMe GLB models

### Project Structure
```
backend/
├── src/                    # TypeScript source files
│   ├── index.ts            # Main entry point (Express server + WebSocket)
│   ├── config.ts           # Environment configuration
│   ├── types.ts            # TypeScript type definitions
│   ├── routes/             # API route handlers
│   │   ├── leads.ts       # Lead discovery/enrichment endpoints
│   │   ├── docs.ts        # Document processing endpoints
│   │   └── avatar.ts      # Avatar/persona management endpoints
│   ├── services/           # Business logic services
│   │   ├── agent.ts       # Email enrichment agent
│   │   ├── discovery.ts   # Domain/company discovery
│   │   ├── enrichment.ts  # Lead data enrichment
│   │   ├── templates.ts   # Template management
│   │   └── avatar/        # Avatar chat system
│   │       ├── websocketHandler.ts  # WebSocket connection management
│   │       ├── personaManager.ts    # Persona CRUD operations
│   │       ├── sessionManager.ts    # Chat session management
│   │       ├── llmService.ts         # OpenAI chat completions
│   │       ├── ttsService.ts         # Text-to-speech (OpenAI TTS)
│   │       ├── phonemeService.ts     # Lip-sync phoneme extraction
│   │       ├── ragSystem.ts          # RAG (Retrieval-Augmented Generation)
│   │       ├── documentStore.ts      # Knowledge base document storage
│   │       └── avatarCache.ts        # 3D avatar file caching
│   ├── providers/          # External API integrations
│   │   ├── hunter.ts      # Hunter.io email finder
│   │   ├── apollo.ts      # Apollo.io people search
│   │   ├── openCorporates.ts  # Company registry data
│   │   └── proxycurl.ts   # LinkedIn data enrichment
│   └── utils/              # Utility functions
│       ├── ai.ts           # OpenAI helper functions
│       ├── phone.ts        # Phone number normalization
│       ├── scrape.ts       # Web scraping utilities
│       ├── csv.ts          # CSV export
│       ├── outreach.ts     # Email generation/sending
│       ├── news.ts         # Company news fetching
│       ├── jobs.ts         # Job listing enrichment
│       ├── budget.ts       # API cost tracking
│       └── logger.ts       # Logging utility
├── dist/                   # Compiled JavaScript (from TypeScript)
└── data/                   # Data storage
    ├── avatars/            # Cached 3D avatar files (.glb)
    ├── audio/              # Generated TTS audio files (.mp3)
    ├── personas/           # Persona JSON files
    ├── knowledge_bases/    # Knowledge base JSON files
    └── templates/          # Email/document templates
```

---

## 🔌 API Endpoints

### 1. Lead Generation Routes (`/api/*`)

#### `POST /api/discover`
**Purpose**: Use AI to suggest company domains based on criteria
- **Input**: `{ industry, roleOrTitle, locations, numLeads, filters }`
- **Process**: 
  1. Uses OpenAI GPT-4 to generate relevant company domains
  2. Encodes filters (startup, sectors, technologies) into prompt
  3. Returns list of suggested domains
- **Output**: `{ domains: string[], urls: string[] }`

#### `POST /api/enrich`
**Purpose**: Enrich leads from company URLs/domains
- **Input**: `{ urls, limit, useAi, title, locations, filters }`
- **Process**:
  1. Extracts domains from URLs
  2. Uses Hunter.io to find emails for each domain
  3. Filters by title (CEO, CFO, etc.) if specified
  4. Optionally verifies emails
  5. Scrapes websites for phone numbers, LinkedIn, careers links
  6. Fetches company news (capped at 5 companies)
  7. Finds job listings (capped at 5 companies)
  8. Optionally uses AI to structure/enhance lead data
- **Output**: `{ leads: LeadRaw[], stats: { total, hunter, verified } }`

#### `POST /api/discover-and-enrich`
**Purpose**: Combined discovery + enrichment in one call
- **Process**: Calls `discover` then `enrich` sequentially
- **Output**: `{ domains, urls, leads, stats }`

#### `POST /api/export/csv`
**Purpose**: Export leads to CSV format
- **Input**: `{ leads: LeadRaw[] }`
- **Output**: CSV file download

#### `GET /api/track/:leadId`
**Purpose**: Email open tracking pixel
- Returns 1x1 transparent GIF for email tracking

#### `POST /api/outreach/preview`
**Purpose**: Generate personalized email drafts
- **Input**: `{ leads, profile: { name, title, company, email } }`
- **Process**: Uses AI to generate personalized emails for each lead
- **Output**: `{ drafts: DraftEmail[] }`

#### `POST /api/outreach/send`
**Purpose**: Send approved email drafts
- **Input**: `{ drafts, provider: "gmail" | "smtp", emailConfig }`
- **Output**: `{ sent: DraftEmail[], failed: DraftEmail[] }`

---

### 2. Document Processing Routes (`/api/docs/*`)

#### `POST /api/docs/parse-cv`
**Purpose**: Parse uploaded CV/resume files (PDF, DOCX, DOC)
- **Input**: Multipart form data with CV file
- **Process**: 
  - Extracts text from PDF/DOCX
  - Parses structured data (name, email, experience, education, skills)
  - Detects language using franc library
- **Output**: `{ profile: UserProfile }`

#### `POST /api/docs/generate-cv`
**Purpose**: Generate CV/Resume from profile data
- **Input**: `{ profile: UserProfile, format: "pdf" | "docx" }`
- **Process**: Creates formatted CV with sections (experience, education, skills)
- **Output**: PDF or DOCX file download

#### `POST /api/docs/generate-proposal`
**Purpose**: Generate business proposal document
- **Input**: `{ lead, companyInfo, jobPosting, templateId?, format: "pdf" | "pptx" }`
- **Process**: 
  - Uses template or generates from scratch
  - Creates PDF or PowerPoint presentation
  - Includes company branding, value proposition
- **Output**: PDF or PPTX file download

#### `POST /api/docs/generate-b2b`
**Purpose**: Generate B2B pitch deck
- **Input**: `{ leadDetails, companyInfo, format: "pdf" | "pptx" }`
- **Process**: Creates presentation with company info, value proposition
- **Output**: PDF or PPTX file download

#### `GET /api/docs/templates`
**Purpose**: List available document templates
- **Output**: `{ templates: StoredTemplate[] }`

#### `POST /api/docs/templates`
**Purpose**: Save custom template
- **Input**: `{ name, html, css }`
- **Output**: `{ id, name, html, css, createdAt }`

#### `POST /api/docs/templates/from-url`
**Purpose**: Import template from URL
- **Input**: `{ url: string }`
- **Process**: Fetches HTML, extracts CSS, prepares for token replacement
- **Output**: `{ html, css }`

---

### 3. Avatar Chat Routes (`/api/avatar/*`)

#### Persona Management
- `GET /api/avatar/personas` - List all personas
- `GET /api/avatar/personas/:id` - Get persona details
- `POST /api/avatar/personas` - Create new persona
- `PUT /api/avatar/personas/:id` - Update persona
- `DELETE /api/avatar/personas/:id` - Delete persona
- `POST /api/avatar/personas/:id/avatar` - Upload avatar file
- `POST /api/avatar/personas/from-lead` - Create persona from lead data

#### Session Management
- `POST /api/avatar/session/create` - Create chat session
- `GET /api/avatar/session/:id` - Get session details
- `GET /api/avatar/session/:id/history` - Get conversation history
- `POST /api/avatar/session/:id/end` - End session
- `POST /api/avatar/session/:id/message` - Send message (HTTP fallback)

#### Knowledge Base Management
- `GET /api/avatar/knowledge` - List knowledge bases
- `GET /api/avatar/knowledge/:id` - Get knowledge base
- `POST /api/avatar/knowledge/create` - Create knowledge base
- `PUT /api/avatar/knowledge/:id` - Update knowledge base
- `DELETE /api/avatar/knowledge/:id` - Delete knowledge base
- `POST /api/avatar/knowledge/:kbId/documents` - Add document
- `GET /api/avatar/knowledge/:kbId/documents` - List documents
- `DELETE /api/avatar/knowledge/:kbId/documents/:docId` - Delete document
- `POST /api/avatar/knowledge/:kbId/documents/upload` - Upload document file

#### Asset Serving
- `GET /api/avatar/assets/:filename` - Serve cached 3D avatar files (.glb)
- `GET /api/avatar/audio/:filename` - Serve generated audio files (.mp3)

#### Stats
- `GET /api/avatar/stats` - Get system statistics

---

### 3. WebSocket Endpoint
**Path**: `/api/avatar/ws/chat/:sessionId` or `/ws/chat/:sessionId`

**Purpose**: Real-time bidirectional communication for avatar chat

**Message Types**:
- `user_message`: User sends text message
- `ping`: Keep-alive ping
- Server responses:
  - `connected`: Connection confirmed
  - `response`: AI-generated text response
  - `audio_ready`: TTS audio URL ready
  - `phonemes`: Lip-sync phoneme data
  - `emotion`: Detected emotion from response
  - `error`: Error message

---

## 🔧 Core Services Explained

### 1. Lead Discovery Service (`services/discovery.ts`)
- **Purpose**: Find company domains using search engines or AI
- **Functions**:
  - `simulateSearch()`: Scrapes Google/Bing search results
  - `buildBaseQueries()`: Constructs search queries from criteria
- **Features**:
  - Extracts links from search results
  - Filters out blacklisted domains (Google, Bing, etc.)
  - Falls back to Bing if Google fails (anti-bot measures)

### 2. Lead Enrichment Service (`services/enrichment.ts`)
- **Purpose**: Enrich leads with contact info, company data, news, jobs
- **Process Flow**:
  1. Extract domains from URLs
  2. Use Hunter.io to find emails (with rate limiting)
  3. Filter by title (strict matching for CEO/CFO/Founder)
  4. Verify emails (optional)
  5. Scrape websites for phone, LinkedIn, careers links
  6. Fetch company news (News API, capped at 5)
  7. Find job listings (AI-suggested URLs, capped at 5)
- **Cost Optimization**:
  - Only scrapes domains that already have leads
  - Caps news/jobs enrichment to 5 companies
  - Uses AI to suggest job URLs (saves scraping attempts)
  - Stops early if rate-limited

### 3. Agent Service (`services/agent.ts`)
- **Purpose**: Orchestrate email enrichment across providers
- **Functions**:
  - `agentEnrichEmails()`: Fetches emails from Hunter.io per domain
- **Features**:
  - Budget tracking (cost per API call)
  - Per-domain limits to control costs
  - Provider fallback logic

### 4. Avatar Services (`services/avatar/`)

#### Persona Manager (`personaManager.ts`)
- **Purpose**: CRUD operations for AI personas
- **Storage**: JSON files in `data/personas/`
- **Fields**: name, role, description, speaking_style, avatar_id, voice_id, personality_traits, knowledge_base_ids

#### Session Manager (`sessionManager.ts`)
- **Purpose**: Manage chat sessions
- **Storage**: In-memory (with optional persistence)
- **Features**: Conversation history, session expiration, message storage

#### LLM Service (`llmService.ts`)
- **Purpose**: Generate AI responses using OpenAI
- **Process**:
  1. Retrieves relevant context from RAG system
  2. Generates response using GPT-4 with persona context
  3. Detects emotion from response text
- **Features**: Context-aware responses, emotion detection

#### TTS Service (`ttsService.ts`)
- **Purpose**: Convert text to speech
- **Provider**: OpenAI TTS API
- **Output**: MP3 audio files stored in `data/audio/`
- **Features**: Voice selection per persona, emotion-based voice modulation

#### Phoneme Service (`phonemeService.ts`)
- **Purpose**: Extract phonemes for lip-sync animation
- **Process**: Analyzes audio to generate phoneme timing data
- **Output**: Array of phonemes with timestamps

#### RAG System (`ragSystem.ts`)
- **Purpose**: Retrieval-Augmented Generation for context-aware responses
- **Storage**: JSON files in `data/knowledge_bases/`
- **Features**:
  - Knowledge base management
  - Document storage and retrieval
  - Semantic search for relevant context
  - Document chunking and embedding

#### Avatar Cache (`avatarCache.ts`)
- **Purpose**: Download and cache 3D avatar files
- **Source**: ReadyPlayerMe models
- **Storage**: `data/avatars/`
- **Features**: On-demand downloading, local file serving

#### WebSocket Handler (`websocketHandler.ts`)
- **Purpose**: Handle real-time WebSocket connections
- **Process**:
  1. Validates session ID from URL path
  2. Verifies session exists
  3. Processes user messages
  4. Generates response (LLM → TTS → Phonemes)
  5. Streams response back to client

---

## 🔌 External Providers

### Hunter.io (`providers/hunter.ts`)
- **Purpose**: Find and verify email addresses
- **Endpoints Used**:
  - Domain search: `/v2/domain-search`
  - Email verification: `/v2/email-verifier`
- **Rate Limiting**: Handles 429 errors gracefully

### Apollo.io (`providers/apollo.ts`)
- **Purpose**: People search by domain/title/location
- **Endpoints Used**:
  - `/v1/mixed_people/search` (primary)
  - `/v1/people/search` (fallback)
- **Features**: Auto-disables if API plan doesn't support

### OpenAI (`utils/ai.ts`)
- **Purpose**: AI-powered domain suggestions, lead structuring, job URL suggestions
- **Models Used**:
  - `gpt-4o-mini`: Domain suggestions, lead structuring
  - `gpt-4`: Avatar chat responses
  - TTS API: Text-to-speech

---

## 🛠️ Utilities

### Phone Normalization (`utils/phone.ts`)
- Converts phone numbers to E.164 format
- Handles country code detection from location/domain
- Formats for readability (e.g., "+1 415 555 1234")

### Web Scraping (`utils/scrape.ts`)
- Extracts phone numbers, addresses, social links, careers links
- Uses Cheerio for HTML parsing
- Handles timeouts and errors gracefully

### Budget Tracking (`utils/budget.ts`)
- Tracks API costs per operation
- Prevents exceeding budget limits
- Cost per operation configurable via env vars

### Outreach (`utils/outreach.ts`)
- Generates personalized emails using AI
- Supports Gmail and SMTP sending
- Includes tracking pixels for open rates

### News Fetching (`utils/news.ts`)
- Fetches company news from News API
- Caches results to avoid duplicate requests

### Job Enrichment (`utils/jobs.ts`)
- Scrapes job listings from company career pages
- Uses AI to suggest job URLs (saves scraping attempts)

---

## ⚙️ Configuration (`config.ts`)

### Environment Variables
- `PORT`: Server port (default: 4000)
- `OPENAI_API_KEY`: OpenAI API key
- `HUNTER_API_KEY`: Hunter.io API key
- `APOLLO_API_KEY`: Apollo.io API key
- `APOLLO_ENABLED`: Enable/disable Apollo (default: true)
- `NEWS_API_KEY`: News API key
- `RUN_BUDGET_USD`: Maximum budget per run (default: 0.5)
- `PARALLELISM`: Concurrent request limit (default: 8)
- `HUNTER_MAX_EMAILS_PER_DOMAIN`: Max emails per domain (default: 1)
- `REQUEST_TIMEOUT_MS`: HTTP request timeout (default: 8000ms)

### Cost Configuration
- `COST_HUNTER_DOMAIN`: Cost per Hunter domain search (default: $0.002)
- `COST_HUNTER_VERIFY`: Cost per email verification (default: $0.001)
- `COST_APOLLO_SEARCH`: Cost per Apollo search (default: $0.02)

---

## 📊 Data Flow Examples

### Lead Generation Flow
```
1. User requests: POST /api/discover-and-enrich
   { industry: "SaaS", roleOrTitle: "CEO", locations: ["France"], numLeads: 10 }

2. Discovery Phase:
   - AI suggests domains (OpenAI GPT-4)
   - Returns: ["stripe.com", "salesforce.com", ...]

3. Enrichment Phase:
   - For each domain:
     a. Hunter.io finds emails
     b. Filter by title (CEO only)
     c. Verify emails (optional)
     d. Scrape website for phone/LinkedIn
     e. Fetch company news (capped)
     f. Find job listings (capped)
   - AI structures lead data (optional)

4. Response:
   { leads: [...], stats: { total: 10, hunter: 10, verified: 8 } }
```

### Avatar Chat Flow
```
1. User creates session: POST /api/avatar/session/create
   { persona_id: "abc123", user_id: "user1" }

2. WebSocket connection: ws://localhost:4000/api/avatar/ws/chat/:sessionId

3. User sends message: { type: "user_message", message: "Hello!" }

4. Backend processing:
   a. RAG system retrieves relevant context
   b. LLM generates response (GPT-4)
   c. TTS converts to speech (OpenAI TTS)
   d. Phoneme service extracts lip-sync data
   e. Emotion detection from response

5. Server streams response:
   - { type: "response", text: "Hello! How can I help?" }
   - { type: "audio_ready", url: "/api/avatar/audio/abc.mp3" }
   - { type: "phonemes", data: [...] }
   - { type: "emotion", emotion: "happy" }
```

---

## 🔒 Security & Best Practices

1. **Rate Limiting**: Handles API rate limits gracefully (429 errors)
2. **Budget Tracking**: Prevents exceeding API costs
3. **Input Validation**: Validates URLs, domains, phone numbers
4. **Error Handling**: Comprehensive error logging and graceful fallbacks
5. **File Upload Limits**: 10MB limit for avatar/document uploads
6. **Session Validation**: WebSocket connections require valid session IDs

---

## 🚀 Running the Backend

### Development
```bash
npm run dev  # Uses nodemon + ts-node
```

### Production
```bash
npm run build  # Compile TypeScript
npm start      # Run compiled JavaScript
```

### Environment Setup
Create `.env` file with:
```
PORT=4000
OPENAI_API_KEY=sk-...
HUNTER_API_KEY=...
APOLLO_API_KEY=...
NEWS_API_KEY=...
```

---

## 📝 Key Features

1. **AI-Powered Lead Discovery**: Uses GPT-4 to suggest relevant companies
2. **Multi-Provider Enrichment**: Hunter.io, Apollo.io, web scraping
3. **Smart Filtering**: Title, location, company size, founded year
4. **Cost Optimization**: Budget tracking, rate limiting, capped enrichment
5. **Real-Time Avatar Chat**: WebSocket-based with voice + lip-sync
6. **RAG System**: Context-aware responses using knowledge bases
7. **Email Outreach**: AI-generated personalized emails
8. **Export**: CSV export for leads

---

## 🐛 Common Issues & Solutions

1. **Rate Limiting (429 errors)**: 
   - Hunter.io rate limits → Backend waits 2s and returns empty
   - Solution: Wait a few minutes or upgrade API plan

2. **Apollo Disabled**:
   - If API plan doesn't support → Auto-disables
   - Falls back to Hunter.io only

3. **Avatar Services Not Initialized**:
   - Check logs for initialization errors
   - Ensure OpenAI API key is valid

4. **WebSocket Connection Fails**:
   - Verify session ID is valid
   - Check path format: `/api/avatar/ws/chat/:sessionId`

---

## 📚 Additional Notes

- **TypeScript**: All source code is in TypeScript, compiled to JavaScript in `dist/`
- **Logging**: Structured logging using `logger.ts` utility
- **Data Persistence**: Personas, knowledge bases stored as JSON files
- **3D Avatars**: Uses ReadyPlayerMe GLB models with ARKit morph targets for lip-sync
- **TTS**: OpenAI TTS API with multiple voice options
- **Cost Tracking**: Tracks API costs to stay within budget

---

This backend powers a comprehensive lead generation platform with an advanced AI avatar chat system. The architecture is modular, scalable, and cost-optimized for production use.

