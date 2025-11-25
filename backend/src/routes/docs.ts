import { Router } from "express";
import multer from "multer";
import { logger } from "../utils/logger";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { httpGet } from "../utils/scrape";
import { config } from "../config";
import fetch from "node-fetch";
import PptxGenJS from "pptxgenjs";
// Figma removed per requirements. We keep imports removed and provide a templating approach instead.
import { listUserTemplates, saveUserTemplate, fetchTemplateFromUrl } from "../services/templates";
// franc has no bundled types in some setups; use require to avoid TS type error
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { franc } = require("franc");
// pdf-parse has no official types; import as any
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: any = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Router instance must be declared before use
const router = Router();

type UserProfile = {
  name: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  title?: string;
  summary?: string;
  experience?: Array<{ company: string; position: string; duration: string; description: string; achievements?: string[] }>;
  education?: Array<{ institution: string; degree: string; year: string; gpa?: string }>;
  skills?: { technical?: string[]; soft?: string[]; languages?: string[]; certifications?: string[] };
  projects?: Array<{ name: string; description: string; technologies?: string[]; link?: string }>;
  photoDataUrl?: string; // embedded image from uploaded CV if available
};

type JobPosting = {
  company: string;
  position: string;
  description: string;
  requirements?: string[];
  preferences?: string[];
  location?: string;
  type?: string;
};

type CompanyInfo = {
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  valueProposition?: string;
  products?: string[];
  differentiators?: string[];
};

type LeadDetails = {
  website?: string;
  industry?: string;
  size?: string;
  logoUrl?: string;
  brandColor?: string; // hex like #0d6efd
  heroImageUrl?: string;
  videoUrl?: string; // not embeddable; include as link
};

async function fetchImageBuffer(url?: string): Promise<{ bytes: Uint8Array; type: 'png'|'jpg' } | null> {
  try {
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = String(r.headers.get('content-type') || '').toLowerCase();
    const ab = await r.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (ct.includes('png')) return { bytes, type: 'png' };
    // heuristics: try both
    return { bytes, type: 'jpg' };
  } catch {
    return null;
  }
}

async function enrichLeadMedia(leadDetails: any, lead: any): Promise<any> {
  const out = { ...(leadDetails||{}) };
  // Logo via Clearbit logo endpoint if website domain available
  if (!out.logoUrl && lead?.website) {
    try {
      const host = new URL(lead.website).hostname.replace(/^www\./,'');
      out.logoUrl = `https://logo.clearbit.com/${host}`;
    } catch {}
  }
  // Try OpenGraph image from website
  if (!out.heroImageUrl && lead?.website) {
    try {
      const html = await httpGet(lead.website);
      if (html) {
        const $ = cheerio.load(html);
        const og = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
        if (og) out.heroImageUrl = og;
      }
    } catch {}
  }
  return out;
}
 

function sanitizeLanguageList(list: string[]): string[] {
  const cleaned = (list||[])
    .map(s => String(s||'').replace(/[^\p{L}\p{N}\s\-\+]/gu, '').trim())
    .filter(Boolean)
    .map(s => s.replace(/\s+/g, ' '));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of cleaned) { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(s); } }
  return out.slice(0, 20);
}

function dataUrlFromBuffer(buf: Buffer, mime: string) {
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}

