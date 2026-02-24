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

const SOURCE_NAME = "El Budster";

export function parseElBudsterReport(html: string, sourceUrl: string): ParseResult {
  const $ = load(html);
  const reports: ParseResult["reports"] = [];
  const failures: ParseResult["failures"] = [];

  const candidates = $("article p, article li, .entry-content p, .post p, main p, .report p, .report li")
    .map((_, element) => {
      const parentText = $(element).closest("article, section, div").first().find("h1, h2, h3").first().text().trim();
      const text = $(element).text().replace(/\s+/g, " ").trim();
      const link =
        $(element).find("a[href]").first().attr("href") ??
        $(element).closest("article, section, div").first().find("a[href]").first().attr("href");
      return {
        text: [parentText, text].filter(Boolean).join(" ").trim(),
        link,
      };
    })
    .get()
    .filter((item) => item.text.length > 45);

  for (const candidate of candidates) {
    const link = normalizeLink(candidate.link, sourceUrl);
    const date = extractIsoDate(candidate.text) ?? extractIsoDateFromUrl(link);
    const species = extractSpecies(candidate.text);
    const hasSignal = date !== null || species.length > 0;
    const hasLanguage = /(report|offshore|trip|bite|release|landed|caught)\b/i.test(candidate.text);
    if (!hasSignal && !hasLanguage) continue;
    reports.push({
      source: SOURCE_NAME,
      date: date ?? new Date().toISOString().slice(0, 10),
      species,
      notes: compactSnippet(candidate.text),
      distance_offshore_miles: extractDistanceMiles(candidate.text),
      water_temp_f: extractWaterTempF(candidate.text),
      link,
    });
  }

  if (reports.length === 0) {
    const bodySnippet = compactSnippet($("body").text());
    failures.push(buildFailure(SOURCE_NAME, sourceUrl, "No reports matched parser rules", bodySnippet));
  }

  return {
    reports: dedupeReports(reports),
    failures,
  };
}

function normalizeLink(link: string | undefined, fallback: string): string {
  if (!link) return fallback;
  try {
    return new URL(link, fallback).toString();
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
