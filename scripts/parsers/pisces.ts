import { parseBlogStyleReports } from "./blogFeed";
import type { ParseResult } from "./types";

const SOURCE_NAME = "Pisces";

export function parsePiscesReports(html: string, sourceUrl: string): ParseResult {
  return parseBlogStyleReports(html, SOURCE_NAME, sourceUrl);
}
