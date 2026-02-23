import { parseBlogStyleReports } from "./blogFeed";
import type { ParseResult } from "./types";

const SOURCE_NAME = "Cabo Sportfishing Reports";

export function parseCaboSportfishingReports(html: string, sourceUrl: string): ParseResult {
  return parseBlogStyleReports(html, SOURCE_NAME, sourceUrl);
}
