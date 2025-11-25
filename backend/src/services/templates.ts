import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TPL_DIR = path.join(DATA_DIR, 'templates');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TPL_DIR)) fs.mkdirSync(TPL_DIR, { recursive: true });
}

export type StoredTemplate = { id: string; name: string; html: string; css?: string; createdAt: string };

export function listUserTemplates(): StoredTemplate[] {
  ensureDirs();
  const files = fs.readdirSync(TPL_DIR).filter(f => f.endsWith('.json'));
  const out: StoredTemplate[] = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(TPL_DIR, f), 'utf8')) as StoredTemplate;
      if (j && j.id && j.html) out.push(j);
    } catch {}
  }
  return out;
}

export function saveUserTemplate(t: { id?: string; name?: string; html: string; css?: string }): StoredTemplate {
  ensureDirs();
  const id = (t.id || `tpl_${Date.now()}`).replace(/[^a-zA-Z0-9_\-]/g, '');
  const name = t.name || id;
  const rec: StoredTemplate = { id, name, html: t.html, css: t.css, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(TPL_DIR, `${id}.json`), JSON.stringify(rec, null, 2), 'utf8');
  return rec;
}

export async function fetchTemplateFromUrl(url: string): Promise<{ html: string; css?: string }> {
  const cheerio = await import('cheerio');
  const res = await (await import('node-fetch')).default(url);
  if (!res.ok) throw new Error(`fetch template http ${res.status}`);
  const text = await res.text();
  
  // Parse and clean the HTML
  const $ = cheerio.load(text);
  
  // Remove scripts, iframes, and other dynamic content that won't work in templates
  $('script').remove();
  $('iframe').remove();
  $('noscript').remove();
  
  // Extract inline styles
  let css = '';
  $('style').each((_, el) => {
    css += $(el).html() + '\n';
  });
  
  // Remove style tags (we'll inject CSS via {{CSS}})
  $('style').remove();
  
  // Get the body content or full HTML
  let html = $('body').html() || $.html();
  
  // Clean up and prepare for token replacement
  // Replace common text patterns with tokens
  html = html
    .replace(/\b(partnership|proposal|collaboration)\b/gi, '{{subject}}')
    .replace(/\b(hello|hi|dear)\s+[\w\s]+/gi, 'Hello {{lead_name}}');
  
  // Wrap in a proper template structure
  const template = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{{company}} → {{lead_company}}</title>
  <style>
    {{CSS}}
    /* Imported styles */
    ${css}
  </style>
</head>
<body>
  <div class="template-wrapper">
    ${html}
  </div>
  
  <!-- Token placeholders for easy editing -->
  <div style="display:none;" class="tokens">
    <div class="subject">{{subject}}</div>
    <div class="opening">{{opening}}</div>
    <div class="problem">{{problem}}</div>
    <div class="solution">{{solution}}</div>
    <div class="benefits">{{benefits}}</div>
    <div class="proof">{{proof}}</div>
    <div class="cta">{{cta}}</div>
    <div class="closing">{{closing}}</div>
  </div>
</body>
</html>`;
  
  return { html: template, css };
}
