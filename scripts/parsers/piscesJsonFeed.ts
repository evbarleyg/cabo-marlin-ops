import { buildFailure, compactSnippet, extractDistanceMiles, extractIsoDate, extractIsoDateFromUrl, extractSpecies, extractWaterTempF } from "./shared";
import type { ParseResult } from "./types";

const SOURCE_NAME = "Pisces";

interface PiscesFeedItem {
  id?: string;
  url?: string;
  title?: string;
  summary?: string;
  content_text?: string;
  content_html?: string;
  date_published?: string;
}

export function parsePiscesJsonFeed(payload: string, sourceUrl: string): ParseResult {
  const reports: ParseResult["reports"] = [];
  const failures: ParseResult["failures"] = [];

  const parsed = safeParse(payload);
  if (!parsed) {
    failures.push(buildFailure(SOURCE_NAME, sourceUrl, "Invalid JSON feed payload", compactSnippet(payload)));
    return { reports, failures };
  }

  const items = Array.isArray(parsed.items) ? (parsed.items as PiscesFeedItem[]) : [];
  for (const item of items) {
    const link = normalizeLink(item.url, sourceUrl);
    const text = compactSnippet(
      [
        item.title ?? "",
        item.summary ?? "",
        item.content_text ?? "",
        stripHtml(item.content_html ?? ""),
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (text.length < 30) continue;

    const date = parseDateHint(item.date_published) ?? extractIsoDate(text) ?? extractIsoDateFromUrl(link) ?? new Date().toISOString().slice(0, 10);
    const species = extractSpecies(text);
    const distanceMiles = extractDistanceMiles(text);
    const waterTempF = extractWaterTempF(text);
    const hasCatchLanguage = /(report|trip|offshore|bite|release|released|landed|caught|hooked|boated)\b/i.test(text);
    const hasNumericSignal = distanceMiles !== undefined || waterTempF !== undefined;
    if (!hasCatchLanguage && species.length === 0 && !hasNumericSignal) continue;

    reports.push({
      source: SOURCE_NAME,
      date,
      species,
      notes: text,
      distance_offshore_miles: distanceMiles,
      water_temp_f: waterTempF,
      link,
    });
  }

  if (reports.length === 0) {
    failures.push(buildFailure(SOURCE_NAME, sourceUrl, "No reports matched parser rules", compactSnippet(payload)));
  }

  return {
    reports: dedupeReports(reports),
    failures,
  };
}

function safeParse(payload: string): { items?: unknown } | null {
  try {
    return JSON.parse(payload) as { items?: unknown };
  } catch {
    return null;
  }
}

function parseDateHint(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return extractIsoDate(value);
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeLink(link: string | undefined, fallback: string): string {
  if (!link) return fallback;
  try {
    const url = new URL(link, fallback);
    url.hash = "";
    if (url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ");
}

function dedupeReports(reports: ParseResult["reports"]): ParseResult["reports"] {
  const seen = new Set<string>();
  return reports.filter((report) => {
    const key = `${report.date}|${report.notes}|${report.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
