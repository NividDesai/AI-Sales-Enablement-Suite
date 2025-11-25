import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  canvaApiKey: process.env.CANVA_API_KEY || "",
  hunterApiKey: process.env.HUNTER_API_KEY || "",
  openCorporatesApiKey: process.env.OPENCORPORATES_API_KEY || "",
  clearbitApiKey: process.env.CLEARBIT_API_KEY || "",
  apolloApiKey: process.env.APOLLO_API_KEY || "",
  apolloEnabled: process.env.APOLLO_ENABLED === undefined ? true : String(process.env.APOLLO_ENABLED).toLowerCase() !== 'false',
  newsApiKey: process.env.NEWS_API_KEY || "",
  userAgent:
    process.env.HTTP_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  // Lower default request timeout to speed up fallbacks; can override via env
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 8000),
  // Slightly higher parallelism to speed scraping/enrichment; tune via env
  parallelism: Number(process.env.PARALLELISM || 8),
  hunterMaxEmailsPerDomain: Number(process.env.HUNTER_MAX_EMAILS_PER_DOMAIN || 1),
  runBudgetUsd: Number(process.env.RUN_BUDGET_USD || 0.5),
  providerUnitCosts: {
    hunterDomain: Number(process.env.COST_HUNTER_DOMAIN || 0.002),
    hunterVerify: Number(process.env.COST_HUNTER_VERIFY || 0.001),
    clearbitProspector: Number(process.env.COST_CLEARBIT_PROSPECTOR || 0.02),
    apolloSearch: Number(process.env.COST_APOLLO_SEARCH || 0.02),
    openCorporates: Number(process.env.COST_OPEN_CORPORATES || 0.0),
  } as Record<string, number>,
  // Figma
  figmaToken: process.env.FIGMA_TOKEN || "",
  figmaFileKeyCv: process.env.FIGMA_FILE_KEY_CV || "",
  figmaNodeIdCv: process.env.FIGMA_NODE_ID_CV || "",
  figmaFileKeyB2B: process.env.FIGMA_FILE_KEY_B2B || "",
  figmaNodeIdB2B: process.env.FIGMA_NODE_ID_B2B || "",
  figmaCvTemplates: (() => {
    const m = String(process.env.FIGMA_CV_TEMPLATES || "").trim();
    // Format: templateId:fileKey:nodeId;templateId2:fileKey2:nodeId2
    if (!m) return {} as Record<string, { fileKey: string; nodeId: string }>;
    const out: Record<string, { fileKey: string; nodeId: string }> = {};
    for (const part of m.split(';')) {
      const [id, fk, ...nidParts] = part.split(':');
      const nid = nidParts.join(':');
      if (id && fk && nid) out[id] = { fileKey: fk, nodeId: nid };
    }
    return out;
  })(),
};


