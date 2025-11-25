import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as mammoth from 'mammoth/mammoth.browser';
import { logger } from '../utils/logger';

export interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  title?: string;
  summary?: string;
  experience?: Array<{
    company: string;
    position: string;
    duration: string;
    description: string;
    achievements?: string[];
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    year: string;
    gpa?: string;
  }>;
  skills?: {
    technical?: string[];
    soft?: string[];
    languages?: string[];
    certifications?: string[];
  };
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    link?: string;
  }>;
  photoDataUrl?: string; // embedded image from uploaded CV if available
}

export interface JobPosting {
  company: string;
  position: string;
  description: string;
  requirements?: string[];
  preferences?: string[];
  location?: string;
  type?: string;
}

export interface CompanyInfo {
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  valueProposition?: string;
  products?: string[];
  differentiators?: string[];
}

export class CVDocumentAgent {

  async parseUploadedCV(file: File): Promise<UserProfile> {
    logger.info('cvdoc:parse:start', { filename: file.name });

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return this.parsePDFCV(file);
    } else if (file.name.toLowerCase().endsWith('.docx')) {
      return this.parseDocxCV(file);
    } else if (file.name.toLowerCase().endsWith('.txt')) {
      return this.parseTextCV(await file.text());
    }

    throw new Error('Unsupported file format');
  }

  private async parseDocxCV(file: File): Promise<UserProfile> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await (mammoth as any).extractRawText({ arrayBuffer });
    return this.parseTextCV(result.value || '');
  }

  private async parsePDFCV(_file: File): Promise<UserProfile> {
    // pdf-lib cannot extract text; return minimal profile
    logger.warn('cvdoc:pdf:extraction_limited');
    return this.parseTextCV('');
  }

  private parseTextCV(text: string): UserProfile {
    const profile: UserProfile = { name: '', email: '' } as UserProfile;

    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) profile.email = emailMatch[0];

    const phoneMatch = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/);
    if (phoneMatch) profile.phone = phoneMatch[0];

    const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
    if (linkedinMatch) profile.linkedinUrl = `https://${linkedinMatch[0]}`;

    const sections = this.extractSections(text);

    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length > 0) {
      profile.name = lines[0].trim();
    }

    if (sections.experience) profile.experience = this.parseExperience(sections.experience);
    if (sections.education) profile.education = this.parseEducation(sections.education);
    if (sections.skills) profile.skills = this.parseSkills(sections.skills);

    logger.info('cvdoc:parse:complete', { name: profile.name });
    return profile;
  }

  private extractSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const headers = [
      'experience',
      'work history',
      'employment',
      'education',
      'academic',
      'skills',
      'technical skills',
      'competencies',
      'projects',
      'portfolio',
      'summary',
      'objective',
      'profile',
    ];

    const lines = text.split('\n');
    let currentSection = '';
    let sectionContent = '';

    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      const matchedHeader = headers.find((h) => lower.includes(h));

      if (matchedHeader) {
        if (currentSection && sectionContent) {
          sections[currentSection] = sectionContent.trim();
        }
        currentSection = matchedHeader.split(' ')[0];
        sectionContent = '';
      } else if (currentSection) {
        sectionContent += line + '\n';
      }
    }

    if (currentSection && sectionContent) {
      sections[currentSection] = sectionContent.trim();
    }

    return sections;
  }

  private parseExperience(text: string): UserProfile['experience'] {
    const experiences: NonNullable<UserProfile['experience']> = [];
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim());
      if (lines.length >= 2) {
        experiences.push({
          position: lines[0],
          company: lines[1],
          duration: lines[2] || '',
          description: lines.slice(3).join(' '),
        });
      }
    }

    return experiences;
  }

  private parseEducation(text: string): UserProfile['education'] {
    const education: NonNullable<UserProfile['education']> = [];
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim());
      if (lines.length >= 2) {
        education.push({ degree: lines[0], institution: lines[1], year: lines[2] || '' });
      }
    }

    return education;
  }

  private parseSkills(text: string): UserProfile['skills'] {
    const skills: UserProfile['skills'] = {};

    const techMatch = text.match(/technical.*?:(.*?)(?:\n|$)/i);
    if (techMatch) {
      skills.technical = techMatch[1].split(/[ ,;]+/).map((s) => s.trim()).filter(Boolean);
    }

    if (!skills.technical) {
      skills.technical = text
        .split(/[,;.\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2 && s.length < 30);
    }

    return skills;
  }

  async generateTailoredCV(
    profile: UserProfile,
    job: JobPosting,
    format: 'pdf' | 'docx' | 'html' = 'pdf',
  ): Promise<Blob> {
    logger.info('cvdoc:generate:start', { format, position: job.position });

    const tailoredProfile = await this.tailorProfileForJob(profile, job);

    switch (format) {
      case 'pdf':
        return this.generatePDFCV(tailoredProfile, job);
      case 'html':
        return this.generateHTMLCV(tailoredProfile, job);
      case 'docx':
        return this.generateDocxCV(tailoredProfile, job);
      default:
        throw new Error('Unsupported format');
    }
  }

  private async tailorProfileForJob(profile: UserProfile, job: JobPosting): Promise<UserProfile> {
    const tailored = { ...profile };

    tailored.summary = await this.generateSummary(profile, job);

    if (profile.experience) {
      tailored.experience = await this.optimizeExperience(profile.experience, job);
    }

    if (profile.skills) {
      tailored.skills = await this.prioritizeSkills(profile.skills, job);
    }

    return tailored;
  }

  private async generateSummary(profile: UserProfile, job: JobPosting): Promise<string> {
    return `Results-driven ${profile.title || 'professional'} with proven expertise aligned with ${job.company}'s needs for ${job.position} role.`;
  }

  private async optimizeExperience(
    experiences: NonNullable<UserProfile['experience']>,
    job: JobPosting,
  ): Promise<NonNullable<UserProfile['experience']>> {
    const scored = experiences.map((exp) => {
      let score = 0;
      const combined = `${exp.position} ${exp.description}`.toLowerCase();

      job.requirements?.forEach((req) => {
        if (combined.includes(req.toLowerCase())) score += 2;
      });

      job.preferences?.forEach((pref) => {
        if (combined.includes(pref.toLowerCase())) score += 1;
      });

      return { ...exp, score } as any;
    });

    return scored
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .map(({ score, ...exp }: any) => exp);
  }

  private async prioritizeSkills(
    skills: NonNullable<UserProfile['skills']>,
    job: JobPosting,
  ): Promise<NonNullable<UserProfile['skills']>> {
    const prioritized = { ...skills };
    const jobText = `${job.description} ${job.requirements?.join(' ')}`.toLowerCase();

    if (skills.technical) {
      prioritized.technical = [...skills.technical].sort((a, b) => {
        const aFound = jobText.includes(a.toLowerCase()) ? 1 : 0;
        const bFound = jobText.includes(b.toLowerCase()) ? 1 : 0;
        return bFound - aFound;
      });
    }

    return prioritized;
  }

  private async generatePDFCV(profile: UserProfile, _job: JobPosting): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;
    const margin = 50;
    const lineHeight = 20;

    page.drawText(profile.name || 'Unnamed Candidate', {
      x: margin,
      y,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.2, 0.4),
    });
    y -= 30;

    const contact = [profile.email, profile.phone, profile.location].filter(Boolean).join(' | ');
    page.drawText(contact, { x: margin, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    y -= 30;

    if (profile.summary) {
      page.drawText('PROFESSIONAL SUMMARY', { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
      y -= lineHeight;

      const words = profile.summary.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line + word + ' ';
        if (testLine.length > 80) {
          page.drawText(line.trim(), { x: margin, y, size: 10, font: helvetica });
          y -= lineHeight;
          line = word + ' ';
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
      page.drawText('EXPERIENCE', { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
      y -= lineHeight;

      for (const exp of profile.experience) {
        page.drawText(`${exp.position} | ${exp.company}`, { x: margin, y, size: 11, font: helveticaBold });
        y -= lineHeight;

        page.drawText(exp.duration || '', { x: margin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
        y -= lineHeight;

        if (exp.description) {
          const descWords = exp.description.split(' ');
          let descLine = '';
          for (const word of descWords) {
            const testLine = descLine + word + ' ';
            if (testLine.length > 85) {
              page.drawText(descLine.trim(), { x: margin + 10, y, size: 10, font: helvetica });
              y -= lineHeight * 0.9;
              descLine = word + ' ';
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
      page.drawText('TECHNICAL SKILLS', { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
      y -= lineHeight;
      const skillsText = profile.skills.technical.join(', ');
      page.drawText(skillsText, { x: margin, y, size: 10, font: helvetica });
      y -= lineHeight * 1.5;
    }

    if (profile.education && profile.education.length > 0) {
      page.drawText('EDUCATION', { x: margin, y, size: 12, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
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
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  private async generateHTMLCV(profile: UserProfile, _job: JobPosting): Promise<Blob> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${profile.name} - CV</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #fff; }
    .cv-container { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { border-bottom: 3px solid #667eea; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { color: #2d3748; font-size: 2rem; margin-bottom: 8px; }
    .contact { color: #718096; font-size: 0.95em; }
    .contact a { color: #667eea; text-decoration: none; }
    h2 { color: #667eea; font-size: 1.1rem; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px; }
    .summary { background: #f5f7fa; padding: 12px; border-radius: 8px; margin-bottom: 16px; color: #4a5568; }
    .experience-item, .education-item { margin-bottom: 14px; padding: 10px; background: #f8f9fa; border-radius: 8px; }
    .position { font-weight: bold; color: #2d3748; }
    .company { color: #667eea; font-weight: 500; }
    .duration { color: #718096; font-size: 0.9em; margin-top: 4px; }
    .description { margin-top: 8px; color: #4a5568; }
    .skills-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .skill { background: #667eea; color: white; padding: 4px 10px; border-radius: 14px; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="cv-container">
    <div class="header">
      <h1>${profile.name}</h1>
      <div class="contact">
        ${profile.email ? `<span>✉️ ${profile.email}</span> | ` : ''}
        ${profile.phone ? `<span>📱 ${profile.phone}</span> | ` : ''}
        ${profile.location ? `<span>📍 ${profile.location}</span> | ` : ''}
        ${profile.linkedinUrl ? `<a href="${profile.linkedinUrl}" target="_blank">🔗 LinkedIn</a>` : ''}
      </div>
    </div>

    ${profile.summary ? `<div class="summary">${profile.summary}</div>` : ''}

    ${profile.experience && profile.experience.length > 0 ? `
    <h2>Experience</h2>
    ${profile.experience
      .map(
        (exp) => `
      <div class="experience-item">
        <div class="position">${exp.position}</div>
        <div class="company">${exp.company}</div>
        <div class="duration">${exp.duration}</div>
        ${exp.description ? `<div class="description">${exp.description}</div>` : ''}
        ${exp.achievements ? `<ul style="margin-top: 6px; padding-left: 18px;">${exp.achievements
          .map((a) => `<li>${a}</li>`) 
          .join('')}</ul>` : ''}
      </div>`,
      )
      .join('')}
    ` : ''}

    ${profile.skills?.technical && profile.skills.technical.length > 0 ? `
    <h2>Technical Skills</h2>
    <div class="skills-container">
      ${profile.skills.technical.map((skill) => `<span class="skill">${skill}</span>`).join('')}
    </div>
    ` : ''}

    ${profile.education && profile.education.length > 0 ? `
    <h2>Education</h2>
    ${profile.education
      .map(
        (edu) => `
      <div class="education-item">
        <div class="position">${edu.degree}</div>
        <div class="company">${edu.institution}</div>
        ${edu.year ? `<div class="duration">${edu.year}</div>` : ''}
        ${edu.gpa ? `<div class="description">GPA: ${edu.gpa}</div>` : ''}
      </div>`,
      )
      .join('')}
    ` : ''}

    ${profile.projects && profile.projects.length > 0 ? `
    <h2>Projects</h2>
    ${profile.projects
      .map(
        (proj) => `
      <div class="experience-item">
        <div class="position">${proj.name}</div>
        <div class="description">${proj.description}</div>
        ${proj.technologies ? `<div class="skills-container" style="margin-top: 8px;">${proj.technologies
          .map((tech) => `<span class="skill">${tech}</span>`)
          .join('')}</div>` : ''}
        ${proj.link ? `<a href="${proj.link}" target="_blank" style="color: #667eea; text-decoration: none; margin-top: 8px; display: inline-block;">🔗 View Project</a>` : ''}
      </div>`,
      )
      .join('')}
    ` : ''}
  </div>
</body>
</html>`;

    return new Blob([html], { type: 'text/html' });
  }

  private async generateDocxCV(profile: UserProfile, job: JobPosting): Promise<Blob> {
    const htmlBlob = await this.generateHTMLCV(profile, job);
    const htmlText = await htmlBlob.text();
    return new Blob([htmlText], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  async generateB2BDocument(
    companyInfo: CompanyInfo,
    leadInfo: any,
    context?: string,
    format: 'pdf' | 'html' = 'pdf',
  ): Promise<Blob> {
    logger.info('b2bdoc:generate:start', { company: companyInfo.name, lead: leadInfo.company });

    const content = await this.generateB2BContent(companyInfo, leadInfo, context);

    if (format === 'pdf') {
      return this.generateB2BPDF(content, companyInfo, leadInfo);
    } else {
      return this.generateB2BHTML(content, companyInfo, leadInfo);
    }
  }

  private async generateB2BContent(company: CompanyInfo, lead: any, context?: string) {
    const content = {
      subject: `Partnership Opportunity: ${company.name} x ${lead.company}`,
      opening: `Dear ${lead.name || 'Team ' + lead.company},\n\nI hope this message finds you well. I'm reaching out from ${company.name} because I believe there's a significant opportunity for collaboration between our organizations.`,
      problemStatement: `In reviewing ${lead.company}'s recent initiatives${lead.companyContext?.recentNews ? ` and news about ${lead.companyContext.recentNews[0].title}` : ''}, I noticed areas where our expertise could provide immediate value.`,
      solution: `${company.name} specializes in ${company.valueProposition || 'delivering innovative solutions'} that directly address the challenges organizations like yours face in ${company.industry || "today's market"}.`,
      valueProps: company.differentiators || [
        'Proven track record with similar organizations',
        'Immediate ROI within the first quarter',
        'Dedicated support and seamless integration',
        'Scalable solutions that grow with your needs',
      ],
      cta: `I'd love to share how we've helped companies similar to ${lead.company} achieve measurable results. Could we schedule a brief 15-minute call next week to explore potential synergies?`,
      closing: `Looking forward to the possibility of working together.\n\nBest regards,\n[Your Name]\n${company.name}`,
    } as const;

    return context ? { ...content, solution: `${context}\n\n${content.solution}` } : content;
  }

  private async generateB2BPDF(content: any, company: CompanyInfo, lead: any): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 80;
    const margin = 60;
    const lineHeight = 18;

    page.drawText(company.name.toUpperCase(), { x: margin, y, size: 16, font: helveticaBold, color: rgb(0.2, 0.3, 0.6) });
    y -= 40;

    page.drawText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 30;

    page.drawText(`To: ${lead.name || lead.company}`, { x: margin, y, size: 11, font: helvetica });
    y -= 15;

    if (lead.title) {
      page.drawText(String(lead.title), { x: margin, y, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
      y -= 15;
    }

    if (lead.company && lead.name) {
      page.drawText(String(lead.company), { x: margin, y, size: 10, font: helvetica });
      y -= 30;
    } else {
      y -= 15;
    }

    page.drawText(String(content.subject), { x: margin, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.2, 0.4) });
    y -= 30;

    const sections: string[] = [
      content.opening,
      content.problemStatement,
      content.solution,
      `Key Benefits:\n${content.valueProps.map((v: string) => ` • ${v}`).join('\n')}`,
      content.cta,
      content.closing,
    ];

    const drawWrapped = (text: string, indent = 0) => {
      const words = text.split(' ');
      let current = '';
      for (const w of words) {
        const test = current + w + ' ';
        if (test.length > 75) {
          if (current) {
            page.drawText(current.trim(), { x: margin + indent, y, size: 10, font: helvetica });
            y -= lineHeight;
          }
          current = w + ' ';
        } else {
          current = test;
        }
      }
      if (current) {
        page.drawText(current.trim(), { x: margin + indent, y, size: 10, font: helvetica });
        y -= lineHeight;
      }
    };

    for (const section of sections) {
      const lines = section.split('\n');
      for (const line of lines) {
        if (line.startsWith(' •')) {
          drawWrapped(line, 15);
        } else if (line === 'Key Benefits:') {
          page.drawText(line, { x: margin, y, size: 11, font: helveticaBold, color: rgb(0.2, 0.3, 0.6) });
          y -= lineHeight;
        } else {
          drawWrapped(line, 0);
        }
      }
      y -= 10;
      if (y < 100) {
        pdfDoc.addPage([595, 842]);
        y = height - 80;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  private async generateB2BHTML(content: any, company: CompanyInfo, lead: any): Promise<Blob> {
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${company.name} → ${lead.company} - Outreach</title>
<style>body{font-family:Arial,Helvetica,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#333}h1{color:#2d3748}h2{color:#4a5568} .card{background:#fff;border:1px solid #eee;border-radius:8px;padding:16px;box-shadow:0 6px 20px rgba(0,0,0,0.06)} .muted{color:#718096}</style>
</head>
<body>
  <h1>${company.name} → ${lead.company}</h1>
  <div class="muted">${new Date().toLocaleDateString()}</div>
  <div class="card" style="margin-top:16px">
    <h2>${content.subject}</h2>
    ${content.opening.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
    ${content.problemStatement.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
    ${content.solution.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
    <h3>Key Benefits</h3>
    <ul>${content.valueProps.map((v: string) => `<li>${v}</li>`).join('')}</ul>
    ${content.cta.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
    ${content.closing.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
  </div>
</body></html>`;

    return new Blob([html], { type: 'text/html' });
  }
}