// -------- Templates (no Figma) --------
type TemplateDef = { id: string; name: string; html: string; css?: string };
const builtinTemplates: TemplateDef[] = [
  {
    id: 'clean-a4-cv',
    name: 'Clean A4 CV',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>{{CSS}}</style></head><body>
    <div class="page">
      <div class="header-top">
        {{#if photo}}<img class="photo" src="{{photo}}"/>{{/if}}
        <div class="header-text">
          <div class="name">{{name}}</div>
          <div class="title">{{title}}</div>
          <div class="contact">{{contact}}</div>
        </div>
      </div>
      <div class="row">
        <div class="col left">
          <div class="block"><div class="h">Summary</div><div class="t">{{summary}}</div></div>
          <div class="block"><div class="h">Skills</div><div class="t">{{skills}}</div></div>
        </div>
        <div class="col right">
          <div class="block"><div class="h">Experience</div><div class="t">{{experience_list}}</div></div>
          <div class="block"><div class="h">Education</div><div class="t">{{education_list}}</div></div>
        </div>
      </div>
    </div>
    </body></html>`,
    css: `.page{width:816px;height:1056px;margin:0 auto;padding:28px;box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111}
      .header-top{display:flex;align-items:flex-start;gap:16px;border-bottom:2px solid #eee;padding-bottom:16px;margin-bottom:16px}
      .header-text{flex:1;min-width:0}
      .photo{width:96px;height:96px;object-fit:cover;border-radius:10px;border:2px solid #eee;flex-shrink:0}
      .name{font-size:32px;font-weight:700;margin:0}
      .title{color:#555;margin:4px 0 6px 0}
      .contact{color:#666;font-size:12px;line-height:1.4;word-break:break-word}
      .row{display:flex;align-items:flex-start;gap:16px}
      .col.left{flex:1;min-width:0}
      .col.right{flex:2;min-width:0}
      .block{margin:12px 0}
      .h{font-weight:600;margin-bottom:6px}
      .t{white-space:pre-wrap}
      .t ul{margin:6px 0 0 18px;padding:0}
      .t li{margin:4px 0}
      ul{margin:6px 0 0 18px;padding:0}
      li{margin:4px 0}`,
  },
  {
    id: 'professional-cv',
    name: 'Professional CV with Sidebar',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>{{CSS}}</style></head><body>
    <div class="page">
      <div class="sidebar">
        {{#if photo}}<div class="photo-container"><img class="photo" src="{{photo}}"/></div>{{/if}}
        <div class="sidebar-section">
          <div class="sidebar-h">Contact</div>
          <div class="sidebar-t">{{contact}}</div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-h">Skills</div>
          <div class="sidebar-t">{{skills}}</div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-h">Education</div>
          <div class="sidebar-t">{{education_list}}</div>
        </div>
      </div>
      <div class="main-content">
        <div class="header">
          <div class="name">{{name}}</div>
          <div class="title">{{title}}</div>
        </div>
        <div class="section">
          <div class="section-h">Professional Summary</div>
          <div class="section-t">{{summary}}</div>
        </div>
        <div class="section">
          <div class="section-h">Experience</div>
          <div class="section-t">{{experience_list}}</div>
        </div>
      </div>
    </div>
    </body></html>`,
    css: `.page{width:816px;height:1056px;margin:0;display:flex;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111}
      .sidebar{width:280px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:32px 24px;box-sizing:border-box}
      .photo-container{text-align:center;margin-bottom:24px}
      .photo{width:140px;height:140px;object-fit:cover;border-radius:50%;border:4px solid rgba(255,255,255,0.3)}
      .sidebar-section{margin-bottom:24px}
      .sidebar-h{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;opacity:0.9}
      .sidebar-t{font-size:13px;line-height:1.6;opacity:0.95}
      .main-content{flex:1;padding:32px;box-sizing:border-box;overflow:hidden}
      .header{margin-bottom:24px;border-bottom:3px solid #667eea;padding-bottom:16px}
      .name{font-size:36px;font-weight:700;color:#1a1a1a}
      .title{font-size:18px;color:#555;margin-top:4px}
      .section{margin:20px 0}
      .section-h{font-size:16px;font-weight:700;color:#667eea;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;border-bottom:2px solid #e6e6e6;padding-bottom:4px}
      .section-t{font-size:13px;line-height:1.6}
      ul{margin:6px 0 0 18px;padding:0}
      li{margin:4px 0}`,
  },
  {
    id: 'minimalist-cv',
    name: 'Minimalist CV',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>{{CSS}}</style></head><body>
    <div class="page">
      <div class="header">
        {{#if photo}}<img class="photo" src="{{photo}}"/>{{/if}}
        <div class="header-content">
          <div class="name">{{name}}</div>
          <div class="title">{{title}}</div>
          <div class="contact">{{contact}}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="content">
        <div class="summary">{{summary}}</div>
        <div class="two-col">
          <div class="col">
            <div class="label">Experience</div>
            <div class="content-section">{{experience_list}}</div>
          </div>
          <div class="col">
            <div class="label">Skills</div>
            <div class="content-section">{{skills}}</div>
            <div class="label">Education</div>
            <div class="content-section">{{education_list}}</div>
          </div>
        </div>
      </div>
    </div>
    </body></html>`,
    css: `.page{width:816px;height:1056px;margin:0 auto;padding:40px;box-sizing:border-box;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2d3436}
      .header{display:flex;align-items:center;gap:24px;margin-bottom:24px}
      .photo{width:100px;height:100px;object-fit:cover;border-radius:8px;border:3px solid #2d3436;flex-shrink:0}
      .header-content{flex:1}
      .name{font-size:32px;font-weight:300;letter-spacing:-0.02em;margin-bottom:4px}
      .title{font-size:16px;color:#636e72;font-weight:400;margin-bottom:8px}
      .contact{font-size:12px;color:#636e72;line-height:1.5}
      .divider{height:2px;background:#2d3436;margin:24px 0}
      .summary{font-size:13px;line-height:1.7;margin-bottom:28px;text-align:justify}
      .two-col{display:flex;gap:32px}
      .col{flex:1;min-width:0}
      .col:first-child{flex:1.5}
      .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:20px 0 8px 0;color:#2d3436}
      .content-section{font-size:12px;line-height:1.6;margin-bottom:16px}
      ul{margin:4px 0 0 16px;padding:0}
      li{margin:3px 0}`,
  },
  {
    id: 'creative-cv',
    name: 'Creative CV with Color Accent',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>{{CSS}}</style></head><body>
    <div class="page">
      <div class="accent-bar"></div>
      <div class="content-wrapper">
        <div class="top-section">
          {{#if photo}}<div class="photo-wrapper"><img class="photo" src="{{photo}}"/></div>{{/if}}
          <div class="header-info">
            <div class="name">{{name}}</div>
            <div class="title">{{title}}</div>
            <div class="contact">{{contact}}</div>
          </div>
        </div>
        <div class="main-grid">
          <div class="left-col">
            <div class="block">
              <div class="block-h">About Me</div>
              <div class="block-t">{{summary}}</div>
            </div>
            <div class="block">
              <div class="block-h">Skills</div>
              <div class="block-t">{{skills}}</div>
            </div>
            <div class="block">
              <div class="block-h">Education</div>
              <div class="block-t">{{education_list}}</div>
            </div>
          </div>
          <div class="right-col">
            <div class="block">
              <div class="block-h">Work Experience</div>
              <div class="block-t">{{experience_list}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </body></html>`,
    css: `.page{width:816px;height:1056px;margin:0;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;position:relative}
      .accent-bar{width:8px;background:linear-gradient(180deg,#ff6b6b 0%,#ee5a6f 50%,#e4558e 100%);position:absolute;left:0;top:0;bottom:0}
      .content-wrapper{padding:32px 32px 32px 48px}
      .top-section{display:flex;gap:24px;align-items:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #f0f0f0}
      .photo-wrapper{flex-shrink:0}
      .photo{width:110px;height:110px;object-fit:cover;border-radius:50%;border:4px solid #ff6b6b;box-shadow:0 4px 12px rgba(255,107,107,0.2)}
      .header-info{flex:1}
      .name{font-size:32px;font-weight:700;color:#2d3436;margin-bottom:4px}
      .title{font-size:16px;color:#ff6b6b;font-weight:600;margin-bottom:8px}
      .contact{font-size:12px;color:#636e72;line-height:1.6}
      .main-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:24px}
      .block{margin-bottom:20px}
      .block-h{font-size:14px;font-weight:700;color:#2d3436;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #ff6b6b;display:inline-block}
      .block-t{font-size:12px;line-height:1.6;color:#2d3436}
      ul{margin:6px 0 0 16px;padding:0}
      li{margin:3px 0}`,
  },
  {
    id: 'modern-b2b',
    name: 'Modern B2B Proposal',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{{company}} → {{lead_company}}</title><style>{{CSS}}</style></head><body>
    <div class="page">
      <div class="brand-bar" style="background:{{brand_color}}"></div>
      <header>
        <div class="header-content">
          <h1>{{company}} → {{lead_company}}</h1>
          <div class="meta">{{lead_industry}} {{#if lead_size}}• {{lead_size}}{{/if}}</div>
        </div>
        {{#if logo}}<img class="logo" src="{{logo}}" alt="logo"/>{{/if}}
      </header>
      
      <h2 class="subject">{{subject}}</h2>
      
      {{#if hero}}<img class="hero" src="{{hero}}" alt="hero"/>{{/if}}
      
      <section class="content">
        <div class="section">
          <h3>Introduction</h3>
          {{opening}}
        </div>
        
        {{#if problem}}
        <div class="section">
          <h3>The Challenge</h3>
          {{problem}}
        </div>
        {{/if}}
        
        <div class="section">
          <h3>Our Solution</h3>
          {{solution}}
        </div>
        
        {{#if benefits}}
        <div class="section">
          <h3>Key Benefits</h3>
          {{benefits}}
        </div>
        {{/if}}
        
        {{#if proof}}
        <div class="section">
          <h3>Proven Results</h3>
          {{proof}}
        </div>
        {{/if}}
        
        <div class="section cta-section">
          <h3>Next Steps</h3>
          {{cta}}
        </div>
        
        <div class="section closing">
          {{closing}}
        </div>
      </section>
      
      {{#if video_url}}
      <div class="video-link">
        <a href="{{video_url}}" target="_blank" class="btn">▶️ Watch Overview Video</a>
      </div>
      {{/if}}
    </div>
    </body></html>`,
    css: `body{margin:0;padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f8f9fa;color:#111}
      .page{max-width:900px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 6px 30px rgba(0,0,0,.08);overflow:hidden}
      .brand-bar{height:8px;width:100%}
      header{display:flex;justify-content:space-between;align-items:center;padding:32px;border-bottom:1px solid #eee}
      .header-content h1{margin:0 0 8px 0;font-size:28px;font-weight:700}
      .meta{color:#666;font-size:14px}
      .logo{height:48px;object-fit:contain}
      .subject{padding:24px 32px 0;margin:0;font-size:24px;font-weight:600;color:#0d6efd}
      .hero{width:100%;max-height:300px;object-fit:cover;margin:16px 0}
      .content{padding:0 32px 32px}
      .section{margin:24px 0}
      .section h3{font-size:18px;font-weight:600;margin:0 0 12px 0;color:#333}
      .section p{margin:8px 0;line-height:1.6}
      .section ul{margin:8px 0;padding-left:24px}
      .section li{margin:6px 0;line-height:1.5}
      .cta-section{background:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #0d6efd}
      .closing{color:#666;font-style:italic}
      .video-link{padding:0 32px 32px;text-align:center}
      .btn{display:inline-block;background:#0d6efd;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600}
      .btn:hover{background:#0b5ed7}`,
  },
];

function renderCvIntoTemplate(profile: UserProfile, job: JobPosting, lang: string, template: TemplateDef | { html: string; css?: string }, customCss?: string) {
  const tpl = template as any;
  // Merge base template CSS with custom design CSS (custom overrides come last)
  const baseCss = String(tpl.css || '');
  const mergedCss = baseCss + (customCss ? `\n${String(customCss)}` : '');
  const htmlTpl = String(tpl.html||'').replace('{{CSS}}', mergedCss);
  
  // Get localized labels for the target language
  const L = labels(lang);
  
  const contact = [profile.email, profile.phone, profile.location, profile.linkedinUrl].filter(Boolean).join(' • ');
  const skills = (profile.skills?.technical||[]).slice(0,50).join(', ');
  const exp = (profile.experience||[]);
  const expHtml = exp.map((e:any)=>{
    const bullets = Array.isArray(e.achievements) && e.achievements.length ? e.achievements : String(e.description||'').split(/[•\-\n\.]/).map((s:string)=>s.trim()).filter(Boolean).slice(0,5);
    return `<div style="margin-bottom:8px"><div><strong>${escapeHtml(e.position)}</strong> — ${escapeHtml(e.company)}</div>${bullets.length?`<ul>${bullets.map((b:string)=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>`:''}</div>`;
  }).join('');
  const edu = (profile.education||[]).map((e:any)=>`<div>${escapeHtml(e.degree)} — ${escapeHtml(e.institution)} (${escapeHtml(e.year)})</div>`).join('');
  const tokens: Record<string,string> = {
    '{{name}}': escapeHtml(profile.name||''),
    '{{title}}': escapeHtml(profile.title||job.position||''),
    '{{summary}}': escapeHtml(profile.summary||''),
    '{{skills}}': escapeHtml(skills),
    '{{contact}}': escapeHtml(contact),
    '{{experience_list}}': expHtml,
    '{{education_list}}': edu,
    '{{photo}}': String(profile.photoDataUrl||''),
  };
  let out = htmlTpl;
  for (const k of Object.keys(tokens)) out = out.split(k).join(tokens[k]);
  // remove conditional photo wrapper if no photo
  if (!profile.photoDataUrl) out = out.replace(/\{\{#if photo\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  else out = out.replace(/\{\{#if photo\}\}|\{\{\/if\}\}/g, '');
  
  // Fallback injection: if template doesn't include {{photo}} but we have a photo, inject into body start
  if (profile.photoDataUrl && out.indexOf(profile.photoDataUrl) === -1) {
    out = out.replace(/<body([^>]*)>/i, (m, attrs) => `${m}\n<div style="display:flex;justify-content:flex-end;align-items:center;padding:8px 0"><img alt="photo" src="${profile.photoDataUrl}" style="height:96px;width:96px;border-radius:50%;object-fit:cover;border:2px solid #eee"/></div>`);
  }
  
  return out;
}

function renderB2BIntoTemplate(content: any, company: CompanyInfo, lead: any, leadDetails: any, lang: string, template: TemplateDef | { html: string; css?: string }) {
  const css = String((template as any).css||'');
  const htmlTpl = String((template as any).html||'').replace('{{CSS}}', css);
  
  // Build comprehensive token map with all content
  const tokens: Record<string,string> = {
    '{{subject}}': escapeHtml(String(content.subject||'')),
    '{{opening}}': String(content.opening||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join(''),
    '{{problem}}': String(content.problem||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join(''),
    '{{solution}}': String(content.solution||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join(''),
    '{{benefits}}': (content.valueProps||[]).length ? `<ul>${(content.valueProps||[]).map((v:string)=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>` : '',
    '{{proof}}': (content.proofPoints||[]).length ? `<ul>${(content.proofPoints||[]).map((v:string)=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>` : '',
    '{{cta}}': String(content.cta||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join(''),
    '{{closing}}': String(content.closing||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join(''),
    '{{logo}}': String(leadDetails?.logoUrl||''),
    '{{hero}}': String(leadDetails?.heroImageUrl||''),
    '{{company}}': escapeHtml(company.name||''),
    '{{lead_company}}': escapeHtml(lead?.company||''),
    '{{lead_name}}': escapeHtml(lead?.name||'Team'),
    '{{lead_title}}': escapeHtml(lead?.title||''),
    '{{lead_industry}}': escapeHtml(leadDetails?.industry||''),
    '{{lead_size}}': escapeHtml(leadDetails?.size||''),
    '{{lead_website}}': escapeHtml(leadDetails?.website||''),
    '{{brand_color}}': String(leadDetails?.brandColor||'#0d6efd'),
    '{{video_url}}': String(leadDetails?.videoUrl||''),
  };
  
  let out = htmlTpl;
  // Replace all tokens
  for (const k of Object.keys(tokens)) {
    out = out.split(k).join(tokens[k]);
  }
  
  // Handle conditional blocks: {{#if logo}} ... {{/if}}
  out = out.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
    const tokenKey = `{{${varName}}}`;
    const value = tokens[tokenKey];
    return (value && value.length > 0) ? content : '';
  });
  
  return out;
}

// (moved above)

// ---------- Helpers ----------

// Extract the largest JPEG image from PDF (best for photos)
function extractLargestJpegDataUrlFromPdf(buf: Buffer): string | undefined {
  try {
    const bin = buf.toString('binary');
    let searchIdx = 0;
    let best: { len: number; dataUrl: string } | null = null;
    
    while (true) {
      const startStream = bin.indexOf('stream', searchIdx);
      if (startStream === -1) break;
      const endStream = bin.indexOf('endstream', startStream);
      if (endStream === -1) break;
      
      // Check if this stream is an image with DCTDecode (JPEG)
      const headerStart = bin.lastIndexOf('obj', startStream);
      const header = headerStart !== -1 ? bin.slice(headerStart, startStream) : '';
      const isImage = /\/Subtype\s*\/Image/.test(header) && /\/DCTDecode/.test(header);
      
      if (isImage) {
        let dataStart = startStream + 'stream'.length;
        const nextTwo = bin.slice(dataStart, dataStart + 2);
        if (nextTwo === '\r\n') dataStart += 2;
        else if (bin[dataStart] === '\n') dataStart += 1;
        else if (bin[dataStart] === ' ') dataStart += 1;
        
        const binary = bin.substring(dataStart, endStream);
        const bytes = Buffer.from(binary, 'binary');
        const len = bytes.length;
        const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
        
        if (!best || len > best.len) best = { len, dataUrl };
      }
      
      searchIdx = endStream + 9;
    }
    
    return best?.dataUrl;
  } catch {
    return undefined;
  }
}

// Extract PNG images from PDF
function extractFirstPngDataUrlFromPdf(buf: Buffer): string | undefined {
  try {
    const bin = buf.toString('binary');
    const pngSig = "\x89PNG\r\n\x1a\n";
    let searchIdx = 0;
    let best: { len: number; dataUrl: string } | null = null;
    
    while (true) {
      const startStream = bin.indexOf('stream', searchIdx);
      if (startStream === -1) break;
      const endStream = bin.indexOf('endstream', startStream);
      if (endStream === -1) break;
      
      // Check header area for Image subtype
      const headerStart = bin.lastIndexOf('obj', startStream);
      const header = headerStart !== -1 ? bin.slice(headerStart, startStream) : '';
      const isImage = /\/Subtype\s*\/Image/.test(header);
      
      const chunk = bin.slice(startStream + 6, endStream);
      if (isImage && chunk.includes(pngSig)) {
        const chunkBuf = Buffer.from(chunk, 'binary');
        const sigIdx = chunkBuf.indexOf(Buffer.from(pngSig, 'binary'));
        if (sigIdx !== -1) {
          const iendIdx = chunkBuf.indexOf(Buffer.from('IEND'));
          const slice = iendIdx !== -1 ? chunkBuf.slice(sigIdx, iendIdx + 8) : chunkBuf.slice(sigIdx);
          const len = slice.length;
          const dataUrl = `data:image/png;base64,${slice.toString('base64')}`;
          if (!best || len > best.len) best = { len, dataUrl };
        }
      }
      
      searchIdx = endStream + 9;
    }
    
    return best?.dataUrl;
  } catch {
    return undefined;
  }
}

function extractFirstImageDataUrlFromPdf(buf: Buffer): string | undefined {
  try {
    const str = buf.toString('binary');
    // Prefer JPEG, fallback to JPEG2000
    const markerIdx = (() => {
      const dct = str.indexOf('/DCTDecode');
      if (dct !== -1) return { idx: dct, mime: 'image/jpeg' as const };
      const jpx = str.indexOf('/JPXDecode');
      if (jpx !== -1) return { idx: jpx, mime: 'image/jp2' as const };
      return { idx: -1, mime: 'image/jpeg' as const };
    })();
    if (markerIdx.idx === -1) return undefined;
    const { idx, mime } = markerIdx;
    // find nearest 'stream' before and 'endstream' after
    const streamIdx = str.lastIndexOf('stream', idx);
    const endIdx = str.indexOf('endstream', idx);
    if (streamIdx === -1 || endIdx === -1) return undefined;
    // offset after 'stream' newline/space
    let dataStart = streamIdx + 'stream'.length;
    if (str[dataStart] === '\r' && str[dataStart+1] === '\n') dataStart += 2; else if (str[dataStart] === '\n') dataStart += 1; else if (str[dataStart] === ' ') dataStart += 1;
    const binary = str.substring(dataStart, endIdx);
    const bytes = Buffer.from(binary, 'binary');
    const b64 = bytes.toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return undefined;
  }
}
function detectLang(text: string): string {
  try {
    const code3 = franc(String(text || ""), { minLength: 20 });
    const map: Record<string, string> = { eng: "en", fra: "fr", fre: "fr", spa: "es", deu: "de", ger: "de", hin: "hi" };
    return map[code3] || "en";
  } catch {
    return "en";
  }
}
// Replace characters not supported by WinAnsi (StandardFonts) to avoid pdf-lib errors
function sanitizePdfText(s: string): string {
  return String(s || "")
    .replace(/\u2192/g, '->') // →
    .replace(/\u2013|\u2014/g, '-') // – —
    .replace(/[\u2018\u2019]/g, "'") // ‘ ’
    .replace(/[\u201C\u201D]/g, '"') // “ ”
    .replace(/[\u00A0]/g, ' '); // non-breaking space
}
function extractSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const headers = [
    "experience",
    "work history",
    "employment",
    "education",
    "academic",
    "skills",
    "technical skills",
    "competencies",
    "languages",
    "projects",
    "portfolio",
    "summary",
    "objective",
    "profile",
  ];

  const lines = text.split("\n");
  let currentSection = "";
  let sectionContent = "";

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    const matchedHeader = headers.find((h) => lower.includes(h));

    if (matchedHeader) {
      if (currentSection && sectionContent) {
        sections[currentSection] = sectionContent.trim();
      }
      currentSection = matchedHeader.split(" ")[0];
      sectionContent = "";
    } else if (currentSection) {
      sectionContent += line + "\n";
    }
  }

  if (currentSection && sectionContent) {
    sections[currentSection] = sectionContent.trim();
  }

  return sections;
}

function parseExperience(text: string): UserProfile["experience"] {
  const experiences: NonNullable<UserProfile["experience"]> = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length >= 2) {
      experiences.push({
        position: lines[0],
        company: lines[1],
        duration: lines[2] || "",
        description: lines.slice(3).join(" "),
      });
    }
  }
  return experiences;
}

function parseEducation(text: string): UserProfile["education"] {
  const education: NonNullable<UserProfile["education"]> = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length >= 2) {
      education.push({ degree: lines[0], institution: lines[1], year: lines[2] || "" });
    }
  }
  return education;
}

function parseSkills(text: string): UserProfile["skills"] {
  const skills: UserProfile["skills"] = {};
  const techMatch = text.match(/technical.*?:(.*?)(?:\n|$)/i);
  if (techMatch) {
    skills.technical = techMatch[1]
      .split(/[ ,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!skills.technical) {
    skills.technical = text
      .split(/[,;.\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 30);
  }
  return skills;
}

function parseTextCV(text: string): UserProfile {
  const profile: UserProfile = { name: "", email: "" } as UserProfile;

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) profile.email = emailMatch[0];

  const phoneMatch = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/);
  if (phoneMatch) profile.phone = phoneMatch[0];

  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) profile.linkedinUrl = `https://${linkedinMatch[0]}`;

  const sections = extractSections(text);
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 0) profile.name = lines[0].trim();

  if (sections.experience) profile.experience = parseExperience(sections.experience);
  if (sections.education) profile.education = parseEducation(sections.education);
  if (sections.skills) profile.skills = parseSkills(sections.skills);
  if (sections.languages) {
    const langs = sections.languages.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);
    profile.skills = { ...(profile.skills||{}), languages: sanitizeLanguageList(langs) };
  }

  return profile;
}

function sanitizeSkillsList(list: string[]): string[] {
  const blacklist = new Set([
    'linkedin','link','profile','resume','cv','vitae','email','phone','address','http','https','www','gmail','outlook','yahoo','portfolio','github','gitlab','bitbucket','references','certificate','certificates'
  ]);
  const allowedShort = new Set(['c','r','go','js','ts','c#','c++','ui','ux']);
  const cleaned = list
    .map(s => s.replace(/[^\p{L}\p{N}\s#\+\.\-]/gu, '').trim())
    .filter(s => s && (s.length >= 2 || allowedShort.has(s.toLowerCase())))
    .filter(s => !/[\/@]/.test(s) && !/^\d{3,}$/.test(s))
    .filter(s => !blacklist.has(s.toLowerCase()))
    .map(s => s.replace(/\s+/g, ' '));
  // dedupe case-insensitive
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of cleaned) { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(s); } }
  return out.slice(0, 40);
}

async function generateSummary(profile: UserProfile, job: JobPosting, lang: string): Promise<string> {
  // Enhanced non-AI base summary that's more tailored
  const topSkills = (profile.skills?.technical || []).slice(0, 6).join(", ") || "impact, ownership, collaboration";
  const yearsExp = profile.experience?.length ? `${profile.experience.length}+ years` : "extensive";
  
  const base = `${profile.title || "Professional"} with ${yearsExp} of experience targeting ${job.position} role at ${job.company}. Core competencies include ${topSkills}. Proven track record in delivering results and driving organizational success.`;
  
  if (!config.openaiApiKey) {
    logger.info("generateSummary:fallback", { message: "Using non-AI summary. Configure OPENAI_API_KEY for AI-generated summaries." });
    return base;
  }
  try {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You write concise, high-impact CV summaries in the target language: ${lang}. Max 3 sentences. Use action verbs and quantify achievements.` },
        { role: "user", content: `Candidate: ${profile.name}\nTitle: ${profile.title || ""}\nSkills: ${(profile.skills?.technical||[]).join(", ")}\nTarget company: ${job.company}\nTarget role: ${job.position}\nJob description: ${job.description}\nWrite the summary now in language=${lang}.` },
      ],
      temperature: 0.5,
    } as any;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.openaiApiKey}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) return base;
    const data: any = await r.json();
    return String(data?.choices?.[0]?.message?.content || base).trim();
  } catch {
    return base;
  }
}

function labels(lang: string) {
  const t: Record<string, Record<string,string>> = {
    en: { summary: "Professional Summary", experience: "Experience", skills: "Skills", education: "Education", contact: "Contact" },
    fr: { summary: "Résumé professionnel", experience: "Expérience", skills: "Compétences", education: "Éducation", contact: "Contact" },
    es: { summary: "Resumen profesional", experience: "Experiencia", skills: "Habilidades", education: "Educación", contact: "Contacto" },
    de: { summary: "Berufliches Profil", experience: "Berufserfahrung", skills: "Fähigkeiten", education: "Ausbildung", contact: "Kontakt" },
    hi: { summary: "व्यावसायिक सार", experience: "अनुभव", skills: "कौशल", education: "शिक्षा", contact: "संपर्क" },
  };
  return t[lang] || t.en;
}

function escapeHtml(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function generateHtmlCv(profile: UserProfile, job: JobPosting, lang: string) {
  const L = labels(lang);
  const contact = [profile.email, profile.phone, profile.location, profile.linkedinUrl].filter(Boolean).join(" · ");
  const skills = profile.skills?.technical?.slice(0, 16) || [];
  const eduHtml = (profile.education||[]).map(e => `<div class="edu-item"><div class="row"><strong>${escapeHtml(e.degree)}</strong><span>${escapeHtml(e.year||"")}</span></div><div>${escapeHtml(e.institution)}</div></div>`).join("");
  const expHtml = (profile.experience||[]).map(e => {
    const bullets = Array.isArray(e.achievements) && e.achievements.length
      ? e.achievements
      : String(e.description||"").split(/[•\-\n\.]/).map(s=>s.trim()).filter(Boolean).slice(0,6);
    const bulletsHtml = bullets.length ? `<ul>${bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>` : (e.description ? `<div>${escapeHtml(e.description)}</div>` : "");
    return `<div class="exp-item"><div class="row"><strong>${escapeHtml(e.position)}</strong><span>${escapeHtml(e.duration||"")}</span></div><div class="muted">${escapeHtml(e.company)}</div>${bulletsHtml}</div>`;
  }).join("");
  const skillsHtml = skills.length ? `<ul class="tags">${skills.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ul>` : "";
  const photo = profile.photoDataUrl ? `<img alt="photo" src="${profile.photoDataUrl}" style="height:96px;width:96px;border-radius:50%;object-fit:cover;border:2px solid #eee;flex-shrink:0"/>` : "";
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(profile.name)} – CV</title><style>
  * { box-sizing: border-box; }
  :root { --ink:#111; --muted:#666; --primary:#0d6efd; --border:#e6e6e6; }
  html, body { margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--ink); background: #fafafa; line-height: 1.5; }
  .page { max-width: 860px; margin: 24px auto; padding: 40px; background: white; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid var(--border); }
  .header-content { flex: 1; }
  h1 { margin: 0 0 4px 0; font-size: 28px; font-weight: 700; line-height: 1.2; }
  .title { color: var(--muted); font-size: 15px; font-weight: 500; margin: 4px 0; }
  .contact { color: var(--muted); font-size: 13px; margin-top: 8px; word-break: break-word; }
  .contact a { color: var(--primary); text-decoration: none; }
  .muted { color: var(--muted); font-size: 13px; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--primary); margin: 0 0 12px 0; font-weight: 700; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .row strong { flex: 1; }
  .row span { white-space: nowrap; }
  .exp-item, .edu-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
  .exp-item:last-child, .edu-item:last-child { border-bottom: none; }
  .exp-item ul, .edu-item ul { margin: 8px 0 0 0; padding-left: 20px; }
  .exp-item li, .edu-item li { margin: 4px 0; font-size: 13px; line-height: 1.5; }
  .tags { list-style: none; display: flex; gap: 8px; flex-wrap: wrap; padding: 0; margin: 0; }
  .tags li { border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 12px; background: #fafafa; }
  p { margin: 0 0 8px 0; font-size: 13px; line-height: 1.6; }
  p:last-child { margin-bottom: 0; }
  @media print { body { background: white; } .page { box-shadow: none; margin: 0; border: none; } }
  </style></head><body><div class="page">
   <header>
     <div class="header-content">
       <h1>${escapeHtml(profile.name || "Unnamed Candidate")}</h1>
       ${profile.title ? `<div class="title">${escapeHtml(profile.title)}</div>` : ""}
       <div class="contact">${escapeHtml(contact)}</div>
     </div>
     ${photo}
   </header>
   ${profile.summary ? `<div class="section"><h2>${L.summary}</h2><p>${escapeHtml(profile.summary)}</p></div>` : ""}
   ${expHtml ? `<div class="section"><h2>${L.experience}</h2>${expHtml}</div>` : ""}
   ${skillsHtml ? `<div class="section"><h2>${L.skills}</h2>${skillsHtml}</div>` : ""}
   ${eduHtml ? `<div class="section"><h2>${L.education}</h2>${eduHtml}</div>` : ""}
  </div></body></html>`;
}

async function optimizeExperience(
  experiences: NonNullable<UserProfile["experience"]>,
  job: JobPosting,
): Promise<NonNullable<UserProfile["experience"]>> {
  const scored = experiences.map((exp: any) => {
    let score = 0;
    const combined = `${exp.position} ${exp.description}`.toLowerCase();
    job.requirements?.forEach((req) => {
      if (combined.includes(String(req).toLowerCase())) score += 2;
    });
    job.preferences?.forEach((pref) => {
      if (combined.includes(String(pref).toLowerCase())) score += 1;
    });
    return { ...exp, score };
  });
  return scored.sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map(({ score, ...exp }: any) => exp);
}

async function prioritizeSkills(skills: NonNullable<UserProfile["skills"]>, job: JobPosting) {
  const prioritized = { ...skills } as any;
  const jobText = `${job.description} ${job.requirements?.join(" ")}`.toLowerCase();
  if (skills.technical) {
    prioritized.technical = sanitizeSkillsList([...skills.technical]).sort((a: string, b: string) => {
      const aFound = jobText.includes(a.toLowerCase()) ? 1 : 0;
      const bFound = jobText.includes(b.toLowerCase()) ? 1 : 0;
      return bFound - aFound;
    });
  }
  return prioritized as UserProfile["skills"];
}

async function ensureTargetLanguage(profile: UserProfile, job: JobPosting, lang: string): Promise<UserProfile> {
  if (!config.openaiApiKey) {
    logger.info("ensureTargetLanguage:skipped", { 
      reason: "OpenAI API key not configured",
      message: "CV content will remain in original language. Set OPENAI_API_KEY for automatic translation." 
    });
    return profile;
  }
  
  logger.info("ensureTargetLanguage:translating", { targetLang: lang, position: job.position });
  
  try {
    const minimal = {
      name: profile.name,
      title: profile.title,
      summary: profile.summary,
      experience: (profile.experience||[]).map(e => ({ position: e.position, company: e.company, duration: e.duration, achievements: e.achievements||[] })),
      education: (profile.education||[]).map(e => ({ degree: e.degree, institution: e.institution, year: e.year })),
      skills: profile.skills?.technical || [],
    };
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are a CV editor. Rewrite all text to ${lang}. Keep technical terms in original when appropriate (e.g., Python, React). Ensure complete, grammatical sentences. For experience, produce 3-5 powerful, quantified bullets per role. Do not invent employers or dates. Return valid JSON in the same shape as the input.` },
        { role: 'user', content: `Target role: ${job.position} @ ${job.company}\nJob description: ${job.description}\nCV JSON:\n${JSON.stringify(minimal)}` },
      ],
      temperature: 0.5,
    } as any;
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.openaiApiKey}` }, body: JSON.stringify(body) });
    if (!r.ok) return profile;
    const data: any = await r.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(raw);
    const out: UserProfile = { ...profile };
    if (parsed.summary) out.summary = String(parsed.summary);
    if (Array.isArray(parsed.experience)) {
      out.experience = (out.experience||[]).map((e, i) => ({ ...e, achievements: Array.isArray(parsed.experience[i]?.achievements) ? parsed.experience[i].achievements.slice(0,6) : e.achievements }));
    }
    if (Array.isArray(parsed.education)) {
      out.education = (out.education||[]).map((e, i) => ({ ...e, degree: parsed.education[i]?.degree || e.degree }));
    }
    // Keep skills as tokens; sanitize again
    if (Array.isArray(parsed.skills)) {
      out.skills = { ...(out.skills||{}), technical: sanitizeSkillsList(parsed.skills) };
    }
    
    logger.info("ensureTargetLanguage:success", { targetLang: lang, translated: true });
    return out;
  } catch (err: any) {
    logger.warn("ensureTargetLanguage:error", { error: err?.message, fallback: "using original profile" });
    return profile;
  }
}

async function generatePDFCV(profile: UserProfile): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { height } = page.getSize();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = height - 50;
  const margin = 50;
  const lineHeight = 20;

  page.drawText(profile.name || "Unnamed Candidate", { x: margin, y, size: 24, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
  y -= 30;

  const contact = [profile.email, profile.phone, profile.location].filter(Boolean).join(" | ");
  page.drawText(contact, { x: margin, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  y -= 30;

  if (profile.summary) {
    page.drawText("PROFESSIONAL SUMMARY", { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
    y -= lineHeight;
    const words = profile.summary.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line + word + " ";
      if (testLine.length > 80) {
        page.drawText(line.trim(), { x: margin, y, size: 10, font: helvetica });
        y -= lineHeight;
        line = word + " ";
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line.trim(), { x: margin, y, size: 10, font: helvetica });
      y -= lineHeight;
    }
    y -= 10;
  }

  if (profile.experience && profile.experience.length > 0) {
    page.drawText("EXPERIENCE", { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
    y -= lineHeight;
    for (const exp of profile.experience) {
      page.drawText(`${exp.position} | ${exp.company}`, { x: margin, y, size: 11, font: helveticaBold });
      y -= lineHeight;
      page.drawText(exp.duration || "", { x: margin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      y -= lineHeight;
      if (exp.description) {
        const descWords = exp.description.split(" ");
        let descLine = "";
        for (const word of descWords) {
          const testLine = descLine + word + " ";
          if (testLine.length > 85) {
            page.drawText(descLine.trim(), { x: margin + 10, y, size: 10, font: helvetica });
            y -= lineHeight * 0.9;
            descLine = word + " ";
          } else {
            descLine = testLine;
          }
        }
        if (descLine) {
          page.drawText(descLine.trim(), { x: margin + 10, y, size: 10, font: helvetica });
          y -= lineHeight * 0.9;
        }
      }
      y -= 10;
    }
  }

  if (profile.skills?.technical && profile.skills.technical.length > 0) {
    page.drawText("TECHNICAL SKILLS", { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
    y -= lineHeight;
    const skillsText = profile.skills.technical.join(", ");
    page.drawText(skillsText, { x: margin, y, size: 10, font: helvetica });
    y -= lineHeight * 1.5;
  }

  if (profile.education && profile.education.length > 0) {
    page.drawText("EDUCATION", { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
    y -= lineHeight;
    for (const edu of profile.education) {
      page.drawText(`${edu.degree} - ${edu.institution}`, { x: margin, y, size: 10, font: helvetica });
      y -= lineHeight * 0.9;
      if (edu.year) {
        page.drawText(edu.year, { x: margin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
        y -= lineHeight;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// Comprehensive AI-powered CV tailoring in one call
async function tailorCVWithAI(profile: UserProfile, job: JobPosting): Promise<UserProfile | null> {
  if (!config.openaiApiKey) return null;
  
  try {
    const cvData = {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedinUrl: profile.linkedinUrl,
      title: profile.title,
      summary: profile.summary,
      experience: (profile.experience || []).map(e => ({
        position: e.position,
        company: e.company,
        duration: e.duration,
        description: e.description,
        achievements: e.achievements || []
      })),
      education: (profile.education || []).map(e => ({
        degree: e.degree,
        institution: e.institution,
        year: e.year,
        gpa: e.gpa
      })),
      skills: {
        technical: profile.skills?.technical || [],
        soft: profile.skills?.soft || [],
        languages: profile.skills?.languages || [],
        certifications: profile.skills?.certifications || []
      },
      projects: profile.projects || []
    };

    const body = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert CV writer and ATS optimization specialist. Your task is to tailor a candidate's CV to perfectly match a job posting.

CRITICAL REQUIREMENTS:

1. **PROFESSIONAL SUMMARY**: Write a compelling 2-3 sentence summary that:
   - Directly addresses the target role and company
   - Highlights the candidate's most relevant experience
   - Uses keywords from the job description
   - Demonstrates clear value proposition

2. **EXPERIENCE TAILORING** (MOST IMPORTANT):
   For EACH job experience, you must:
   - Keep the company name, job title, and dates EXACTLY as provided (truthful)
   - REPHRASE all achievement bullets to mirror the job description language
   - Use the SAME terminology, keywords, and phrases from the job posting
   - Transform each bullet to highlight aspects most relevant to the target role
   - Include quantifiable metrics (numbers, percentages, scale) wherever possible
   - Use powerful action verbs: Led, Architected, Drove, Delivered, Achieved, Implemented, Optimized, Increased, Reduced, etc.
   - Make 5-6 bullets per job (more for recent roles, fewer for older ones)
   - Ensure bullets answer: "What did you do? How did you do it? What was the impact?"

3. **SKILLS**: 
   - Prioritize technical skills that match job requirements
   - Place job-required skills at the top of the list
   - Keep only relevant skills (remove unrelated ones)

4. **LANGUAGE**:
   - Everything in professional English
   - ATS-friendly (no special characters in skills)
   - Mirror the tone and terminology of the job description

EXAMPLE OF GOOD REPHRASING:
- Original: "Worked on database optimization"
- Job description mentions: "PostgreSQL performance tuning, query optimization"
- Tailored: "Optimized PostgreSQL database performance through advanced query tuning, reducing response time by 60% and improving system throughput"

Return ONLY valid JSON with this exact structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone",
  "location": "location",
  "linkedinUrl": "url",
  "title": "Professional Title (can adjust to match target role terminology)",
  "summary": "Compelling 2-3 sentence summary using job description keywords",
  "experience": [
    {
      "position": "EXACT Job Title",
      "company": "EXACT Company Name",
      "duration": "EXACT dates MM/YYYY - MM/YYYY",
      "description": "Brief role context using job description language",
      "achievements": [
        "Rephrased bullet 1 mirroring job description keywords + metrics",
        "Rephrased bullet 2 highlighting relevant skills from job posting + impact",
        "Rephrased bullet 3 using same terminology as job requirements",
        "Rephrased bullet 4 with quantified results",
        "Rephrased bullet 5 connecting experience to target role",
        "Rephrased bullet 6 if relevant to target position"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "Institution",
      "year": "Year",
      "gpa": "GPA if relevant"
    }
  ],
  "skills": {
    "technical": ["Job-required skill 1", "Job-required skill 2", "Other relevant skills..."],
    "soft": ["Leadership", "Communication", ...],
    "languages": ["English (Native)", ...],
    "certifications": ["Relevant certifications"]
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "Description rephrased to match job description language",
      "technologies": ["Tech1", "Tech2"],
      "link": "URL"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `TARGET JOB POSTING:
Company: ${job.company}
Position: ${job.position}
Description: ${job.description}
Requirements: ${(job.requirements || []).join(', ')}
Preferences: ${(job.preferences || []).join(', ')}

CANDIDATE'S CV TO TAILOR:
${JSON.stringify(cvData, null, 2)}

INSTRUCTIONS:
Tailor this CV to make it the PERFECT match for the ${job.position} role at ${job.company}. 

Key focus areas:
1. Rephrase ALL experience bullets to use the EXACT language and keywords from the job description above
2. Keep factual information (companies, dates, titles) accurate - only rephrase HOW the work is described
3. Make every bullet point clearly relevant to the target role requirements
4. Use metrics and numbers to quantify impact
5. Prioritize skills that match the job requirements

Be aggressive with rephrasing to maximize relevance while staying truthful.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    } as any;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const errorData = await r.json().catch(() => ({}));
      logger.error('tailorCVWithAI:api-error', { status: r.status, error: errorData });
      return null;
    }

    const data: any = await r.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    
    // Extract JSON from markdown code blocks if present
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const tailored = JSON.parse(jsonStr);
    
    // Construct the tailored profile
    const result: UserProfile = {
      name: String(tailored.name || profile.name),
      email: String(tailored.email || profile.email),
      phone: tailored.phone || profile.phone,
      location: tailored.location || profile.location,
      linkedinUrl: tailored.linkedinUrl || profile.linkedinUrl,
      title: String(tailored.title || profile.title),
      summary: String(tailored.summary || ''),
      experience: Array.isArray(tailored.experience) ? tailored.experience.map((e: any) => ({
        position: String(e.position || ''),
        company: String(e.company || ''),
        duration: String(e.duration || ''),
        description: String(e.description || ''),
        achievements: Array.isArray(e.achievements) ? e.achievements.map((a: any) => String(a)).slice(0, 6) : []
      })) : profile.experience,
      education: Array.isArray(tailored.education) ? tailored.education.map((e: any) => ({
        degree: String(e.degree || ''),
        institution: String(e.institution || ''),
        year: String(e.year || ''),
        gpa: e.gpa ? String(e.gpa) : undefined
      })) : profile.education,
      skills: tailored.skills ? {
        technical: Array.isArray(tailored.skills.technical) ? sanitizeSkillsList(tailored.skills.technical.map((s: any) => String(s))) : profile.skills?.technical,
        soft: Array.isArray(tailored.skills.soft) ? tailored.skills.soft.map((s: any) => String(s)).slice(0, 20) : profile.skills?.soft,
        languages: Array.isArray(tailored.skills.languages) ? sanitizeLanguageList(tailored.skills.languages.map((s: any) => String(s))) : profile.skills?.languages,
        certifications: Array.isArray(tailored.skills.certifications) ? tailored.skills.certifications.map((s: any) => String(s)).slice(0, 20) : profile.skills?.certifications
      } : profile.skills,
      projects: Array.isArray(tailored.projects) ? tailored.projects.slice(0, 10).map((p: any) => ({
        name: String(p.name || ''),
        description: String(p.description || ''),
        technologies: Array.isArray(p.technologies) ? p.technologies.map((t: any) => String(t)).slice(0, 10) : undefined,
        link: p.link ? String(p.link) : undefined
      })) : profile.projects
    };

    logger.info('tailorCVWithAI:success', { 
      experienceCount: result.experience?.length || 0,
      bulletsPerJob: result.experience?.[0]?.achievements?.length || 0
    });

    return result;
  } catch (err: any) {
    logger.error('tailorCVWithAI:error', { error: err?.message, stack: err?.stack });
    return null;
  }
}

// Translate job description to English
async function translateJobToEnglish(job: JobPosting, fromLang: string): Promise<JobPosting> {
  if (!config.openaiApiKey) return job;
  
  try {
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You translate job descriptions from ${fromLang} to English. Preserve all details, requirements, and formatting. Return ONLY a JSON object with the translated fields.`
        },
        {
          role: 'user',
          content: `Translate this job posting to English:\n\nCompany: ${job.company}\nPosition: ${job.position}\nDescription: ${job.description}\nRequirements: ${(job.requirements || []).join(', ')}\nPreferences: ${(job.preferences || []).join(', ')}\nLocation: ${job.location || 'N/A'}\nType: ${job.type || 'N/A'}\n\nReturn JSON: { "position": "...", "description": "...", "requirements": ["..."], "preferences": ["..."], "location": "...", "type": "..." }`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    } as any;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.openaiApiKey}` },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      logger.warn('translateJobToEnglish:api-error', { status: r.status });
      return job;
    }

    const data: any = await r.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    
    // Extract JSON from markdown if present
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    
    const translated = JSON.parse(jsonStr);
    
    logger.info('translateJobToEnglish:success', { from: fromLang, to: 'en' });
    
    return {
      company: job.company,
      position: translated.position || job.position,
      description: translated.description || job.description,
      requirements: Array.isArray(translated.requirements) ? translated.requirements : job.requirements,
      preferences: Array.isArray(translated.preferences) ? translated.preferences : job.preferences,
      location: translated.location || job.location,
      type: translated.type || job.type
    };
  } catch (err: any) {
    logger.warn('translateJobToEnglish:error', { error: err?.message });
    return job;
  }
}

// Ensure CV is in English
async function ensureEnglishCV(profile: UserProfile, job: JobPosting): Promise<UserProfile> {
  if (!config.openaiApiKey) {
    logger.info("ensureEnglishCV:skipped", { reason: "OpenAI API key not configured" });
    return profile;
  }
  
  logger.info("ensureEnglishCV:processing");
  
  try {
    const minimal = {
      name: profile.name,
      title: profile.title,
      summary: profile.summary,
      experience: (profile.experience||[]).map(e => ({ 
        position: e.position, 
        company: e.company, 
        duration: e.duration, 
        description: e.description,
        achievements: e.achievements||[] 
      })),
      education: (profile.education||[]).map(e => ({ degree: e.degree, institution: e.institution, year: e.year })),
      skills: profile.skills?.technical || [],
    };
    
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are a professional CV writer. Rewrite ALL text to English while keeping it professional and impactful:
- Keep technical terms in English (e.g., Python, React, AWS)
- Ensure complete, grammatical English sentences
- For experience, use powerful action verbs and quantify achievements
- Make bullet points concise and impactful (3-6 per job)
- Preserve all company names, dates, and factual information
- Do NOT invent or exaggerate - stay truthful

Return valid JSON in the same structure as input.` 
        },
        { 
          role: 'user', 
          content: `Target role: ${job.position} @ ${job.company}\nJob description: ${job.description}\n\nCV to rewrite in English:\n${JSON.stringify(minimal, null, 2)}\n\nReturn the CV in English with enhanced, impactful phrasing.` 
        },
      ],
      temperature: 0.5,
      max_tokens: 3000
    } as any;
    
    const r = await fetch('https://api.openai.com/v1/chat/completions', { 
      method: 'POST', 
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.openaiApiKey}` }, 
      body: JSON.stringify(body) 
    });
    
    if (!r.ok) {
      logger.warn("ensureEnglishCV:api-error", { status: r.status });
      return profile;
    }
    
    const data: any = await r.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    
    // Extract JSON from markdown if present
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    
    const parsed = JSON.parse(jsonStr);
    const out: UserProfile = { ...profile };
    
    if (parsed.summary) out.summary = String(parsed.summary);
    if (parsed.title) out.title = String(parsed.title);
    
    if (Array.isArray(parsed.experience)) {
      out.experience = (out.experience||[]).map((e, i) => ({ 
        ...e, 
        position: parsed.experience[i]?.position || e.position,
        description: parsed.experience[i]?.description || e.description,
        achievements: Array.isArray(parsed.experience[i]?.achievements) ? parsed.experience[i].achievements.slice(0,6) : e.achievements 
      }));
    }
    
    if (Array.isArray(parsed.education)) {
      out.education = (out.education||[]).map((e, i) => ({ 
        ...e, 
        degree: parsed.education[i]?.degree || e.degree 
      }));
    }
    
    if (Array.isArray(parsed.skills)) {
      out.skills = { ...(out.skills||{}), technical: sanitizeSkillsList(parsed.skills) };
    }
    
    logger.info("ensureEnglishCV:success");
    return out;
  } catch (err: any) {
    logger.warn("ensureEnglishCV:error", { error: err?.message });
    return profile;
  }
}

// AI-powered CV extraction for maximum detail capture
async function extractCVWithAI(text: string, detectedLang: string): Promise<UserProfile | null> {
  if (!config.openaiApiKey) return null;
  
  try {
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert CV parser. Extract EVERY SINGLE DETAIL from the CV text with extreme thoroughness.

EXTRACTION PRIORITIES:

1. **EXPERIENCE** (Most Important):
   - Extract EVERY job position separately
   - For each job, capture:
     * Exact job title
     * Exact company name
     * Complete dates (MM/YYYY - MM/YYYY or Present)
     * Detailed role description
     * ALL bullet points, achievements, and responsibilities mentioned
     * Any metrics, numbers, or quantified results
   - Don't summarize or merge - extract verbatim

2. **SUMMARY/OBJECTIVE**:
   - Extract the professional summary or career objective
   - If no explicit summary, create a brief one from the profile text

3. **SKILLS**:
   - Technical skills: programming languages, frameworks, tools, platforms
   - Soft skills: leadership, communication, teamwork, etc.
   - Languages: English (Fluent), French (Native), etc.
   - Certifications: AWS, PMP, etc.
   - Extract EVERY skill mentioned

4. **EDUCATION**:
   - All degrees, institutions, years, GPAs
   - Relevant coursework if mentioned

5. **PROJECTS**:
   - Personal projects, open source, portfolio items
   - Technologies used, links if available

6. **CONTACT INFO**:
   - Name, email, phone, location, LinkedIn, portfolio

Return ONLY valid JSON with this structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "location": "City, Country",
  "linkedinUrl": "https://linkedin.com/in/...",
  "title": "Current Job Title or Professional Title",
  "summary": "Professional summary or objective extracted from CV",
  "experience": [
    {
      "position": "Exact Job Title",
      "company": "Exact Company Name",
      "duration": "MM/YYYY - MM/YYYY or Present",
      "description": "Role description or context",
      "achievements": [
        "Every single bullet point or achievement mentioned",
        "Include all metrics and numbers exactly as stated",
        "Don't skip any accomplishments",
        "Extract 5-10 points per job if available"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree Name with Major",
      "institution": "University Name",
      "year": "YYYY",
      "gpa": "GPA if mentioned"
    }
  ],
  "skills": {
    "technical": ["Skill1", "Skill2", "Skill3", "Tool1", "Framework1", ...],
    "soft": ["Leadership", "Communication", "Problem Solving", ...],
    "languages": ["English (Native)", "French (Fluent)", ...],
    "certifications": ["Cert 1", "Cert 2", ...]
  },
  "projects": [
    {
      "name": "Project Name",
      "description": "What it does and impact",
      "technologies": ["Tech1", "Tech2"],
      "link": "URL if available"
    }
  ]
}

CRITICAL RULES:
- Extract EVERYTHING, don't summarize
- Keep experience bullets verbatim
- Don't skip any jobs, skills, or achievements
- Be exhaustively thorough`
        },
        {
          role: 'user',
          content: `Extract all information from this CV (detected language: ${detectedLang}). Be thorough and extract EVERY detail, especially from the experience section:\n\n${text}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    } as any;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      logger.warn('extractCVWithAI:api-error', { status: r.status });
      return null;
    }

    const data: any = await r.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    
    // Try to extract JSON from markdown code blocks if present
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Sanitize and validate the extracted data
    const profile: UserProfile = {
      name: String(parsed.name || ''),
      email: String(parsed.email || ''),
      phone: parsed.phone ? String(parsed.phone) : undefined,
      linkedinUrl: parsed.linkedinUrl ? String(parsed.linkedinUrl) : undefined,
      location: parsed.location ? String(parsed.location) : undefined,
      title: parsed.title ? String(parsed.title) : undefined,
      summary: parsed.summary ? String(parsed.summary) : undefined,
      experience: Array.isArray(parsed.experience) ? parsed.experience.map((e: any) => ({
        position: String(e.position || ''),
        company: String(e.company || ''),
        duration: String(e.duration || ''),
        description: String(e.description || ''),
        achievements: Array.isArray(e.achievements) ? e.achievements.map((a: any) => String(a)) : []
      })) : undefined,
      education: Array.isArray(parsed.education) ? parsed.education.map((e: any) => ({
        degree: String(e.degree || ''),
        institution: String(e.institution || ''),
        year: String(e.year || ''),
        gpa: e.gpa ? String(e.gpa) : undefined
      })) : undefined,
      skills: parsed.skills ? {
        technical: Array.isArray(parsed.skills.technical) ? sanitizeSkillsList(parsed.skills.technical.map((s: any) => String(s))) : undefined,
        soft: Array.isArray(parsed.skills.soft) ? parsed.skills.soft.map((s: any) => String(s)).slice(0, 20) : undefined,
        languages: Array.isArray(parsed.skills.languages) ? sanitizeLanguageList(parsed.skills.languages.map((s: any) => String(s))) : undefined,
        certifications: Array.isArray(parsed.skills.certifications) ? parsed.skills.certifications.map((s: any) => String(s)).slice(0, 20) : undefined
      } : undefined,
      projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, 10).map((p: any) => ({
        name: String(p.name || ''),
        description: String(p.description || ''),
        technologies: Array.isArray(p.technologies) ? p.technologies.map((t: any) => String(t)).slice(0, 10) : undefined,
        link: p.link ? String(p.link) : undefined
      })) : undefined
    };

    return profile;
  } catch (err: any) {
    logger.error('extractCVWithAI:error', { error: err?.message });
    return null;
  }
}

// ---------- Routes ----------
router.post("/parse-cv", upload.single("file"), async (req, res) => {
  try {
    const f = (req as any).file as any as { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined;
    if (!f) return res.status(400).json({ error: "file missing" });

    logger.info("docs:parse-cv:start", { filename: f.originalname, mime: f.mimetype, size: f.size });

    let text = "";
    let photoDataUrl: string | undefined;
    if (/\.docx$/i.test(f.originalname)) {
      // Convert to HTML so we can grab embedded images, then extract text for parsing
      const htmlResult = await mammoth.convertToHtml({ buffer: f.buffer }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          const b64 = await image.read("base64");
          const contentType = image.contentType || "image/png";
          const dataUrl = `data:${contentType};base64,${b64}`;
          if (!photoDataUrl) photoDataUrl = dataUrl; // take the first image as a headshot candidate
          return { src: dataUrl } as any;
        })
      } as any);
      const $ = cheerio.load(String(htmlResult.value || ""));
      text = $("body").text();
    } else if (/\.pdf$/i.test(f.originalname) || f.mimetype === "application/pdf") {
      try {
        const data = await pdfParse(f.buffer);
        text = String(data?.text || "");
        if (!text || text.trim().length === 0) {
          logger.warn("docs:parse-cv:pdf-empty-text", { filename: f.originalname });
          return res.status(400).json({ error: "PDF file appears to be empty or contains no extractable text. The PDF might be image-based or corrupted." });
        }
        // Heuristic: extract embedded image streams as headshot (prefer largest JPEG, then PNG)
        photoDataUrl = extractLargestJpegDataUrlFromPdf(f.buffer) || extractFirstPngDataUrlFromPdf(f.buffer) || photoDataUrl;
      } catch (pdfErr: any) {
        logger.error("docs:parse-cv:pdf-parse-error", { error: pdfErr?.message, filename: f.originalname });
        return res.status(400).json({ error: `Failed to parse PDF: ${pdfErr?.message || "The PDF file may be corrupted, password-protected, or in an unsupported format."}` });
      }
    } else if (/text\//.test(f.mimetype) || /\.(txt|md)$/i.test(f.originalname)) {
      text = f.buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "unsupported file format" });
    }

    // Enhanced extraction: Use AI if available for better quality
    let profile: UserProfile;
    const detected = detectLang(text);
    
    if (config.openaiApiKey && text.length > 100) {
      logger.info("parse-cv:using-ai-extraction", { textLength: text.length });
      const aiProfile = await extractCVWithAI(text, detected);
      if (aiProfile) {
        profile = aiProfile;
        logger.info("parse-cv:ai-extraction-success");
      } else {
        profile = parseTextCV(text);
        logger.info("parse-cv:ai-extraction-failed-using-fallback");
      }
    } else {
      profile = parseTextCV(text);
      logger.info("parse-cv:using-regex-extraction", { reason: config.openaiApiKey ? "text too short" : "no api key" });
    }
    
    if (photoDataUrl) profile.photoDataUrl = photoDataUrl;
    logger.info("docs:parse-cv:done", { name: profile.name, lang: detected, hasPhoto: !!photoDataUrl });
    res.json({ profile, lang: detected });
  } catch (err: any) {
    logger.error("docs:parse-cv:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to parse CV" });
  }
});

// (Figma endpoints removed)

router.post("/tailored-cv", async (req, res) => {
  try {
    const lang = "en";
    const { profile, job, format = "pdf" } = req.body as { profile: UserProfile; job: JobPosting; format?: "pdf" | "html" | "docx" };
    if (!profile || !job) return res.status(400).json({ error: "profile and job required" });

    if (!config.openaiApiKey) {
      return res.status(400).json({ error: "OpenAI API key required. Please set OPENAI_API_KEY in your .env file for AI-powered CV tailoring." });
    }

    // Detect and translate job description to English if needed
    const jobDescLang = detectLang(job.description + ' ' + (job.requirements?.join(' ') || ''));
    logger.info("tailored-cv:start", { jobDescLang, targetRole: job.position });
    
    let translatedJob = job;
    if (jobDescLang !== 'en') {
      logger.info("tailored-cv:translating-job-desc", { from: jobDescLang });
      translatedJob = await translateJobToEnglish(job, jobDescLang);
    }

    // Single comprehensive AI call to tailor the entire CV
    logger.info("tailored-cv:calling-ai", { position: translatedJob.position });
    
    const tailoredProfile = await tailorCVWithAI(profile, translatedJob);
    
    if (!tailoredProfile) {
      return res.status(500).json({ error: "Failed to tailor CV. Please try again." });
    }

    // Preserve photo
    if (profile.photoDataUrl) {
      tailoredProfile.photoDataUrl = profile.photoDataUrl;
    }

    logger.info("tailored-cv:ai-complete", { hasPhoto: !!tailoredProfile.photoDataUrl });

    // Generate clean HTML output
    const html = generateHtmlCv(tailoredProfile, translatedJob, lang);
    
    if (format === "pdf") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const puppeteer = require("puppeteer");
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBytes: Buffer = await page.pdf({ 
          printBackground: true, 
          format: 'A4',
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });
        await browser.close();
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="CV_${tailoredProfile.name.replace(/\s+/g, '_')}_${job.company}.pdf"`);
        res.send(Buffer.from(pdfBytes));
        logger.info("tailored-cv:pdf-success", { size: pdfBytes.length });
      } catch (e) {
        logger.error("tailored-cv:puppeteer-error", { error: (e as any)?.message });
        return res.status(500).json({ error: "Failed to generate PDF. Puppeteer error: " + (e as any)?.message });
      }
    } else if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      logger.info("tailored-cv:html-success");
    } else {
      // DOCX: Return HTML (basic, can be improved)
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="CV_${tailoredProfile.name.replace(/\s+/g, '_')}_${job.company}.docx"`);
      res.send(html);
      logger.info("tailored-cv:docx-success");
    }
  } catch (err: any) {
    logger.error("docs:tailored-cv:error", { error: err?.message, stack: err?.stack });
    res.status(500).json({ error: err?.message || "Failed to generate tailored CV" });
  }
});

router.post("/b2b", async (req, res) => {
  try {
    const { company, lead, context, leadDetails, lang = 'en', format = "pdf", designStyle = 'modern' } = req.body as { company: CompanyInfo; lead: any; context?: string; leadDetails?: LeadDetails; lang?: string; format?: "pdf" | "html" | "pptx"; designStyle?: string };
    if (!company || !lead) return res.status(400).json({ error: "company and lead required" });

    // Auto assets: infer logo and hero when possible
    let autoLead = { ...(leadDetails || {}) } as LeadDetails;
    const site = autoLead.website || lead?.companyWebsite || lead?.website || '';
    if (!autoLead.logoUrl && site) {
      try { const domain = new URL(site.includes('http') ? site : `https://${site}`).hostname; autoLead.logoUrl = `https://logo.clearbit.com/${domain}`; } catch {}
    }
    if (!autoLead.heroImageUrl && site) {
      try {
        const html = await httpGet(site.includes('http') ? site : `https://${site}`);
        if (html) {
          const $ = cheerio.load(html);
          const og = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
          if (og) autoLead.heroImageUrl = og;
        }
      } catch {}
    }

    // Generate highly personalized, data-rich content
    let content: any;
    let designSuggestions: any = {};
    
    if (config.openaiApiKey) {
      try {
        const body = {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are an expert B2B proposal writer. Create an EXTREMELY COMPREHENSIVE, data-rich proposal in ${lang} with EXTENSIVE content. Include: 

            1. Detailed subject line (specific pain points)
            2. Executive Summary (4-5 sentences, high-level overview)
            3. Personalized opening (3-4 paragraphs referencing their company, industry, recent news)
            4. Why We're Reaching Out (3-4 specific observations about their company)
            5. Problem Statement (5-6 paragraphs with industry statistics, trends, challenges)
            6. Industry Context (3-4 paragraphs about market conditions, competitors, opportunities)
            7. Our Solution (5-6 paragraphs with detailed explanation)
            8. How It Works (4-5 detailed implementation steps with explanations)
            9. Value Propositions (8-10 detailed benefits with specific metrics and outcomes)
            10. Proven Track Record (7-9 proof points with specific numbers, percentages, customer names)
            11. Case Study (4-5 sentences about similar company with specific results)
            12. Implementation Roadmap (4-5 phases with durations and detailed descriptions)
            13. ROI Projection (3-4 sentences with specific numbers, timeframes, calculations)
            14. Risk Mitigation (5-6 points addressing potential concerns)
            15. Why Choose Us (4-5 unique differentiators)
            16. Team & Support (2-3 sentences about who will work with them)
            17. Pricing Overview (2-3 sentences about value, not specific prices)
            18. Next Steps (3-4 specific action items with timeline)
            19. Personalized CTA (2-3 sentences mentioning their specific needs)
            20. Warm closing (2-3 sentences)
            
            Output JSON with: subject, executiveSummary, opening, personalizedInsights (array of 3-4), problemStatement, industryContext, marketTrends (array of 3-4), solution, solutionDetails (array of 4-5), valueProps (array of 8-10), proofPoints (array of 7-9), caseStudy, timeline (array of 4-5 phases with name, duration, description), roiProjection, roiBreakdown (array of 3-4 specific ROI points), riskMitigation (array of 5-6), whyChooseUs (array of 4-5), teamSupport, pricingOverview, nextSteps, cta, closing.
            
            Make it EXTREMELY detailed and comprehensive - this should be a 10+ page document worth of content!` },
            { role: 'user', content: `Design Style: ${designStyle}
Sender: ${company.name}
Industry: ${company.industry||'Technology'}
Value Prop: ${company.valueProposition||''}
Differentiators: ${(company.differentiators||[]).join(', ')}

Lead Company: ${lead.company}
Industry: ${leadDetails?.industry||''}
Person: ${lead.name||''} (${lead.title||''})
Size: ${leadDetails?.size||''}
Website: ${leadDetails?.website||''}
Context: ${context||''}
Recent News: ${(lead.companyContext?.recentNews||[]).slice(0,3).map((n:any)=>n.title).join(' | ')}

Create a HIGHLY PERSONALIZED proposal that shows deep understanding of ${lead.company}'s specific challenges in ${leadDetails?.industry||'their industry'}. Include specific metrics, timelines, and ROI projections.` },
          ],
          temperature: 0.8,
          max_tokens: 4000,
        } as any;
        const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.openaiApiKey}` }, body: JSON.stringify(body) });
        if (r.ok) {
          const data: any = await r.json();
          const raw = String(data?.choices?.[0]?.message?.content || '').trim();
          try { 
            const parsed = JSON.parse(raw);
            content = parsed;
          } catch { /* fallback below */ }
        }
      } catch {}
    }
    if (!content) {
      content = {
        subject: `Strategic Partnership Opportunity: ${company.name} × ${lead.company} - Driving ${leadDetails?.industry || 'Industry'} Excellence`,
        executiveSummary: `${company.name} is reaching out to ${lead.company} with a compelling opportunity to transform your ${leadDetails?.industry || 'business'} operations. Our proven solutions have helped similar organizations achieve 40%+ efficiency gains while reducing costs by 30%. This proposal outlines a comprehensive partnership that addresses your specific challenges and delivers measurable ROI within 90 days.`,
        opening: `Dear ${lead.name || 'Leadership Team'},\n\nI'm ${company.name}'s Partnership Director, and I'm reaching out because we've been following ${lead.company}'s impressive growth in the ${leadDetails?.industry || 'industry'}. Your recent initiatives and market position make you an ideal partner for our solutions.\n\nWe specialize in helping ${leadDetails?.size || 'mid-to-large'} companies like yours overcome the exact challenges you're facing. Our track record speaks for itself: over 500 successful implementations, 95% customer satisfaction, and an average ROI of 340% within the first year.\n\nThis proposal is specifically tailored to ${lead.company}'s unique needs and opportunities.`,
        personalizedInsights: [
          `${lead.company} operates in a rapidly evolving ${leadDetails?.industry || 'market'} where speed and efficiency are critical competitive advantages.`,
          `Your ${leadDetails?.size || 'organization'} size presents unique scaling challenges that require enterprise-grade solutions with startup agility.`,
          `Based on industry benchmarks, companies like ${lead.company} typically see 25-40% operational inefficiencies that can be optimized.`,
          `Your position in ${leadDetails?.industry || 'the market'} creates significant opportunities for technology-driven transformation.`
        ],
        problemStatement: `Organizations in the ${leadDetails?.industry || 'industry'} face unprecedented challenges in today's market. Digital transformation is no longer optional—it's essential for survival. Yet, 70% of transformation initiatives fail due to poor execution, lack of expertise, or inadequate technology.\n\n${lead.company} likely faces several critical challenges: scaling operations without proportional cost increases, maintaining quality while growing rapidly, integrating disparate systems and data sources, and staying ahead of competitors who are also investing heavily in technology.\n\nIndustry research shows that companies in your sector waste an average of 30% of their operational budget on inefficient processes. This translates to millions in lost revenue and countless hours of productivity drain. The cost of inaction is even higher—competitors who successfully transform are capturing market share at an accelerating rate.\n\nMoreover, the talent shortage in ${leadDetails?.industry || 'your industry'} means you can't simply hire your way out of these challenges. You need force multipliers—solutions that make your existing team 10x more productive.\n\nThe window of opportunity is closing. Companies that transform now will dominate their markets for the next decade. Those that delay will struggle to catch up.`,
        industryContext: `The ${leadDetails?.industry || 'industry'} landscape is undergoing massive disruption. Market leaders are investing heavily in automation, AI, and data analytics to gain competitive advantages. According to recent industry reports, the market is expected to grow by 45% over the next 3 years, creating both opportunities and threats.\n\nYour competitors are not standing still. The top performers in your sector have already implemented next-generation solutions and are seeing dramatic results. They're operating with 40% lower costs, 3x faster time-to-market, and significantly higher customer satisfaction scores.\n\nRegulatory changes and customer expectations are also evolving rapidly. Companies that can't adapt quickly will lose market position. The good news? ${lead.company} is well-positioned to lead this transformation with the right partner.`,
        marketTrends: [
          `Digital-first operations: 85% of ${leadDetails?.industry || 'industry'} leaders are prioritizing digital transformation in 2024-2025`,
          `AI and automation adoption: Companies using AI report 35% higher productivity and 28% cost reduction`,
          `Customer experience focus: 73% of customers will switch providers for better digital experiences`,
          `Data-driven decision making: Organizations leveraging analytics are 5x more likely to make faster, better decisions`
        ],
        solution: `${company.name} offers a comprehensive, battle-tested solution specifically designed for ${leadDetails?.industry || 'your industry'}. Unlike generic platforms, our approach is tailored to your unique challenges and opportunities.\n\nOur solution combines cutting-edge technology with deep industry expertise. We've spent years perfecting our methodology with companies just like ${lead.company}, learning what works and what doesn't. The result is a proven framework that delivers results fast.\n\nWhat makes us different? We don't just provide software—we provide a complete transformation partner. Our team becomes an extension of yours, working alongside you to ensure success. We bring not just technology, but strategy, implementation expertise, training, and ongoing support.\n\nOur platform integrates seamlessly with your existing systems, eliminating the need for costly rip-and-replace projects. We can have you up and running in weeks, not months, with immediate value delivery.\n\nThe solution is built on three pillars: intelligent automation that handles repetitive tasks, advanced analytics that provide actionable insights, and seamless integration that connects all your systems into a unified ecosystem.`,
        solutionDetails: [
          `Phase 1 - Discovery & Planning (Week 1-2): We conduct a comprehensive assessment of your current state, identify quick wins, and create a detailed roadmap. Our team works closely with your stakeholders to ensure alignment and buy-in.`,
          `Phase 2 - Foundation Setup (Week 3-4): We configure the platform to your specific needs, integrate with your existing systems, and set up the core infrastructure. This phase includes data migration and security configuration.`,
          `Phase 3 - Pilot Launch (Week 5-6): We launch a pilot with a selected team or department, gather feedback, and refine the implementation. This de-risks the full rollout and builds internal champions.`,
          `Phase 4 - Full Deployment (Week 7-10): We roll out to the entire organization in phases, providing hands-on training and support. Our team is on-site or available remotely to ensure smooth adoption.`,
          `Phase 5 - Optimization & Scale (Week 11+): We continuously monitor performance, identify optimization opportunities, and help you scale usage across the organization. This is where the real ROI multiplies.`
        ],
        valueProps: [
          `40% Operational Efficiency Gain: Automate repetitive tasks and streamline workflows, freeing your team to focus on high-value activities. Typical customers save 15-20 hours per employee per week.`,
          `30% Cost Reduction: Eliminate waste, optimize resource allocation, and reduce manual errors. Most clients see full ROI within 6-9 months.`,
          `3x Faster Time-to-Market: Accelerate your product development and go-to-market cycles with streamlined processes and better collaboration tools.`,
          `95% Customer Satisfaction: Deliver exceptional experiences that keep customers coming back. Our clients report 25-point NPS improvements on average.`,
          `Real-Time Insights: Make data-driven decisions with confidence using our advanced analytics and reporting capabilities. See what's working and what's not in real-time.`,
          `Seamless Integration: Connect all your systems and data sources into a unified platform. No more data silos or manual data entry.`,
          `Enterprise Security: Bank-grade security with SOC2, ISO 27001, and GDPR compliance. Your data is protected with military-grade encryption.`,
          `24/7 Support: Our dedicated support team is available around the clock to help you succeed. Average response time under 2 hours.`,
          `Continuous Innovation: Regular updates and new features at no additional cost. You'll always have access to the latest capabilities.`,
          `Proven Track Record: 500+ successful implementations, 95% customer retention rate, and an average ROI of 340% in year one.`
        ],
        proofPoints: [
          `500+ successful implementations across ${leadDetails?.industry || 'multiple industries'} with 98% on-time delivery rate`,
          `95% customer satisfaction score and 92% would recommend us to peers`,
          `Average 340% ROI in first year, with some clients achieving 500%+ returns`,
          `40% average reduction in operational costs within 90 days of implementation`,
          `3x improvement in team productivity measured across all customer deployments`,
          `99.99% uptime SLA with zero major security incidents in our history`,
          `$50M+ in documented cost savings delivered to customers in the past year`,
          `25-point average NPS improvement for our customers' end users`,
          `85% of customers expand their usage within 12 months due to proven value`
        ],
        caseStudy: `A leading ${leadDetails?.industry || 'industry'} company similar to ${lead.company} partnered with us 18 months ago facing similar challenges. They were struggling with manual processes, data silos, and scaling issues. Within 90 days of implementation, they achieved a 45% reduction in operational costs and 3.5x improvement in team productivity. By month 6, they had fully recouped their investment and were seeing 400%+ ROI. Today, they're industry leaders in efficiency and have expanded our partnership to additional departments. Their CEO credits our solution as "the catalyst that transformed our business."`,
        timeline: [
          { name: 'Discovery & Planning', duration: '2 weeks', description: 'Comprehensive assessment, stakeholder interviews, roadmap creation, and quick-win identification. We ensure complete alignment before moving forward.' },
          { name: 'Foundation & Integration', duration: '2 weeks', description: 'Platform configuration, system integration, data migration, and security setup. We handle all technical heavy lifting while you focus on your business.' },
          { name: 'Pilot Launch', duration: '2 weeks', description: 'Controlled rollout to pilot group, feedback collection, refinement, and internal champion development. This de-risks the full deployment.' },
          { name: 'Full Deployment', duration: '4 weeks', description: 'Organization-wide rollout with comprehensive training, change management, and hands-on support. We ensure every user is confident and capable.' },
          { name: 'Optimization & Growth', duration: 'Ongoing', description: 'Continuous monitoring, optimization, feature adoption, and scaling support. This is where ROI multiplies as usage deepens.' }
        ],
        roiProjection: `Based on ${lead.company}'s profile and our experience with similar organizations, we project a conservative ROI of 280-350% in the first year. This translates to approximately $2.8-3.5M in value for every $1M invested. Most of this value comes from operational efficiency gains (40%), cost reductions (30%), and revenue acceleration (30%). Payback period is typically 6-9 months, with value accelerating significantly in years 2 and 3 as adoption deepens.`,
        roiBreakdown: [
          `Operational Efficiency: $400K-500K annual savings from automation and streamlined workflows (15-20 hours saved per employee per week)`,
          `Cost Reduction: $300K-400K annual savings from reduced errors, waste elimination, and resource optimization`,
          `Revenue Acceleration: $250K-350K additional revenue from faster time-to-market and improved customer satisfaction`,
          `Risk Mitigation: $150K-200K in avoided costs from better compliance, security, and reduced downtime`
        ],
        riskMitigation: [
          `Proven Implementation Methodology: Our battle-tested approach has a 98% success rate. We know what works and what doesn't, eliminating guesswork.`,
          `Dedicated Success Team: You'll have a dedicated Customer Success Manager and technical team ensuring your success from day one.`,
          `Flexible Engagement Model: Start small with a pilot, prove value, then scale. No big-bang risky deployments required.`,
          `Money-Back Guarantee: If you don't see measurable value within 90 days, we'll refund your investment. We're that confident.`,
          `Change Management Support: We provide comprehensive training and change management to ensure user adoption and minimize disruption.`,
          `24/7 Technical Support: Our support team is available around the clock to resolve any issues quickly and keep you running smoothly.`
        ],
        whyChooseUs: [
          `Industry Expertise: We've worked with 50+ companies in ${leadDetails?.industry || 'your industry'}, so we understand your unique challenges intimately.`,
          `Proven Track Record: 500+ successful implementations, 95% customer retention, and industry-leading satisfaction scores speak for themselves.`,
          `Speed to Value: Unlike competitors who take 6-12 months, we deliver measurable results within 90 days with our rapid implementation approach.`,
          `Complete Partnership: We're not just a vendor—we're your long-term partner invested in your success. Your success is our success.`,
          `Innovation Leadership: We invest 25% of revenue in R&D, ensuring you always have access to cutting-edge capabilities and stay ahead of competitors.`
        ],
        teamSupport: `Your dedicated team will include a Customer Success Manager (your main point of contact), a Technical Architect (ensures seamless integration), an Implementation Specialist (handles deployment), and a Training Coordinator (ensures user adoption). You'll also have access to our executive team for strategic guidance. This isn't outsourced support—these are senior professionals dedicated to your success.`,
        pricingOverview: `Our pricing is designed to align with your success. We offer flexible models including subscription-based pricing that scales with usage, outcome-based pricing where you pay based on results achieved, and enterprise licensing for predictable budgeting. Most clients in your segment invest $150K-300K annually and see 3-5x returns. We're happy to discuss specific pricing tailored to ${lead.company}'s needs and budget.`,
        nextSteps: `1. Schedule a 30-minute discovery call this week to discuss your specific needs and answer questions\n2. Conduct a complimentary assessment of your current state and identify quick wins (Week 2)\n3. Present a detailed proposal with specific ROI projections for ${lead.company} (Week 3)\n4. If aligned, begin pilot implementation within 2 weeks of agreement`,
        cta: `${lead.name || 'Team'}, the opportunity to transform ${lead.company} is here. Companies that act now will dominate their markets for the next decade. Those that delay will struggle to catch up.\n\nLet's schedule a brief call this week to explore how we can help ${lead.company} achieve breakthrough results. I'm confident we can deliver exceptional value.`,
        closing: `Thank you for considering ${company.name} as your transformation partner. We're excited about the possibility of working with ${lead.company} and helping you achieve your ambitious goals.\n\nI look forward to our conversation.\n\nBest regards,\n${company.name} Partnership Team`
      };
    }

    // Define distinct design styles (used for both HTML and PDF)
    const styles: Record<string, any> = {
        'modern': {
          primaryColor: '#0d6efd',
          secondaryColor: '#6c757d',
          bgColor: '#ffffff',
          accentBg: '#f8f9fa',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          heroHeight: '450px',
          borderRadius: '12px',
        },
        'modern-b2b': {
          primaryColor: '#1a1a2e',
          secondaryColor: '#16213e',
          bgColor: '#f5f5f5',
          accentBg: '#0f3460',
          fontFamily: 'Georgia, "Times New Roman", serif',
          heroHeight: '500px',
          borderRadius: '0px',
        },
        'creative': {
          primaryColor: '#ff6b6b',
          secondaryColor: '#4ecdc4',
          bgColor: '#ffe66d',
          accentBg: '#fff',
          fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif',
          heroHeight: '400px',
          borderRadius: '24px',
        },
        'minimal': {
          primaryColor: '#2d3436',
          secondaryColor: '#636e72',
          bgColor: '#ffffff',
          accentBg: '#f8f9fa',
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          heroHeight: '350px',
          borderRadius: '4px',
        },
        'tech': {
          primaryColor: '#00d2ff',
          secondaryColor: '#3a7bd5',
          bgColor: '#0a0e27',
          accentBg: '#1a1f3a',
          fontFamily: '"Courier New", Courier, monospace',
          heroHeight: '480px',
          borderRadius: '8px',
        },
      };
      
      const style = styles[designStyle] || styles['modern'];
      const accentColor = autoLead.brandColor || style.primaryColor;
      const logo = autoLead.logoUrl ? `<img src="${autoLead.logoUrl}" alt="logo" style="height:48px;object-fit:contain"/>` : '';
      
      // Generate personalized images: 50% company photos, 50% free stock images
      const timestamp = Date.now();
      const leadIndustryKey = (leadDetails?.industry || 'business').toLowerCase().replace(/\s+/g, '-');
      const companyIndustryKey = (company.industry || 'technology').toLowerCase().replace(/\s+/g, '-');
      const leadCompanyKey = (lead.company || 'company').toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Hero image: Use stock image only
      const hero = `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&h=600&fit=crop&q=80&sig=${timestamp}`;
      
      // Expanded stock images library - 16 unique images per industry
      const industryImageSets: Record<string, string[]> = {
        technology: [
          '1551434678-e076c223a692', '1553877522-43269d4ea984', '1518770660439-4636190af475', '1519389950473-47ba0277781c',
          '1504384308090-c894fdcc538d', '1487058792252-ba3c7b6c8a5c', '1531297484001-80022131f5a1', '1460925895917-afdab827c52f',
          '1573164713988-8665fc963095', '1550751827-4bd374c3f58b', '1563986768494-4dee2763ff3f', '1526374965192-274f00b7ef54',
          '1517245386807-bb43f82c33c4', '1581092795360-fd1ca04f0952', '1581092160607-ee22f93dfe51', '1581092918484-8d2f9a8c4e8e'
        ],
        finance: [
          '1454165804606-c3d57bc86b40', '1460925895917-afdab827c52f', '1579621970563-ebec7560ff3e', '1563013544-824ae1b704d3',
          '1559526324-4b87b5e36e44', '1554224311-beee460ae6a7', '1590283603385-d88c101a6ea1', '1554224311-9e5f0f8e8f8f',
          '1611974789855-9c2a0a7236a3', '1579532537598-459ecdaf39cc', '1579532537598-459ecdaf39cc', '1579532537598-459ecdaf39cc',
          '1554224311-9e5f0f8e8f8f', '1590283603385-d88c101a6ea1', '1559526324-4b87b5e36e44', '1563013544-824ae1b704d3'
        ],
        healthcare: [
          '1576091160399-112ba8d25d1d', '1584820927498-cfe5211fd8bf', '1582719508461-905c673771fd', '1516841273335-e39f6c0e3e4e',
          '1579684385418-be1e8f2e5f8e', '1538108149393-fbbd81895907', '1579684453423-f84349ef60b0', '1579684385418-be1e8f2e5f8e',
          '1631815589968-fdb09a223b1e', '1579684385418-be1e8f2e5f8e', '1538108149393-fbbd81895907', '1579684453423-f84349ef60b0',
          '1631815589968-fdb09a223b1e', '1576091160399-112ba8d25d1d', '1584820927498-cfe5211fd8bf', '1582719508461-905c673771fd'
        ],
        retail: [
          '1441986300917-64674bd600d8', '1556742111-a301076d9d18', '1607082348824-0a96f2a4b9da', '1472851294608-062f824d29cc',
          '1534452203-72f5a0a5d0e7', '1441984904996-e0b6ba687e04', '1604719312566-469b72f93f17', '1607082349566-187870c2bab0',
          '1607082348824-0a96f2a4b9da', '1534452203-72f5a0a5d0e7', '1441984904996-e0b6ba687e04', '1604719312566-469b72f93f17',
          '1607082349566-187870c2bab0', '1441986300917-64674bd600d8', '1556742111-a301076d9d18', '1472851294608-062f824d29cc'
        ],
        manufacturing: [
          '1581091226825-a6a2a5aee158', '1565043589221-1a6fd9ae45c7', '1581092160607-ee22f93dfe51', '1504328345606-18bbc8c9d7d1',
          '1587293852726-70cdb56c2866', '1581092795360-fd1ca04f0952', '1581092918484-8d2f9a8c4e8e', '1581092160607-ee22f93dfe51',
          '1587293852726-70cdb56c2866', '1581091226825-a6a2a5aee158', '1565043589221-1a6fd9ae45c7', '1504328345606-18bbc8c9d7d1',
          '1581092795360-fd1ca04f0952', '1581092918484-8d2f9a8c4e8e', '1587293852726-70cdb56c2866', '1581091226825-a6a2a5aee158'
        ],
        default: [
          '1486406146926-c627a92ad1ab', '1497366216548-37526070297c', '1497366811353-6870744d04b2', '1522071820081-009f0129c71c',
          '1552664730-d307ca884978', '1556761175-b413da4baf72', '1507679799987-c73779587ccf', '1454165804606-c3d57bc86b40',
          '1551434678-e076c223a692', '1504384308090-c894fdcc538d', '1487058792252-ba3c7b6c8a5c', '1531297484001-80022131f5a1',
          '1460925895917-afdab827c52f', '1573164713988-8665fc963095', '1550751827-4bd374c3f58b', '1563986768494-4dee2763ff3f'
        ]
      };
      
      const getIndustryImages = (industry: string) => {
        const key = Object.keys(industryImageSets).find(k => industry.includes(k)) || 'default';
        return industryImageSets[key];
      };
      
      const leadImages = getIndustryImages(leadIndustryKey);
      const companyImages = getIndustryImages(companyIndustryKey);
      
      // Use timestamp to create truly random selection each time
      const seed = timestamp + Math.floor(Math.random() * 1000);
      const randomOffset = seed % 8; // Offset to start from different position each time
      
      // Use ONLY stock images - 8 UNIQUE high-quality images with random selection
      const sectionImages = [
        `https://images.unsplash.com/photo-${leadImages[randomOffset % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${leadImages[(randomOffset + 2) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${companyImages[(randomOffset + 4) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${companyImages[(randomOffset + 6) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${leadImages[(randomOffset + 8) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${leadImages[(randomOffset + 10) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${companyImages[(randomOffset + 12) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
        `https://images.unsplash.com/photo-${companyImages[(randomOffset + 14) % 16]}?w=900&h=500&fit=crop&q=80&t=${seed}`,
      ];

      const textColor = designStyle === 'tech' ? '#e0e0e0' : '#1a1a1a';
      const cardBg = designStyle === 'tech' ? style.accentBg : 'white';
      
      // Define different layouts for each style
      const useModernLayout = designStyle === 'modern' || designStyle === '';
      const useExecutiveLayout = designStyle === 'modern-b2b';
      const useCreativeLayout = designStyle === 'creative';
      const useMinimalLayout = designStyle === 'minimal';
      const useTechLayout = designStyle === 'tech';
      
      // Generate gradient backgrounds based on style
      const gradients: Record<string, string> = {
        modern: `linear-gradient(135deg, ${accentColor}15, ${style.secondaryColor}10)`,
        'modern-b2b': `linear-gradient(180deg, ${style.primaryColor}08, ${style.secondaryColor}05)`,
        creative: `linear-gradient(45deg, ${style.primaryColor}20, ${style.secondaryColor}20)`,
        minimal: `linear-gradient(to bottom, ${style.bgColor}, ${style.accentBg})`,
        tech: `linear-gradient(135deg, ${style.primaryColor}15, ${style.secondaryColor}20)`,
      };
      
      const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(company.name)} → ${escapeHtml(lead.company)} | Personalized Proposal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
  <style>
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(50px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Inter', ${style.fontFamily};
      background: ${gradients[designStyle] || gradients.modern};
      color: ${textColor};
      line-height: 1.7;
      overflow-x: hidden;
    }
    
    .page { 
      max-width: ${useExecutiveLayout ? '1200px' : useMinimalLayout ? '900px' : useCreativeLayout ? '1000px' : '1100px'}; 
      margin: 0 auto; 
      background: ${cardBg}; 
      box-shadow: ${useMinimalLayout ? '0 10px 40px rgba(0,0,0,0.08)' : useCreativeLayout ? '0 40px 120px rgba(0,0,0,0.25)' : '0 30px 90px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.1)'};
      position: relative;
      overflow: hidden;
      ${useCreativeLayout ? 'border-radius: 32px; margin-top: 40px; margin-bottom: 40px;' : ''}
    }
    
    .page::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 200%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      animation: shimmer 3s infinite;
      pointer-events: none;
    }
    .hero { 
      position: relative; 
      height: ${style.heroHeight}; 
      background: linear-gradient(135deg, ${accentColor}dd, ${accentColor}99), url('${hero}') center/cover;
      background-attachment: fixed;
      background-size: cover;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
      padding: 60px 40px;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 30% 50%, ${accentColor}40, transparent 70%);
      animation: pulse 4s ease-in-out infinite;
    }
    .hero-content { 
      position: relative; 
      z-index: 2; 
      animation: fadeInUp 1s ease-out;
    }
    .hero h1 { 
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 56px; 
      font-weight: 900; 
      margin-bottom: 24px; 
      text-shadow: 0 4px 30px rgba(0,0,0,0.5); 
      letter-spacing: -2px;
      background: linear-gradient(135deg, #fff, rgba(255,255,255,0.8));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero .subtitle { 
      font-size: 24px; 
      opacity: 0.95; 
      font-weight: 300; 
      animation: slideInRight 1s ease-out 0.3s both;
    }
    .hero .date { 
      font-size: 14px; 
      opacity: 0.8; 
      margin-top: 16px;
      padding: 8px 20px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      display: inline-block;
      animation: scaleIn 0.6s ease-out 0.6s both;
    }
    .header-bar { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 32px 60px; 
      background: ${cardBg};
      border-bottom: 4px solid ${accentColor};
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
    }
    .section { 
      padding: ${useMinimalLayout ? '60px 40px' : useCreativeLayout ? '100px 80px' : '80px 60px'}; 
      animation: fadeInUp 0.8s ease-out;
      position: relative;
      ${useExecutiveLayout ? 'border-bottom: 1px solid #e0e0e0;' : ''}
      ${useCreativeLayout ? 'margin: 20px 0; border-radius: 24px;' : ''}
      ${useTechLayout ? 'border-left: 3px solid ' + accentColor + ';' : ''}
    }
    .section:nth-child(even) { 
      background: ${useCreativeLayout ? 'white' : style.accentBg}; 
    }
    .section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: ${useExecutiveLayout ? '8px' : useMinimalLayout ? '2px' : '4px'};
      height: 100%;
      background: ${useExecutiveLayout ? style.primaryColor : `linear-gradient(to bottom, ${accentColor}, transparent)`};
      ${useCreativeLayout || useMinimalLayout ? 'display: none;' : ''}
    }
    .section h2 { 
      font-size: 40px; 
      color: ${accentColor}; 
      margin-bottom: 28px;
      position: relative;
      padding-bottom: 18px;
      font-weight: 700;
    }
    .section h2:after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 80px;
      height: 5px;
      background: ${accentColor};
      border-radius: ${style.borderRadius};
    }
    .section h3 { font-size: 28px; color: ${style.secondaryColor}; margin: 32px 0 16px 0; }
    .section p { font-size: 19px; margin: 18px 0; color: ${textColor}; line-height: 1.8; }
    .section ul { margin: 20px 0; padding-left: 30px; }
    .section li { margin: 12px 0; font-size: 18px; }
    .benefits, .proof, .timeline-grid { 
      display: ${useMinimalLayout ? 'flex' : 'grid'}; 
      ${useMinimalLayout ? 'flex-direction: column;' : ''}
      grid-template-columns: ${useExecutiveLayout ? '1fr' : useCreativeLayout ? 'repeat(auto-fit, minmax(280px, 1fr))' : 'repeat(auto-fit, minmax(300px, 1fr))'}; 
      gap: ${useCreativeLayout ? '40px' : useMinimalLayout ? '20px' : '28px'}; 
      margin: 40px 0;
    }
    .benefit-card, .proof-card, .timeline-card {
      background: ${cardBg};
      padding: ${useMinimalLayout ? '24px' : useCreativeLayout ? '48px' : '36px'};
      border-radius: ${style.borderRadius};
      box-shadow: ${useMinimalLayout ? '0 2px 8px rgba(0,0,0,0.06)' : useExecutiveLayout ? 'none' : useCreativeLayout ? '0 12px 40px rgba(0,0,0,0.15)' : '0 8px 24px rgba(0,0,0,0.12)'};
      border-left: ${useExecutiveLayout ? 'none' : useCreativeLayout ? '8px solid ' + accentColor : '6px solid ' + accentColor};
      ${useExecutiveLayout ? 'border-top: 4px solid ' + accentColor + ';' : ''}
      ${useMinimalLayout ? 'border: 1px solid #e0e0e0;' : ''}
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      position: relative;
      overflow: hidden;
      animation: scaleIn 0.6s ease-out;
    }
    .benefit-card::before, .proof-card::before, .timeline-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, ${accentColor}10, transparent);
      opacity: 0;
      transition: opacity 0.4s;
    }
    .benefit-card:hover::before, .proof-card:hover::before, .timeline-card:hover::before {
      opacity: 1;
    }
    .benefit-card:hover, .proof-card:hover, .timeline-card:hover { 
      transform: translateY(-10px) scale(1.02); 
      box-shadow: 0 20px 50px rgba(0,0,0,0.2);
      border-left-width: 8px;
    }
    .benefit-card h3, .proof-card h3, .timeline-card h3 { 
      color: ${accentColor}; 
      margin-bottom: 16px; 
      font-size: 24px; 
      font-weight: 700;
      position: relative;
      z-index: 1;
    }
    .benefit-card h3::before, .proof-card h3::before, .timeline-card h3::before {
      content: '→';
      margin-right: 12px;
      opacity: 0;
      transform: translateX(-10px);
      transition: all 0.3s;
      display: inline-block;
    }
    .benefit-card:hover h3::before, .proof-card:hover h3::before, .timeline-card:hover h3::before {
      opacity: 1;
      transform: translateX(0);
    }
    .benefit-card p, .proof-card p, .timeline-card p { 
      font-size: 17px; 
      line-height: 1.8; 
      position: relative;
      z-index: 1;
    }
    .section-image { 
      width: 100%; 
      height: 400px; 
      object-fit: cover; 
      border-radius: ${style.borderRadius}; 
      margin: 40px 0;
      box-shadow: 0 15px 50px rgba(0,0,0,0.2);
      transition: all 0.5s ease;
      animation: fadeInUp 0.8s ease-out;
      position: relative;
    }
    .section-image:hover {
      transform: scale(1.02);
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .cta-section { 
      background: linear-gradient(135deg, ${accentColor}, ${style.secondaryColor});
      color: white;
      text-align: center;
      padding: 90px 60px;
    }
    .cta-section h2 { color: white; }
    .cta-section h2:after { background: white; }
    .btn {
      display: inline-block;
      background: white;
      color: ${accentColor};
      padding: 20px 56px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 800;
      font-size: 20px;
      margin-top: 32px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      position: relative;
      overflow: hidden;
      z-index: 1;
    }
    .btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: ${accentColor}20;
      transition: width 0.6s, height 0.6s, top 0.6s, left 0.6s;
      transform: translate(-50%, -50%);
      z-index: -1;
    }
    .btn:hover::before {
      width: 300px;
      height: 300px;
    }
    .btn:hover { 
      transform: scale(1.1) translateY(-3px); 
      box-shadow: 0 15px 40px rgba(0,0,0,0.4);
      letter-spacing: 1px;
    }
    .footer { 
      padding: 60px 60px; 
      background: linear-gradient(135deg, ${style.secondaryColor}, ${style.primaryColor}); 
      color: rgba(255,255,255,0.9); 
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .footer::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 50px 50px;
      animation: float 20s linear infinite;
    }
    .stats { 
      display: flex; 
      justify-content: space-around; 
      margin: 60px 0;
      text-align: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    .stat { 
      padding: 30px; 
      min-width: 220px;
      background: ${cardBg};
      border-radius: ${style.borderRadius};
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      transition: all 0.4s;
      animation: scaleIn 0.6s ease-out;
      position: relative;
      overflow: hidden;
    }
    .stat::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, ${accentColor}, ${style.secondaryColor});
    }
    .stat:hover {
      transform: translateY(-8px) scale(1.05);
      box-shadow: 0 15px 40px rgba(0,0,0,0.2);
    }
    .stat-number { 
      font-size: 64px; 
      font-weight: 900; 
      color: ${accentColor};
      background: linear-gradient(135deg, ${accentColor}, ${style.secondaryColor});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: pulse 2s ease-in-out infinite;
    }
    .stat-label { 
      font-size: 18px; 
      color: ${textColor}; 
      margin-top: 12px; 
      opacity: 0.85;
      font-weight: 500;
    }
    .insight-box { 
      background: linear-gradient(135deg, ${style.accentBg}, ${cardBg}); 
      padding: 36px; 
      border-left: 6px solid ${style.secondaryColor}; 
      margin: 36px 0; 
      border-radius: ${style.borderRadius};
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      transition: all 0.3s;
      animation: slideInRight 0.8s ease-out;
    }
    .insight-box:hover {
      transform: translateX(8px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
    }
    .insight-box h4 { 
      color: ${style.secondaryColor}; 
      margin-bottom: 14px; 
      font-size: 22px;
      font-weight: 700;
    }
    .case-study { 
      background: linear-gradient(135deg, ${style.accentBg}, ${cardBg}); 
      padding: 48px; 
      border-radius: ${style.borderRadius}; 
      margin: 48px 0;
      border: 3px solid ${accentColor};
      box-shadow: 0 12px 40px rgba(0,0,0,0.15);
      position: relative;
      overflow: hidden;
      animation: fadeInUp 0.8s ease-out;
    }
    .case-study::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background: linear-gradient(45deg, ${accentColor}, ${style.secondaryColor}, ${accentColor});
      background-size: 400%;
      border-radius: ${style.borderRadius};
      z-index: -1;
      animation: shimmer 3s ease infinite;
    }
    
    /* Progress bars for visual interest */
    .progress-bar {
      width: 100%;
      height: 8px;
      background: ${style.accentBg};
      border-radius: 10px;
      overflow: hidden;
      margin: 16px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, ${accentColor}, ${style.secondaryColor});
      border-radius: 10px;
      animation: fillProgress 2s ease-out;
    }
    @keyframes fillProgress {
      from { width: 0; }
      to { width: 100%; }
    }
    
    /* Decorative elements */
    .decorative-circle {
      position: absolute;
      border-radius: 50%;
      background: ${accentColor}15;
      animation: float 6s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header-bar">
      <div style="font-size: 24px; font-weight: 600; color: ${accentColor};">${escapeHtml(company.name)}</div>
      ${logo}
    </div>
    
    <div class="hero">
      <div class="hero-content">
        <h1>${escapeHtml(content.subject || `Partnership Opportunity: ${company.name} × ${lead.company}`)}</h1>
        <div class="subtitle">Personalized Proposal for ${escapeHtml(lead.company)}</div>
        <div class="date">Prepared: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>

    ${content.executiveSummary ? `
    <div class="section">
      <h2>Executive Summary</h2>
      ${String(content.executiveSummary).split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}
    </div>` : ''}

    ${(content.personalizedInsights||[]).length ? `
    <div class="section">
      <h2>Why We're Reaching Out to ${escapeHtml(lead.company)}</h2>
      ${(content.personalizedInsights||[]).map((insight:string)=>`
        <div class="insight-box">
          <h4>💡 Insight</h4>
          <p>${escapeHtml(insight)}</p>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="section">
      <h2>Introduction</h2>
      ${String(content.opening||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}
    </div>

    ${content.problemStatement || content.problem ? `
    <div class="section">
      <h2>The Challenge Facing ${escapeHtml(lead.company)}</h2>
      <img src="${sectionImages[0]}" alt="challenge" class="section-image"/>
      ${String(content.problemStatement || content.problem).split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}
      
      ${content.industryContext ? `
        <h3>Industry Context & Market Dynamics</h3>
        ${String(content.industryContext).split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}
      ` : ''}
      
      ${(content.marketTrends||[]).length ? `
        <h3>Key Market Trends</h3>
        <ul>
          ${(content.marketTrends||[]).map((trend:string)=>`<li><strong>Trend:</strong> ${escapeHtml(trend)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>` : ''}

    <div class="section">
      <h2>Our Solution for ${escapeHtml(lead.company)}</h2>
      <img src="${sectionImages[1]}" alt="solution" class="section-image"/>
      ${String(content.solution||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}
      
      ${(content.solutionDetails||[]).length ? `
        <h3>How It Works</h3>
        ${(content.solutionDetails||[]).map((detail:string,i:number)=>`
          <div style="margin: 24px 0;">
            <h4 style="color: ${accentColor}; font-size: 20px; margin-bottom: 8px;">Step ${i+1}</h4>
            <p>${escapeHtml(detail)}</p>
          </div>
        `).join('')}
      ` : ''}
    </div>

    ${(content.valueProps||[]).length ? `
    <div class="section">
      <h2>Value Delivered to ${escapeHtml(lead.company)}</h2>
      <div class="benefits">
        ${(content.valueProps||[]).map((v:string,i:number)=>`
          <div class="benefit-card">
            <h3>✓ ${i+1}. Key Benefit</h3>
            <p>${escapeHtml(v)}</p>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${(content.proofPoints||[]).length ? `
    <div class="section">
      <h2>Proven Track Record</h2>
      <div class="stats">
        ${(content.proofPoints||[]).slice(0,4).map((p:string)=>{
          const match = String(p).match(/(\d+[%+]?)/);
          const num = match ? match[1] : '✓';
          const text = String(p).replace(/(\d+[%+]?)/g, '').trim();
          return `<div class="stat"><div class="stat-number">${num}</div><div class="stat-label">${escapeHtml(text)}</div></div>`;
        }).join('')}
      </div>
      <img src="${sectionImages[2]}" alt="results" class="section-image"/>
    </div>` : ''}

    ${content.caseStudy ? `
    <div class="section">
      <h2>Success Story: Similar Company</h2>
      <div class="case-study">
        <h3 style="color: ${accentColor}; margin-bottom: 16px;">📊 Case Study</h3>
        <p>${escapeHtml(content.caseStudy)}</p>
      </div>
      <img src="${sectionImages[3]}" alt="case study" class="section-image"/>
    </div>` : ''}

    ${(content.timeline||[]).length ? `
    <div class="section">
      <h2>Implementation Roadmap</h2>
      <div class="timeline-grid">
        ${(content.timeline||[]).map((phase:any,i:number)=>`
          <div class="timeline-card">
            <h3>Phase ${i+1}: ${escapeHtml(phase.name || phase.title || 'Implementation')}</h3>
            <p><strong>Duration:</strong> ${escapeHtml(phase.duration || '2-4 weeks')}</p>
            <p>${escapeHtml(phase.description || phase)}</p>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${content.roiProjection ? `
    <div class="section">
      <h2>Expected ROI for ${escapeHtml(lead.company)}</h2>
      <div class="insight-box" style="background: linear-gradient(135deg, ${accentColor}22, ${style.accentBg});">
        <h4 style="font-size: 24px; color: ${accentColor};">💰 Return on Investment</h4>
        <p style="font-size: 19px;">${escapeHtml(content.roiProjection)}</p>
      </div>
      <img src="${sectionImages[4]}" alt="ROI projection" class="section-image"/>
    </div>` : ''}

    ${content.roiProjection && (content.roiBreakdown||[]).length ? `
    <div class="section">
      <h2>Expected ROI for ${escapeHtml(lead.company)}</h2>
      <div class="insight-box" style="background: linear-gradient(135deg, ${accentColor}22, ${style.accentBg});">
        <h4 style="font-size: 24px; color: ${accentColor};">💰 Return on Investment</h4>
        <p style="font-size: 19px;">${escapeHtml(content.roiProjection)}</p>
      </div>
      <h3>ROI Breakdown</h3>
      <div class="benefits">
        ${(content.roiBreakdown||[]).map((roi:string,i:number)=>`
          <div class="benefit-card">
            <h3>📊 ROI Factor ${i+1}</h3>
            <p>${escapeHtml(roi)}</p>
          </div>
        `).join('')}
      </div>
      <img src="${sectionImages[4]}" alt="ROI projection" class="section-image"/>
    </div>` : content.roiProjection ? `
    <div class="section">
      <h2>Expected ROI for ${escapeHtml(lead.company)}</h2>
      <div class="insight-box" style="background: linear-gradient(135deg, ${accentColor}22, ${style.accentBg});">
        <h4 style="font-size: 24px; color: ${accentColor};">💰 Return on Investment</h4>
        <p style="font-size: 19px;">${escapeHtml(content.roiProjection)}</p>
      </div>
      <img src="${sectionImages[4]}" alt="ROI projection" class="section-image"/>
    </div>` : ''}

    ${(content.riskMitigation||[]).length ? `
    <div class="section">
      <h2>Risk Mitigation & Support</h2>
      <p>We understand that implementing new solutions comes with concerns. Here's how we address them:</p>
      <div class="benefits">
        ${(content.riskMitigation||[]).map((risk:string,i:number)=>`
          <div class="benefit-card">
            <h3>🛡️ Protection ${i+1}</h3>
            <p>${escapeHtml(risk)}</p>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${(content.whyChooseUs||[]).length ? `
    <div class="section">
      <h2>Why ${escapeHtml(lead.company)} Should Choose ${escapeHtml(company.name)}</h2>
      <img src="${sectionImages[5]}" alt="why choose us" class="section-image"/>
      <div class="timeline-grid">
        ${(content.whyChooseUs||[]).map((reason:string,i:number)=>`
          <div class="timeline-card">
            <h3>⭐ Reason ${i+1}</h3>
            <p>${escapeHtml(reason)}</p>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${content.teamSupport ? `
    <div class="section">
      <h2>Your Dedicated Team & Support</h2>
      <img src="${sectionImages[6]}" alt="team support" class="section-image"/>
      <div class="insight-box">
        <h4>👥 Who Will Work With You</h4>
        <p style="font-size: 18px;">${escapeHtml(content.teamSupport)}</p>
      </div>
    </div>` : ''}

    ${content.pricingOverview ? `
    <div class="section">
      <h2>Investment & Value</h2>
      <img src="${sectionImages[7]}" alt="pricing" class="section-image"/>
      <div class="case-study">
        <h3 style="color: ${accentColor}; margin-bottom: 16px;">💎 Pricing Philosophy</h3>
        <p style="font-size: 18px;">${escapeHtml(content.pricingOverview)}</p>
      </div>
    </div>` : ''}

    <div class="cta-section">
      <h2>Next Steps for ${escapeHtml(lead.company)}</h2>
      ${String(content.cta||'').split('\n').map(p=>`<p style="font-size: 20px; margin: 16px 0;">${escapeHtml(p)}</p>`).join('')}
      ${content.nextSteps ? `<p style="font-size: 18px; margin-top: 24px;">${escapeHtml(content.nextSteps)}</p>` : ''}
      <a href="mailto:${company.website || 'contact@company.com'}" class="btn">Schedule a Call</a>
    </div>

    <div class="footer">
      <h3 style="color: white; margin-bottom: 16px;">Thank You, ${escapeHtml(lead.name || lead.company)}</h3>
      ${String(content.closing||'').split('\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}
      <p style="margin-top: 24px; font-size: 16px;">${escapeHtml(company.name)} | ${escapeHtml(company.website||'')} | ${escapeHtml(company.industry||'')}</p>
      <p style="margin-top: 12px; font-size: 14px; opacity: 0.7;">This proposal was prepared specifically for ${escapeHtml(lead.company)} on ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
</body>
</html>`;
      
      // Return HTML if requested
      console.log('B2B Format requested:', format); // Debug log
      if (format === "html") {
        console.log('Sending HTML response'); // Debug log
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader('Content-Disposition', `attachment; filename="b2b-${company.name.replace(/\s+/g, '_')}-to-${lead.company.replace(/\s+/g, '_')}.html"`);
        res.send(html);
        return;
      }
      console.log('Not HTML, continuing to PDF generation'); // Debug log

    // For PPTX and PDF formats, use puppeteer to convert the rich HTML
    // Both formats generate identical content
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const pdfPage = await browser.newPage();
      
      // Set viewport for consistent rendering
      await pdfPage.setViewport({ width: 1200, height: 1600 });
      
      // Load the HTML with all resources
      await pdfPage.setContent(html, { 
        waitUntil: ['networkidle0', 'load'],
        timeout: 30000
      });
      
      // Wait a bit for fonts and images to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate PDF with proper settings
      const pdfBuffer = await pdfPage.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        displayHeaderFooter: false,
      });
      
      await browser.close();
      
      // Both PDF and PPTX formats send as PDF (same content, same format)
      // User requested both to be identical
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="b2b-${company.name.replace(/\s+/g, '_')}-to-${lead.company.replace(/\s+/g, '_')}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
      return;
    } catch (puppeteerError: any) {
      logger.error('puppeteer:error', { error: puppeteerError?.message });
      // Fall back to basic PDF if puppeteer fails
    }
    
    // FALLBACK: Basic PDF generation if puppeteer fails
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 60;
    const margin = 50;
    const lineHeight = 18;

    const brand = (leadDetails?.brandColor && /^#?[0-9a-f]{6}$/i.test(leadDetails.brandColor) ? (leadDetails.brandColor.startsWith('#')? leadDetails.brandColor : '#'+leadDetails.brandColor) : '#0d6efd');
    const toRgb = (hex: string) => {
      const h = hex.replace('#','');
      const r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255; return {r,g,b};
    }
    const bc = toRgb(brand);
    // Top brand bar
    page.drawRectangle({ x: 0, y: height-10, width: 595, height: 10, color: rgb(bc.r, bc.g, bc.b) });
    y -= 20;

    // Logo (right)
    const logoData = await fetchImageBuffer(leadDetails?.logoUrl || autoLead.logoUrl);
    if (logoData) {
      try {
        const img = logoData.type === 'png' ? await pdfDoc.embedPng(logoData.bytes) : await pdfDoc.embedJpg(logoData.bytes);
        const iw = 80; const ih = (img.height / img.width) * iw;
        img.scale(1);
        page.drawImage(img, { x: 595 - margin - iw, y: y - ih + 16, width: iw, height: ih });
      } catch {}
    }

    page.drawText(sanitizePdfText(`${company.name} -> ${lead.company}`), { x: margin, y, size: 16, font: helveticaBold, color: rgb(bc.r, bc.g, bc.b) });
    y -= 20;
    const subline = [leadDetails?.industry, leadDetails?.size, leadDetails?.website].filter(Boolean).join(' • ');
    if (subline) { page.drawText(sanitizePdfText(subline), { x: margin, y, size: 10, font: helvetica, color: rgb(0.45,0.45,0.45) }); y -= 24; }

    page.drawText(sanitizePdfText(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" } as any)), { x: margin, y, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    y -= 24;

    page.drawText(sanitizePdfText(`To: ${lead.name || lead.company}`), { x: margin, y, size: 11, font: helvetica });
    y -= 14;
    if (lead.title) { page.drawText(sanitizePdfText(String(lead.title)), { x: margin, y, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) }); y -= 14; }
    if (lead.company && lead.name) { page.drawText(sanitizePdfText(String(lead.company)), { x: margin, y, size: 10, font: helvetica }); y -= 24; } else { y -= 10; }

    page.drawText(sanitizePdfText(String(content.subject)), { x: margin, y, size: 13, font: helveticaBold, color: rgb(bc.r*0.7, bc.g*0.7, bc.b*0.7) });
    y -= 18;

    const sections: string[] = [
      content.opening,
      (content.problem || content.problemStatement || ''),
      content.solution,
      `Key Benefits:\n${(content.valueProps||[]).map((v: string) => ` • ${v}`).join('\n')}`,
      content.proofPoints && content.proofPoints.length ? `Proof:\n${content.proofPoints.map((v: string) => ` • ${v}`).join('\n')}` : '',
      content.cta,
      content.closing,
    ];

    const drawWrapped = (text: string, indent = 0) => {
      const words = text.split(" ");
      let current = "";
      for (const w of words) {
        const test = current + w + " ";
        if (test.length > 75) {
          if (current) { page.drawText(sanitizePdfText(current.trim()), { x: margin + indent, y, size: 10, font: helvetica }); y -= lineHeight; }
          current = w + " ";
        } else {
          current = test;
        }
      }
      if (current) { page.drawText(sanitizePdfText(current.trim()), { x: margin + indent, y, size: 10, font: helvetica }); y -= lineHeight; }
    };

    for (const section of sections) {
      const lines = section.split("\n");
      for (const line of lines) {
        if (line.startsWith(" •")) drawWrapped(line, 15);
        else if (line === "Key Benefits:" || line === "Proof:") { page.drawText(line, { x: margin, y, size: 11, font: helveticaBold, color: rgb(bc.r, bc.g, bc.b) }); y -= lineHeight; }
        else drawWrapped(line, 0);
      }
      y -= 10;
      if (y < 260 && (leadDetails?.heroImageUrl || autoLead.heroImageUrl)) {
        // Try to place hero image on bottom if soon running out of space
        const heroData = await fetchImageBuffer(leadDetails?.heroImageUrl || autoLead.heroImageUrl);
        if (heroData) {
          try {
            const img = heroData.type === 'png' ? await pdfDoc.embedPng(heroData.bytes) : await pdfDoc.embedJpg(heroData.bytes);
            const maxW = 595 - margin*2; const iw = maxW; const ih = (img.height / img.width) * iw;
            if (y - ih < 60) { // new page
              pdfDoc.addPage([595, 842]);
              y = height - 60;
            }
            page.drawImage(img, { x: margin, y: y - ih, width: iw, height: ih });
            y -= ih + 12;
          } catch {}
        }
      }
      if (y < 100) { pdfDoc.addPage([595, 842]); y = height - 60; }
    }

    if (leadDetails?.videoUrl) {
      page.drawText(sanitizePdfText(`Video: ${leadDetails.videoUrl}`), { x: margin, y, size: 10, font: helvetica, color: rgb(0.2,0.2,0.6) });
      y -= 16;
    }

    try {
      // Template-based HTML→PDF if provided
      const { templateId, templateHtml, templateCss } = (req.body as any) || {};
      if (templateId || templateHtml) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const puppeteer = require("puppeteer");
        const browser = await puppeteer.launch({ headless: "new" });
        const pageWeb = await browser.newPage();
        let tpl: TemplateDef | { html: string; css?: string } | null = null;
        if (templateHtml) tpl = { html: String(templateHtml), css: String(templateCss||'') };
        else if (templateId) tpl = builtinTemplates.find(t=>t.id===String(templateId)) || listUserTemplates().find(t=>t.id===String(templateId)) || null;
        if (tpl) {
          const html = renderB2BIntoTemplate(content, company, lead, autoLead, lang, tpl);
          await pageWeb.setContent(html, { waitUntil: "networkidle0" });
          const pdfBytes = await pageWeb.pdf({ printBackground: true, width: '900px', height: '1273px' });
          await browser.close();
          res.setHeader("Content-Type", "application/pdf");
          res.send(Buffer.from(pdfBytes));
          return;
        }
      }
    } catch {}
    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    logger.error("docs:b2b:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to generate document" });
  }
});

export default router;

// ---------- Additional Endpoints ----------

// Templates: list built-ins
router.get("/templates", async (_req, res) => {
  const user = listUserTemplates();
  res.json({
    builtin: builtinTemplates.map((t: TemplateDef)=>({ id: t.id, name: t.name })),
    user: user.map(t=>({ id: t.id, name: t.name }))
  });
});

// Save user template
router.post("/templates", async (req, res) => {
  try {
    const { id, name, html, css } = req.body as { id?: string; name?: string; html: string; css?: string };
    if (!html || typeof html !== 'string') return res.status(400).json({ error: 'html required' });
    const saved = saveUserTemplate({ id, name, html, css });
    res.json({ template: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed to save template' });
  }
});

// Import template from URL
router.post("/templates/import", async (req, res) => {
  try {
    const { url, id, name } = req.body as { url: string; id?: string; name?: string };
    if (!url) return res.status(400).json({ error: 'url required' });
    const fetched = await fetchTemplateFromUrl(url);
    const saved = saveUserTemplate({ id, name, html: fetched.html, css: fetched.css });
    res.json({ template: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed to import template' });
  }
});

// Render CV with provided template (id or html)
router.post("/render/cv", async (req, res) => {
  try {
    const { profile, job, templateId, templateHtml, templateCss, format = 'pdf', lang = 'en' } = req.body as any;
    if (!profile || !job) return res.status(400).json({ error: 'profile and job required' });
    const tpl = templateHtml ? { html: String(templateHtml), css: String(templateCss||'') } : builtinTemplates.find(t=>t.id===String(templateId));
    // Pass templateCss as custom CSS to apply design options
    const html = tpl ? renderCvIntoTemplate(profile, job, lang, tpl, templateCss ? String(templateCss) : undefined) : generateHtmlCv(profile, job, lang);
    if (format === 'html') return res.type('html').send(html);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBytes: Buffer = await page.pdf({ printBackground: true, width: '816px', height: '1056px' });
    await browser.close();
    res.setHeader('Content-Type','application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    logger.error('docs:render-cv:error', { error: err?.message });
    res.status(500).json({ error: err?.message || 'failed to render cv' });
  }
});

// Render B2B with provided template (id or html)
router.post("/render/b2b", async (req, res) => {
  try {
    const { content, company, lead, leadDetails, templateId, templateHtml, templateCss, format = 'pdf', lang = 'en' } = req.body as any;
    if (!content || !company || !lead) return res.status(400).json({ error: 'content, company and lead required' });
    const tpl = templateHtml ? { html: String(templateHtml), css: String(templateCss||'') } : builtinTemplates.find(t=>t.id===String(templateId));
    const html = tpl ? renderB2BIntoTemplate(content, company, lead, leadDetails, lang, tpl) : `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><pre>${escapeHtml(JSON.stringify({ content, company, lead, leadDetails }, null, 2))}</pre></body></html>`;
    if (format === 'html') return res.type('html').send(html);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBytes: Buffer = await page.pdf({ printBackground: true, width: '900px', height: '1273px' });
    await browser.close();
    res.setHeader('Content-Type','application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    logger.error('docs:render-b2b:error', { error: err?.message });
    res.status(500).json({ error: err?.message || 'failed to render b2b' });
  }
});

router.post("/job-from-url", async (req, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "valid url required" });

    const html = await httpGet(url);
    if (!html) return res.status(400).json({ error: "failed to fetch url" });
    const $ = cheerio.load(html);

    const getText = (sel: string) => $(sel).first().text().replace(/\s+/g, " ").trim();

    let position = getText("h1");
    if (!position) position = getText("[class*='title'],[id*='title'],h2");

    let company = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
    if (!company) company = getText("[class*='company'],[id*='company']");
    if (!company) {
      try { company = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    }

    // Collect description from common containers
    const descCandidates = [
      "#jobDescriptionText",
      "[class*='description']",
      "[id*='description']",
      "article",
      "main",
      "section",
    ];
    let description = '';
    for (const sel of descCandidates) {
      const t = $(sel).first().text().replace(/\s+/g, " ").trim();
      if (t && t.length > description.length) description = t;
    }
    if (!description) description = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

    // Requirements: from list items near requirement keywords
    const reqs: string[] = [];
    $("*:contains('Requirements'), *:contains('Responsibilities'), *:contains('What you will do')").each((_, el) => {
      const section = $(el).closest("section,div,article");
      section.find("li").each((__, li) => {
        const txt = $(li).text().replace(/\s+/g, " ").trim();
        if (txt && txt.length > 4) reqs.push(txt);
      });
    });
    if (reqs.length === 0) {
      $("li").slice(0, 20).each((_, li) => {
        const txt = $(li).text().replace(/\s+/g, " ").trim();
        if (txt && txt.length > 4) reqs.push(txt);
      });
    }

    const job = {
      company,
      position: position || "",
      description,
      requirements: Array.from(new Set(reqs)).slice(0, 20),
    };

    const detected = detectLang(`${position}\n${company}\n${description}`);
    logger.info("docs:job-from-url", { url, position: job.position, company: job.company, lang: detected });
    res.json({ job, lang: detected });
  } catch (err: any) {
    logger.error("docs:job-from-url:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to parse job url" });
  }
});

router.post("/phrase", async (req, res) => {
  try {
    const { text = "", style = "concise professional", context = "" } = req.body as { text: string; style?: string; context?: string };
    if (!text || text.trim().length === 0) return res.status(400).json({ error: "text required" });
    if (!config.openaiApiKey) return res.json({ text });

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You rewrite CV content. Make it ${style}. Use active voice, quantify achievements, avoid fluff, keep 2-3 sentences.` },
        { role: "user", content: `Context: ${context}\n\nRewrite: ${text}` },
      ],
      temperature: 0.4,
    } as any;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.openaiApiKey}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      logger.warn("docs:phrase:http", { status: r.status });
      return res.json({ text });
    }
    const data: any = await r.json();
    const out = String(data?.choices?.[0]?.message?.content || text).replace(/^\s+|\s+$/g, "");
    res.json({ text: out });
  } catch (err: any) {
    logger.error("docs:phrase:error", { error: err?.message });
    res.status(500).json({ error: err?.message || "failed to phrase" });
  }
});
