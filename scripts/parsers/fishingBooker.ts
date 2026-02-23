import { load } from "cheerio";
import { buildFailure, compactSnippet, extractDistanceMiles, extractIsoDate, extractSpecies, extractWaterTempF } from "./shared";
import type { ParseResult } from "./types";

const SOURCE_NAME = "FishingBooker";

export function parseFishingBookerReports(html: string, sourceUrl: string): ParseResult {
  const $ = load(html);
  const reports: ParseResult["reports"] = [];
  const failures: ParseResult["failures"] = [];

  const cards = [...collectFeedCards($, sourceUrl), ...collectJsonLdCards($, sourceUrl)];

  for (const card of cards) {
    const combinedText = [card.title, card.text].filter(Boolean).join(" ").trim();
    const notes = compactSnippet(combinedText);
    if (notes.length < 35) continue;

    const species = extractSpecies(combinedText);
    const date = parseDateHint(card.timeAttr) ?? extractIsoDate(combinedText);
    const link = normalizeLink(card.href, sourceUrl);
    const hasReportLink = /\/reports?\//i.test(link);
    const hasReportLanguage = /(report|trip|offshore|bite|release|landed|catch)\b/i.test(combinedText);

    if (!hasReportLink && !hasReportLanguage && !date && species.length === 0) continue;

    reports.push({
      source: SOURCE_NAME,
      date: date ?? new Date().toISOString().slice(0, 10),
      species,
      notes,
      distance_offshore_miles: extractDistanceMiles(combinedText),
      water_temp_f: extractWaterTempF(combinedText),
      link,
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

interface FishingBookerCard {
  title: string;
  text: string;
  href: string;
  timeAttr?: string | null;
}

function collectFeedCards($: ReturnType<typeof load>, sourceUrl: string): FishingBookerCard[] {
  const selectors = [
    ".reportFeed-item .panel",
    ".reportFeed-item",
    "article.report-card",
    "article[itemtype*='BlogPosting']",
    "article",
  ];
  const seen = new Set<string>();
  const cards: FishingBookerCard[] = [];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const root = $(element);
      const title = root.find(".title, [itemprop='headline'], h1, h2, h3").first().text().trim();
      const excerpt = root.find(".excerpt, [itemprop='description'], p").first().text().trim();
      const postMeta = root.find(".post, .meta, .date").first().text().trim();
      const bodyText = root.text().replace(/\s+/g, " ").trim();

      const text = [excerpt, postMeta, bodyText].filter(Boolean).join(" ").trim();
      const href =
        root.find(".content[href], a[href*='/reports/'], a[href*='report'], a[href]").first().attr("href") ?? sourceUrl;
      const timeAttr =
        root.find("time[datetime]").first().attr("datetime") ??
        root.find("[itemprop='datePublished']").first().attr("content") ??
        null;

      if (!text) return;
      const key = `${normalizeLink(href, sourceUrl)}|${compactSnippet([title, excerpt].join(" "))}`;
      if (seen.has(key)) return;
      seen.add(key);

      cards.push({
        title,
        text,
        href,
        timeAttr,
      });
    });
  }

  return cards;
}

function collectJsonLdCards($: ReturnType<typeof load>, sourceUrl: string): FishingBookerCard[] {
  const cards: FishingBookerCard[] = [];
  const seen = new Set<string>();

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    const parsed = safeJsonParse(raw);
    if (!parsed) return;

    const nodes = flattenJsonLdNodes(parsed);
    for (const node of nodes) {
      const type = Array.isArray(node["@type"]) ? node["@type"].join(" ") : String(node["@type"] ?? "");
      const isArticle = /(Article|BlogPosting|NewsArticle|Posting)/i.test(type);
      if (!isArticle) continue;

      const href = getUrl(node.url ?? node.mainEntityOfPage) ?? sourceUrl;
      const title = String(node.headline ?? "");
      const text = [node.description, node.articleBody].filter((item): item is string => typeof item === "string").join(" ");
      const timeAttr = typeof node.datePublished === "string" ? node.datePublished : typeof node.dateCreated === "string" ? node.dateCreated : null;

      const key = `${normalizeLink(href, sourceUrl)}|${compactSnippet(title)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      cards.push({
        title,
        text,
        href,
        timeAttr,
      });
    }
  });

  return cards;
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function flattenJsonLdNodes(input: unknown): Record<string, unknown>[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(flattenJsonLdNodes);
  if (typeof input !== "object") return [];

  const record = input as Record<string, unknown>;
  const nestedGraph = record["@graph"];
  const base = [record];
  if (!nestedGraph) return base;

  return [...base, ...flattenJsonLdNodes(nestedGraph)];
}

function getUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const asRecord = value as Record<string, unknown>;
    if (typeof asRecord.url === "string") return asRecord.url;
    if (typeof asRecord["@id"] === "string") return asRecord["@id"];
  }
  return null;
}

function parseDateHint(value: string | null | undefined): string | null {
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
