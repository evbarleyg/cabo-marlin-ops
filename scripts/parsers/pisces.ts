import { parseBlogStyleReports } from "./blogFeed";
import { parsePiscesJsonFeed } from "./piscesJsonFeed";
import type { ParseResult } from "./types";

const SOURCE_NAME = "Pisces";

export function parsePiscesReports(html: string, sourceUrl: string): ParseResult {
  const payload = html.trim();
  if (payload.startsWith("{") || payload.startsWith("[")) {
    const parsed = parsePiscesJsonFeed(payload, sourceUrl);
    if (parsed.reports.length > 0) {
      return parsed;
    }
  }
  return parseBlogStyleReports(html, SOURCE_NAME, sourceUrl);
}
