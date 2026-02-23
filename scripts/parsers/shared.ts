import type { ParseFailure } from "./types";

const SPECIES_KEYWORDS = [
  "striped marlin",
  "blue marlin",
  "black marlin",
  "marlin",
  "yellowfin tuna",
  "tuna",
  "dorado",
  "mahi",
  "wahoo",
  "sailfish",
  "roosterfish",
  "snapper",
  "amberjack",
];

export function extractSpecies(text: string): string[] {
  const lower = text.toLowerCase();
  const matches = SPECIES_KEYWORDS.filter((keyword) => lower.includes(keyword));
  return [...new Set(matches.map((item) => item.replace("mahi", "mahi mahi")))];
}

export function extractIsoDate(text: string): string | null {
  const directIso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (directIso) return directIso[1];

  const monthFirst = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i,
  );
  if (monthFirst) {
    const parsed = new Date(`${monthFirst[1]} ${monthFirst[2]} ${monthFirst[3]} 12:00:00 UTC`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const dayFirst = text.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
  );
  if (dayFirst) {
    const parsed = new Date(`${dayFirst[2]} ${dayFirst[1]} ${dayFirst[3]} 12:00:00 UTC`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

export function extractDistanceMiles(text: string): number | undefined {
  const match = text.match(/(\d{1,3})(?:\s*(?:-|to)\s*(\d{1,3}))?\s*(?:miles?|mi)\b/i);
  if (!match) return undefined;
  if (!match[2]) return Number(match[1]);
  return Math.round((Number(match[1]) + Number(match[2])) / 2);
}

export function extractWaterTempF(text: string): number | undefined {
  const match = text.match(/\b(\d{2,3})\s*(?:degrees?\s*)?(?:°\s*)?f\b/i);
  if (match) return Number(match[1]);

  const fallback = text.match(/water\s*(?:temp|temperature)\s*(?:is|at)?\s*(\d{2,3})/i);
  if (fallback) return Number(fallback[1]);

  return undefined;
}

export function compactSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

export function buildFailure(source: string, link: string, error: string, snippet: string): ParseFailure {
  return {
    source,
    link,
    error,
    snippet: compactSnippet(snippet),
  };
}
