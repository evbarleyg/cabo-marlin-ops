import { load } from "cheerio";
import {
  buildFailure,
  compactSnippet,
  extractDistanceMiles,
  extractIsoDate,
  extractIsoDateFromUrl,
  extractSpecies,
  extractWaterTempF,
} from "./shared";
import type { ParseResult } from "./types";

export function parseBlogStyleReports(html: string, sourceName: string, sourceUrl: string): ParseResult {
  const $ = load(html);
  const reports: ParseResult["reports"] = [];
  const failures: ParseResult["failures"] = [];

  const selectors = [
    "article",
    ".post",
    ".entry",
    ".blog-post",
    ".report",
    "li",
  ];

  const seen = new Set<string>();
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const root = $(element);
      const title = root.find("h1, h2, h3, .entry-title, .post-title").first().text().trim();
      const excerpt = root.find("p, .excerpt, .summary").first().text().trim();
      const meta = root.find("time, .date, .meta, .post-date").first().text().trim();
      const href = root.find("a[href]").first().attr("href") ?? sourceUrl;
      const datetime = root.find("time[datetime]").first().attr("datetime");

      const text = [title, excerpt, meta].filter(Boolean).join(" ").trim();
      if (text.length < 35) return;

      const key = `${normalizeLink(href, sourceUrl)}|${compactSnippet(text)}`;
      if (seen.has(key)) return;
      seen.add(key);

      const normalizedLink = normalizeLink(href, sourceUrl);
      const date = parseDateHint(datetime) ?? extractIsoDate(text) ?? extractIsoDateFromUrl(normalizedLink);
      const species = extractSpecies(text);
      const hasSignal = species.length > 0 || date !== null;
      const hasFishingLanguage = /(report|trip|offshore|bite|release|landed|caught|charter)\b/i.test(text);
      if (!hasSignal && !hasFishingLanguage) return;

      reports.push({
        source: sourceName,
        date: date ?? new Date().toISOString().slice(0, 10),
        species,
        notes: compactSnippet(text),
        distance_offshore_miles: extractDistanceMiles(text),
        water_temp_f: extractWaterTempF(text),
        link: normalizedLink,
      });
    });
  }

  if (reports.length === 0) {
    failures.push(buildFailure(sourceName, sourceUrl, "No reports matched parser rules", compactSnippet($("body").text())));
  }

  return {
    reports: dedupeReports(reports),
    failures,
  };
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

function dedupeReports(reports: ParseResult["reports"]): ParseResult["reports"] {
  const seen = new Set<string>();
  return reports.filter((report) => {
    const key = `${report.date}|${report.notes}|${report.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
