import { load } from "cheerio";
import { buildFailure, compactSnippet, extractDistanceMiles, extractIsoDate, extractSpecies, extractWaterTempF } from "./shared";
import type { ParseResult } from "./types";

const SOURCE_NAME = "FishingBooker";

export function parseFishingBookerReports(html: string, sourceUrl: string): ParseResult {
  const $ = load(html);
  const reports: ParseResult["reports"] = [];
  const failures: ParseResult["failures"] = [];

  const cards = $("article, .report-card, .report-item, li")
    .map((_, element) => {
      const text = $(element).text().replace(/\s+/g, " ").trim();
      const timeAttr = $(element).find("time").first().attr("datetime");
      const href =
        $(element).find("a[href*='/reports/'], a[href*='report'], a[href]").first().attr("href") ?? sourceUrl;
      return { text, href, timeAttr };
    })
    .get()
    .filter((item) => item.text.length > 40);

  for (const card of cards) {
    const species = extractSpecies(card.text);
    const dateFromTime = card.timeAttr ? new Date(card.timeAttr).toISOString().slice(0, 10) : null;
    const date = dateFromTime ?? extractIsoDate(card.text);

    if (!date && species.length === 0) continue;

    reports.push({
      source: SOURCE_NAME,
      date: date ?? new Date().toISOString().slice(0, 10),
      species,
      notes: compactSnippet(card.text),
      distance_offshore_miles: extractDistanceMiles(card.text),
      water_temp_f: extractWaterTempF(card.text),
      link: normalizeLink(card.href, sourceUrl),
    });
  }

  if (reports.length === 0) {
    const snippet = compactSnippet($("body").text());
    failures.push(buildFailure(SOURCE_NAME, sourceUrl, "No reports matched parser rules", snippet));
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
