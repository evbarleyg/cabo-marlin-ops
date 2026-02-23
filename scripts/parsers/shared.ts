import type { ParseFailure } from "./types";

const SPECIES_PATTERNS: Array<{ canonical: string; patterns: RegExp[] }> = [
  {
    canonical: "striped marlin",
    patterns: [/\bstriped\s+marlin\b/i],
  },
  {
    canonical: "blue marlin",
    patterns: [/\bblue\s+marlin\b/i],
  },
  {
    canonical: "black marlin",
    patterns: [/\bblack\s+marlin\b/i],
  },
  {
    canonical: "marlin",
    patterns: [/\bmarlin\b/i],
  },
  {
    canonical: "yellowfin tuna",
    patterns: [/\byellowfin\s+tuna\b/i, /\byellowfin\b/i, /\byft\b/i],
  },
  {
    canonical: "tuna",
    patterns: [/\btuna\b/i],
  },
  {
    canonical: "dorado",
    patterns: [/\bdorado\b/i, /\bdolphinfish\b/i],
  },
  {
    canonical: "mahi mahi",
    patterns: [/\bmahi(?:\s|-)?mahi\b/i],
  },
  {
    canonical: "wahoo",
    patterns: [/\bwahoo\b/i],
  },
  {
    canonical: "sailfish",
    patterns: [/\bsailfish\b/i],
  },
  {
    canonical: "roosterfish",
    patterns: [/\broosterfish\b/i],
  },
  {
    canonical: "snapper",
    patterns: [/\bsnapper\b/i],
  },
  {
    canonical: "amberjack",
    patterns: [/\bamberjack\b/i],
  },
];

const MONTH_NAME_TO_INDEX = new Map<string, number>([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

function normalizeDayToken(token: string): number {
  return Number(token.replace(/(st|nd|rd|th)$/i, ""));
}

function normalizeYearToken(token: string): number {
  const raw = Number(token);
  if (token.length === 2) {
    return raw >= 70 ? 1900 + raw : 2000 + raw;
  }
  return raw;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractSpecies(text: string): string[] {
  const normalized = normalizeText(text);
  const matches = SPECIES_PATTERNS.filter((entry) => entry.patterns.some((pattern) => pattern.test(normalized))).map(
    (entry) => entry.canonical,
  );
  return [...new Set(matches)];
}

export function extractIsoDate(text: string): string | null {
  const directIso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (directIso) return directIso[1];

  const dayFirst = text.match(
    /\b(\d{1,2}(?:st|nd|rd|th)?)\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?,?\s+(\d{4})\b/i,
  );
  if (dayFirst) {
    const month = MONTH_NAME_TO_INDEX.get(dayFirst[2].replace(".", "").toLowerCase());
    if (month) {
      const day = normalizeDayToken(dayFirst[1]);
      const year = normalizeYearToken(dayFirst[3]);
      const parsed = toIsoDate(year, month, day);
      if (parsed) return parsed;
    }
  }

  const monthFirst = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}(?:st|nd|rd|th)?),?\s*(\d{4})\b/i,
  );
  if (monthFirst) {
    const month = MONTH_NAME_TO_INDEX.get(monthFirst[1].replace(".", "").toLowerCase());
    if (month) {
      const day = normalizeDayToken(monthFirst[2]);
      const year = normalizeYearToken(monthFirst[3]);
      const parsed = toIsoDate(year, month, day);
      if (parsed) return parsed;
    }
  }

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = normalizeYearToken(slash[3]);
    const [month, day] = first > 12 && second <= 12 ? [second, first] : [first, second];
    const parsed = toIsoDate(year, month, day);
    if (parsed) return parsed;
  }

  return null;
}

export function extractDistanceMiles(text: string): number | undefined {
  const match = text.match(/(\d{1,3})(?:\s*(?:-|to)\s*(\d{1,3}))?\s*(?:nautical\s*)?(?:miles?|mi|nm|nmi)\b/i);
  if (!match) return undefined;
  if (!match[2]) return Number(match[1]);
  return Math.round((Number(match[1]) + Number(match[2])) / 2);
}

export function extractWaterTempF(text: string): number | undefined {
  const match = text.match(/\b(\d{2,3})\s*(?:degrees?\s*)?(?:°\s*)?f\b/i);
  if (match) return Number(match[1]);

  const fallback = text.match(/water\s*(?:temp|temperature)\s*(?:is|at)?\s*(\d{2,3})/i);
  if (fallback) return Number(fallback[1]);

  const celsius = text.match(/\b(\d{1,2})(?:\.\d+)?\s*(?:degrees?\s*)?(?:°\s*)?c\b/i);
  if (celsius) {
    return Number((Number(celsius[1]) * (9 / 5) + 32).toFixed(1));
  }

  return undefined;
}

export function compactSnippet(text: string): string {
  return normalizeText(text).slice(0, 280);
}

export function buildFailure(source: string, link: string, error: string, snippet: string): ParseFailure {
  return {
    source,
    link,
    error,
    snippet: compactSnippet(snippet),
  };
}
