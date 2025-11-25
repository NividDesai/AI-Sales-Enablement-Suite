export function normalizePhone(raw?: string | null, location?: string | null, domain?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  // Remove ext markers and non-dial characters, preserve leading + if present
  const cleaned = s
    .replace(/ext\.?|x\d+|extension\s*\d+/gi, "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");

  if (/^\+\d{6,15}$/.test(cleaned)) {
    // Already E.164-like: extract code and digits, then group digits for readability
    const m = cleaned.match(/^(\+\d{1,3})(\d{5,})$/);
    if (m) {
      const code = m[1];
      const digits = m[2];
      return `${code} ${groupDigits(code, digits)}`;
    }
    return cleaned;
  }

  // Guess country code from location or TLD
  const cc = guessCountryCode(location, domain);
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return undefined;
  const national = digits.replace(/^0+/, "");
  const code = cc ? cc : "+1";
  // Return "+CC <grouped number>"
  return `${code} ${groupDigits(code, national)}`.replace(/[^\d+\s]/g, "");
}

function groupDigits(code: string, digits: string): string {
  // NANP formatting: +1 415 555 1234 when 10 digits
  if (code === "+1" && digits.length === 10) {
    return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  }
  // Generic grouping: split into groups of 3 from the start
  const out: string[] = [];
  for (let i = 0; i < digits.length; i += 3) {
    out.push(digits.slice(i, i + 3));
  }
  return out.join(" ");
}

function guessCountryCode(location?: string | null, domain?: string | null): string | undefined {
  const loc = (location || "").toLowerCase();
  const tld = extractTld(domain || "");

  // Country name hints
  const mapByName: Array<[RegExp, string]> = [
    [/india|\bin\b/, "+91"],
    [/united\s*states|\busa\b|\bus\b|america|california|new york|texas|florida/, "+1"],
    [/canada|toronto|vancouver|montreal/, "+1"],
    [/united\s*kingdom|england|scotland|wales|\buk\b|london/, "+44"],
    [/australia|sydney|melbourne|brisbane/, "+61"],
    [/france|paris|lyon|marseille/, "+33"],
    [/germany|berlin|munich|hamburg|frankfurt/, "+49"],
    [/spain|madrid|barcelona|valencia/, "+34"],
    [/italy|rome|milan|naples|florence/, "+39"],
    [/netherlands|amsterdam|rotterdam|utrecht/, "+31"],
    [/brazil|sao paulo|rio de janeiro|brasilia/, "+55"],
    [/south\s*africa|johannesburg|cape town|durban/, "+27"],
    [/uae|united\s*arab\s*emirates|dubai|abudhabi|abu\s*dhabi/, "+971"],
  ];
  for (const [re, code] of mapByName) if (re.test(loc)) return code;

  // TLD hints
  const mapByTld: Record<string, string> = {
    in: "+91",
    uk: "+44",
    gb: "+44",
    au: "+61",
    fr: "+33",
    de: "+49",
    es: "+34",
    it: "+39",
    nl: "+31",
    ca: "+1",
    br: "+55",
    za: "+27",
    ae: "+971",
    us: "+1",
  };
  if (tld && mapByTld[tld]) return mapByTld[tld];
  return undefined;
}

function extractTld(domain: string): string | undefined {
  try {
    const d = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
    const parts = d.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}
