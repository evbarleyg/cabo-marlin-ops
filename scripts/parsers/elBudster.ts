import { load } from "cheerio";
import { buildFailure, compactSnippet, extractDistanceMiles, extractIsoDate, extractSpecies, extractWaterTempF } from "./shared";
import type { ParseResult } from "./types";

const SOURCE_NAME = "El Budster";

export function parseElBudsterReport(html: string, sourceUrl: string): ParseResult {
  const $ = load(html);
  const reports: ParseResult["reports"] = [];
  const failures: ParseResult["failures"] = [];

  const candidates = $("article p, .entry-content p, .post p, main p, li")
    .map((_, element) => {
      const text = $(element).text().replace(/\s+/g, " ").trim();
      const link = $(element).find("a[href]").first().attr("href");
      return { text, link };
    })
    .get()
    .filter((item) => item.text.length > 55);

  for (const candidate of candidates) {
    const date = extractIsoDate(candidate.text);
    const species = extractSpecies(candidate.text);
    if (!date && species.length === 0) continue;

    const link = normalizeLink(candidate.link, sourceUrl);
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
