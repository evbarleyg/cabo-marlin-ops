import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PRICE_BAND_CONSTANTS, TRIP_WINDOW } from "../src/lib/constants";
import { computeGoNoGo } from "../src/lib/heuristics";
import {
  biteReportSchema,
  biteReportsEnvelopeSchema,
  chartersEnvelopeSchema,
  charterSeedDataSchema,
  chartersSeedEnvelopeSchema,
  conditionsEnvelopeSchema,
  type BiteReport,
  type ParseFailure,
  type SourceStatus,
} from "../src/lib/schemas";
import { bucketIsoHour, median, percentile } from "../src/lib/utils";
import { parseElBudsterReport } from "./parsers/elBudster";
import { parseFishingBookerReports } from "./parsers/fishingBooker";
import { parsePiscesReports } from "./parsers/pisces";
import { parseCaboSportfishingReports } from "./parsers/caboSportfishing";
import { PoliteHttpClient } from "./parsers/http";
import type { ParseResult } from "./parsers/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const DATA_DIR = path.join(projectRoot, "public", "data");
const CONDITIONS_FILE = path.join(DATA_DIR, "conditions.json");
const BITE_FILE = path.join(DATA_DIR, "biteReports.json");
const CHARTERS_SEED_FILE = path.join(DATA_DIR, "charters.seed.json");
const CHARTERS_FILE = path.join(DATA_DIR, "charters.json");
const CANONICAL_SEED_FILE = path.join(projectRoot, "src", "data", "charters.seed.json");

const DEFAULT_LOCATION = {
  name: "Cabo Marina",
  latitude: 22.879,
  longitude: -109.892,
};

function envPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

const USER_AGENT = "CaboMarlinOpsBot/1.0 (+https://github.com/evbarleyg/cabo-marlin-ops; data refresh bot)";
const MARLIN_SIGNAL_WINDOW_HOURS = 72;
const FISHING_BOOKER_MAX_PAGES = envPositiveInt("CMO_FISHINGBOOKER_MAX_PAGES", 80);
const WORDPRESS_ARCHIVE_MAX_PAGES = envPositiveInt("CMO_WORDPRESS_ARCHIVE_MAX_PAGES", 48);
const PAGINATION_EMPTY_STOP_STREAK = envPositiveInt("CMO_PAGINATION_EMPTY_STOP_STREAK", 2);
const PAGINATION_STALE_STOP_STREAK = envPositiveInt("CMO_PAGINATION_STALE_STOP_STREAK", 4);
const FISHING_BOOKER_DESTINATIONS = [
  { label: "Cabo San Lucas", slug: "cabo-san-lucas" },
  { label: "San Jose del Cabo", slug: "san-jose-del-cabo" },
  { label: "La Paz", slug: "la-paz" },
];

const SOURCE_CONFIDENCE = {
  "El Budster": 0.95,
  FishingBooker: 0.75,
  Pisces: 0.9,
  "Cabo Sportfishing Reports": 0.7,
} as const;

const openMeteoSchema = z.object({
  timezone: z.string(),
  hourly: z.object({
    time: z.array(z.string()),
    wave_height: z.array(z.number().nullable()),
    swell_wave_height: z.array(z.number().nullable()),
    swell_wave_direction: z.array(z.number().nullable()),
    swell_wave_period: z.array(z.number().nullable()),
    ocean_current_velocity: z.array(z.number().nullable()),
    ocean_current_direction: z.array(z.number().nullable()),
    sea_surface_temperature: z.array(z.number().nullable()),
    sea_level_height_msl: z.array(z.number().nullable()),
  }),
});

async function readJsonIfExists<T>(filePath: string, schema: z.ZodSchema<T>): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function numeric(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(value);
}

function toFahrenheit(celsius: number | null): number | null {
  if (celsius === null) return null;
  return celsius * (9 / 5) + 32;
}

function buildSourceStatus(name: string, url: string, fetchedAt: string, ok: boolean, error?: string): SourceStatus {
  return {
    name,
    url,
    fetched_at: fetchedAt,
    ok,
    ...(error ? { error } : {}),
  };
}

async function fetchConditions(generatedAt: string) {
  const previous = await readJsonIfExists(CONDITIONS_FILE, conditionsEnvelopeSchema);

  const params = new URLSearchParams({
    latitude: String(DEFAULT_LOCATION.latitude),
    longitude: String(DEFAULT_LOCATION.longitude),
    timezone: "auto",
    forecast_days: "10",
    cell_selection: "sea",
    hourly:
      "wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl",
  });
  const url = `https://marine-api.open-meteo.com/v1/marine?${params.toString()}`;

  let source = buildSourceStatus("Open-Meteo Marine", url, generatedAt, false, "Not fetched");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    const fetchedAt = new Date().toISOString();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const parsed = openMeteoSchema.parse(json);
    source = buildSourceStatus("Open-Meteo Marine", url, fetchedAt, true);

    const arrays = parsed.hourly;
    const length = Math.min(
      arrays.time.length,
      arrays.wave_height.length,
      arrays.swell_wave_height.length,
      arrays.swell_wave_direction.length,
      arrays.swell_wave_period.length,
      arrays.ocean_current_velocity.length,
      arrays.ocean_current_direction.length,
      arrays.sea_surface_temperature.length,
      arrays.sea_level_height_msl.length,
    );

    const hourly = Array.from({ length }).map((_, index) => {
      const sstC = numeric(arrays.sea_surface_temperature[index]);
      return {
        ts: new Date(arrays.time[index]).toISOString(),
        wave_height_m: numeric(arrays.wave_height[index]),
        swell_wave_height_m: numeric(arrays.swell_wave_height[index]),
        swell_wave_direction_deg: numeric(arrays.swell_wave_direction[index]),
        swell_wave_period_s: numeric(arrays.swell_wave_period[index]),
        ocean_current_velocity_m_s: numeric(arrays.ocean_current_velocity[index]),
        ocean_current_direction_deg: numeric(arrays.ocean_current_direction[index]),
        sea_surface_temperature_c: sstC,
        sea_surface_temperature_f: toFahrenheit(sstC),
        sea_level_height_msl_m: numeric(arrays.sea_level_height_msl[index]),
      };
    });

    const grouped = new Map<string, typeof hourly>();
    for (const point of hourly) {
      const date = point.ts.slice(0, 10);
      const bucket = grouped.get(date) ?? [];
      bucket.push(point);
      grouped.set(date, bucket);
    }

    const daySummaries = [...grouped.entries()].map(([date, values]) => {
      const waveValues = values
        .map((point) => point.wave_height_m)
        .filter((value): value is number => value !== null);
      const periodValues = values
        .map((point) => point.swell_wave_period_s)
        .filter((value): value is number => value !== null);
      const currentValues = values
        .map((point) => point.ocean_current_velocity_m_s)
        .filter((value): value is number => value !== null);
      const sstValues = values
        .map((point) => point.sea_surface_temperature_f)
        .filter((value): value is number => value !== null);

      const inputs = {
        waveHeightP90M: percentile(waveValues, 90),
        swellPeriodMedianS: median(periodValues),
        currentVelocityMedianMS: median(currentValues),
        sstFMedian: median(sstValues),
      };

      const goNoGo = computeGoNoGo(inputs);

      return {
        date,
        wave_height_median: median(waveValues),
        wave_height_p90: inputs.waveHeightP90M,
        sst_f_median: inputs.sstFMedian,
        current_velocity_median: inputs.currentVelocityMedianMS,
        go_no_go_score: goNoGo.score,
        go_no_go_label: goNoGo.label,
        rule_inputs: {
          wave_height_p90_m: inputs.waveHeightP90M,
          swell_period_median_s: inputs.swellPeriodMedianS,
          current_velocity_median_m_s: inputs.currentVelocityMedianMS,
          sst_median_f: inputs.sstFMedian,
        },
      };
    });

    const envelope = {
      generated_at: generatedAt,
      sources: [source],
      data: {
        location: {
          name: DEFAULT_LOCATION.name,
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          timezone: parsed.timezone,
        },
        trip: {
          start: TRIP_WINDOW.start,
          end: TRIP_WINDOW.end,
          fishing_days: [...TRIP_WINDOW.fishingDays],
        },
        hourly,
        day_summaries: daySummaries.sort((a, b) => a.date.localeCompare(b.date)),
      },
    };

    return conditionsEnvelopeSchema.parse(envelope);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conditions fetch failed";
    source = buildSourceStatus("Open-Meteo Marine", url, new Date().toISOString(), false, message);

    if (previous) {
      return conditionsEnvelopeSchema.parse({
        generated_at: generatedAt,
        sources: [source, ...previous.sources],
        data: previous.data,
      });
    }

    throw new Error(`Unable to build conditions data: ${message}`);
  }
}

function isMarlinSignal(report: BiteReport): boolean {
  const speciesMention = report.species.some((species) => species.toLowerCase().includes("marlin"));
  const notesMention = report.notes.toLowerCase().includes("marlin");
  return speciesMention || notesMention;
}

function reportDateMs(report: BiteReport): number {
  return new Date(`${report.date}T12:00:00Z`).getTime();
}

function getSourceConfidence(source: string): number {
  return SOURCE_CONFIDENCE[source as keyof typeof SOURCE_CONFIDENCE] ?? 0.65;
}

function extractMarlinMentionsLastHours(reports: BiteReport[], hours: number): number {
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;
  return reports.filter((report) => isMarlinSignal(report) && reportDateMs(report) >= cutoff).length;
}

function extractWeightedMarlinSignalLastHours(reports: BiteReport[], hours: number): number {
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;
  const weighted = reports
    .filter((report) => isMarlinSignal(report) && reportDateMs(report) >= cutoff)
    .reduce((sum, report) => sum + getSourceConfidence(report.source), 0);
  return Number(weighted.toFixed(2));
}

function buildTrend(reports: BiteReport[]): Array<{ bucket_ts: string; mentions: number }> {
  const now = Date.now();
  const windowStart = now - MARLIN_SIGNAL_WINDOW_HOURS * 60 * 60 * 1000;
  const bucketSizeMs = 12 * 60 * 60 * 1000;

  const marlinReportDates = reports
    .filter(isMarlinSignal)
    .map((report) => reportDateMs(report))
    .filter((time) => Number.isFinite(time));

  const buckets: Array<{ bucket_ts: string; mentions: number }> = [];
  for (let current = windowStart; current <= now; current += bucketSizeMs) {
    const next = current + bucketSizeMs;
    const mentions = marlinReportDates.filter((time) => time >= current && time < next).length;
    buckets.push({
      bucket_ts: bucketIsoHour(new Date(current)),
      mentions,
    });
  }
  return buckets;
}

function formatIsoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildDailyMarlinCounts(reports: BiteReport[]) {
  const grouped = new Map<string, { total_reports: number; marlin_mentions: number; weighted_marlin_signal: number }>();

  for (const report of reports) {
    const bucket = grouped.get(report.date) ?? { total_reports: 0, marlin_mentions: 0, weighted_marlin_signal: 0 };
    bucket.total_reports += 1;
    if (isMarlinSignal(report)) {
      bucket.marlin_mentions += 1;
      bucket.weighted_marlin_signal = Number((bucket.weighted_marlin_signal + getSourceConfidence(report.source)).toFixed(2));
    }
    grouped.set(report.date, bucket);
  }

  const now = new Date();
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const earliestDate = [...grouped.keys()].sort((a, b) => a.localeCompare(b))[0];
  const startDate = earliestDate ? new Date(`${earliestDate}T00:00:00Z`) : endDate;

  const denseSeries: Array<{ date: string; total_reports: number; marlin_mentions: number; weighted_marlin_signal: number }> = [];
  for (let cursor = startDate.getTime(); cursor <= endDate.getTime(); cursor += 24 * 60 * 60 * 1000) {
    const date = formatIsoDateFromMs(cursor);
    const values = grouped.get(date) ?? { total_reports: 0, marlin_mentions: 0, weighted_marlin_signal: 0 };
    denseSeries.push({
      date,
      total_reports: values.total_reports,
      marlin_mentions: values.marlin_mentions,
      weighted_marlin_signal: values.weighted_marlin_signal,
    });
  }

  return denseSeries;
}

function percentileRank(values: number[], target: number): number {
  if (values.length === 0) return 0;
  const lessOrEqual = values.filter((value) => value <= target).length;
  return Number(((lessOrEqual / values.length) * 100).toFixed(1));
}

function buildSeasonContext(
  dailyMarlinCounts: Array<{ date: string; total_reports: number; marlin_mentions: number; weighted_marlin_signal: number }>,
) {
  const today = new Date().toISOString().slice(0, 10);
  const activeDays = dailyMarlinCounts.filter((item) => item.total_reports > 0);
  if (activeDays.length === 0) {
    return {
      sample_days: 0,
      sample_start: today,
      sample_end: today,
      latest_report_date: today,
      latest_day_total_reports: 0,
      latest_day_marlin_mentions: 0,
      latest_day_percentile: 0,
      average_daily_marlin_mentions: 0,
      p90_daily_marlin_mentions: 0,
      latest_vs_average_ratio: 0,
      latest_day_weighted_signal: 0,
      average_daily_weighted_signal: 0,
    };
  }

  const marlinValues = activeDays.map((item) => item.marlin_mentions);
  const latest = activeDays[activeDays.length - 1];
  const avg = marlinValues.reduce((sum, value) => sum + value, 0) / marlinValues.length;
  const latestVsAverage = avg > 0 ? latest.marlin_mentions / avg : latest.marlin_mentions > 0 ? latest.marlin_mentions : 0;

  return {
    sample_days: activeDays.length,
    sample_start: activeDays[0].date,
    sample_end: latest.date,
    latest_report_date: latest.date,
    latest_day_total_reports: latest.total_reports,
    latest_day_marlin_mentions: latest.marlin_mentions,
    latest_day_percentile: percentileRank(marlinValues, latest.marlin_mentions),
    average_daily_marlin_mentions: Number(avg.toFixed(2)),
    p90_daily_marlin_mentions: Number(percentile(marlinValues, 90).toFixed(2)),
    latest_vs_average_ratio: Number(latestVsAverage.toFixed(2)),
    latest_day_weighted_signal: Number(latest.weighted_marlin_signal.toFixed(2)),
    average_daily_weighted_signal: Number(
      (activeDays.reduce((sum, item) => sum + item.weighted_marlin_signal, 0) / activeDays.length).toFixed(2),
    ),
  };
}

function buildSourceQualitySummary(reports: BiteReport[]) {
  const grouped = new Map<
    string,
    { source: string; confidence: number; total_reports: number; marlin_reports: number; weighted_marlin_signal: number }
  >();

  for (const report of reports) {
    const source = report.source;
    const confidence = getSourceConfidence(source);
    const bucket = grouped.get(source) ?? {
      source,
      confidence,
      total_reports: 0,
      marlin_reports: 0,
      weighted_marlin_signal: 0,
    };
    bucket.total_reports += 1;
    if (isMarlinSignal(report)) {
      bucket.marlin_reports += 1;
      bucket.weighted_marlin_signal = Number((bucket.weighted_marlin_signal + confidence).toFixed(2));
    }
    grouped.set(source, bucket);
  }

  return [...grouped.values()].sort((a, b) => b.weighted_marlin_signal - a.weighted_marlin_signal);
}

type ParseFn = (html: string, sourceUrl: string) => ParseResult;

interface SingleSourceTarget {
  kind: "single";
  sourceName: string;
  sourceLabel: string;
  url: string;
  parse: ParseFn;
}

interface PaginatedSourceTarget {
  kind: "paginated";
  sourceName: string;
  sourceLabel: string;
  maxPages: number;
  buildUrl: (page: number) => string;
  parse: ParseFn;
}

type SourceTarget = SingleSourceTarget | PaginatedSourceTarget;

function wordpressArchiveUrl(baseUrl: string, page: number): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return page === 1 ? `${normalized}/` : `${normalized}/page/${page}/`;
}

function reportIdentityKey(report: BiteReport): string {
  const linkKey = canonicalizeLinkForKey(report.link);
  const noteKey = normalizeNotesForKey(report.notes);
  return `${report.date}|${linkKey}|${noteKey}`;
}

function ingestParsedReports(
  parsed: ParseResult,
  sourceLabel: string,
  targetSeenKeys: Set<string>,
  targetReports: BiteReport[],
): number {
  let accepted = 0;
  for (const report of parsed.reports) {
    const check = biteReportSchema.safeParse({
      ...report,
      source: sourceLabel,
    });
    if (!check.success) continue;

    const key = reportIdentityKey(check.data);
    if (targetSeenKeys.has(key)) continue;
    targetSeenKeys.add(key);
    targetReports.push(check.data);
    accepted += 1;
  }
  return accepted;
}

async function fetchBiteReports(generatedAt: string) {
  const previous = await readJsonIfExists(BITE_FILE, biteReportsEnvelopeSchema);
  const client = new PoliteHttpClient({ userAgent: USER_AGENT, minDelayMs: 500, maxDelayMs: 1000 });

  const targets: SourceTarget[] = [
    {
      kind: "single",
      sourceName: "El Budster",
      sourceLabel: "El Budster",
      url: "https://www.elbudster.com/report",
      parse: parseElBudsterReport,
    },
    {
      kind: "paginated",
      sourceName: "Pisces Weekly Reports",
      sourceLabel: "Pisces",
      maxPages: WORDPRESS_ARCHIVE_MAX_PAGES,
      buildUrl: (page) => wordpressArchiveUrl("https://www.piscessportfishing.com/fishing-reports/", page),
      parse: parsePiscesReports,
    },
    {
      kind: "paginated",
      sourceName: "Pisces Marlin Reports",
      sourceLabel: "Pisces",
      maxPages: WORDPRESS_ARCHIVE_MAX_PAGES,
      buildUrl: (page) => wordpressArchiveUrl("https://www.piscessportfishing.com/tag/marlin/", page),
      parse: parsePiscesReports,
    },
    {
      kind: "paginated",
      sourceName: "Cabo Sportfishing Reports",
      sourceLabel: "Cabo Sportfishing Reports",
      maxPages: WORDPRESS_ARCHIVE_MAX_PAGES,
      buildUrl: (page) => wordpressArchiveUrl("https://cabosportfishingcrew.com/cabo-fishing-reports/", page),
      parse: parseCaboSportfishingReports,
    },
    ...FISHING_BOOKER_DESTINATIONS.map<PaginatedSourceTarget>((destination) => ({
      kind: "paginated",
      sourceName: `FishingBooker ${destination.label}`,
      sourceLabel: "FishingBooker",
      maxPages: FISHING_BOOKER_MAX_PAGES,
      buildUrl: (page) =>
        `https://fishingbooker.com/reports/destination/mx/BS/${destination.slug}?page=1&limit=6&offset=${page}`,
      parse: parseFishingBookerReports,
    })),
  ];

  const reports: BiteReport[] = [];
  const failures: ParseFailure[] = [];
  const sources: SourceStatus[] = [];

  for (const target of targets) {
    const targetSeenKeys = new Set<string>();

    if (target.kind === "single") {
      const response = await client.get(target.url);
      if (!response.ok) {
        sources.push(buildSourceStatus(target.sourceName, target.url, response.fetchedAt, false, response.error));
        failures.push({
          source: target.sourceName,
          link: target.url,
          error: response.error ?? "Fetch failed",
          snippet: "",
        });
        continue;
      }

      const parsed = target.parse(response.text, target.url);
      const parseError = parsed.reports.length === 0 && parsed.failures.length > 0 ? parsed.failures[0].error : undefined;
      sources.push(buildSourceStatus(target.sourceName, target.url, response.fetchedAt, !parseError, parseError));
      ingestParsedReports(parsed, target.sourceLabel, targetSeenKeys, reports);
      failures.push(...parsed.failures);
      continue;
    }

    let emptyStreak = 0;
    let staleStreak = 0;
    for (let page = 1; page <= target.maxPages; page += 1) {
      const pageUrl = target.buildUrl(page);
      const pageSourceName = `${target.sourceName} page ${page}`;
      const response = await client.get(pageUrl);

      if (!response.ok) {
        sources.push(buildSourceStatus(pageSourceName, pageUrl, response.fetchedAt, false, response.error));
        failures.push({
          source: pageSourceName,
          link: pageUrl,
          error: response.error ?? "Fetch failed",
          snippet: "",
        });
        break;
      }

      const parsed = target.parse(response.text, pageUrl);
      const parseError = parsed.reports.length === 0 && parsed.failures.length > 0 ? parsed.failures[0].error : undefined;
      sources.push(buildSourceStatus(pageSourceName, pageUrl, response.fetchedAt, !parseError, parseError));

      const acceptedCount = ingestParsedReports(parsed, target.sourceLabel, targetSeenKeys, reports);
      failures.push(...parsed.failures);

      if (parsed.reports.length === 0) {
        emptyStreak += 1;
      } else {
        emptyStreak = 0;
      }

      if (acceptedCount === 0) {
        staleStreak += 1;
      } else {
        staleStreak = 0;
      }

      if (emptyStreak >= PAGINATION_EMPTY_STOP_STREAK || staleStreak >= PAGINATION_STALE_STOP_STREAK) {
        break;
      }
    }
  }

  const mergedReports = dedupeBiteReports([...(previous?.data.reports ?? []), ...reports])
    .sort((a, b) => b.date.localeCompare(a.date));

  const effectiveReports = mergedReports.length > 0 ? mergedReports : previous?.data.reports ?? [];
  if (effectiveReports.length === 0 && (previous?.data.reports.length ?? 0) === 0) {
    const atLeastOneSuccess = sources.some((source) => source.ok);
    if (!atLeastOneSuccess) {
      throw new Error("Unable to produce biteReports.json: all sources failed and no prior snapshot exists");
    }
  }

  const dailyMarlinCounts = buildDailyMarlinCounts([...effectiveReports].sort((a, b) => a.date.localeCompare(b.date)));
  const seasonContext = buildSeasonContext(dailyMarlinCounts);
  const sourceQuality = buildSourceQualitySummary(effectiveReports);

  const envelope = {
    generated_at: generatedAt,
    sources,
    data: {
      reports: effectiveReports,
      parse_failures: failures.slice(0, 50),
      metrics: {
        marlin_mentions_last_72h: extractMarlinMentionsLastHours(effectiveReports, MARLIN_SIGNAL_WINDOW_HOURS),
        weighted_marlin_signal_last_72h: extractWeightedMarlinSignalLastHours(effectiveReports, MARLIN_SIGNAL_WINDOW_HOURS),
        trend_last_72h: buildTrend(effectiveReports),
        daily_marlin_counts: dailyMarlinCounts,
        season_context: seasonContext,
        source_quality: sourceQuality,
      },
    },
  };

  return biteReportsEnvelopeSchema.parse(envelope);
}

function dedupeBiteReports(reports: BiteReport[]): BiteReport[] {
  const seen = new Set<string>();
  return reports.filter((report) => {
    const linkKey = canonicalizeLinkForKey(report.link);
    const noteKey = normalizeNotesForKey(report.notes);
    const strictKey = `${report.date}|${linkKey}|${noteKey}`;
    const looseKey = `${report.date}|${noteKey}`;
    if (seen.has(strictKey) || seen.has(looseKey)) return false;
    seen.add(strictKey);
    seen.add(looseKey);
    return true;
  });
}

function canonicalizeLinkForKey(link: string): string {
  try {
    const url = new URL(link);
    url.search = "";
    url.hash = "";
    if (url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString().toLowerCase();
  } catch {
    return link.trim().toLowerCase();
  }
}

function normalizeNotesForKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 18)
    .join(" ");
}

async function buildChartersData(generatedAt: string) {
  const rawSeed = await readFile(CANONICAL_SEED_FILE, "utf8");
  const seedData = charterSeedDataSchema.parse(JSON.parse(rawSeed));

  const source = buildSourceStatus(
    "Seed file",
    "https://github.com/evbarleyg/cabo-marlin-ops/blob/main/src/data/charters.seed.json",
    generatedAt,
    true,
  );

  const seedEnvelope = chartersSeedEnvelopeSchema.parse({
    generated_at: generatedAt,
    sources: [source],
    data: seedData,
  });

  const enrichedEntries = seedData.entries.map((entry) => {
    const pricePerHour =
      entry.starting_price_usd !== undefined ? Number((entry.starting_price_usd / entry.typical_trip_hours).toFixed(2)) : undefined;
    const pricePerAngler =
      entry.starting_price_usd !== undefined && entry.max_people
        ? Number((entry.starting_price_usd / entry.max_people).toFixed(2))
        : undefined;

    let band: "low" | "typical" | "high" | "unknown" = "unknown";
    if (pricePerHour !== undefined) {
      if (pricePerHour <= PRICE_BAND_CONSTANTS.lowMaxUsdPerHour) band = "low";
      else if (pricePerHour >= PRICE_BAND_CONSTANTS.highMinUsdPerHour) band = "high";
      else band = "typical";
    }

    return {
      ...entry,
      normalized: {
        ...(pricePerHour !== undefined ? { price_per_hour_usd: pricePerHour } : {}),
        ...(pricePerAngler !== undefined ? { price_per_angler_usd: pricePerAngler } : {}),
      },
      price_band: band,
    };
  });

  const chartersEnvelope = chartersEnvelopeSchema.parse({
    generated_at: generatedAt,
    sources: [source],
    data: {
      entries: enrichedEntries,
      price_band_constants: {
        low_max_usd_per_hour: PRICE_BAND_CONSTANTS.lowMaxUsdPerHour,
        high_min_usd_per_hour: PRICE_BAND_CONSTANTS.highMinUsdPerHour,
      },
    },
  });

  return {
    seedEnvelope,
    chartersEnvelope,
  };
}

async function main() {
  const generatedAt = new Date().toISOString();

  const [conditions, biteReports, charters] = await Promise.all([
    fetchConditions(generatedAt),
    fetchBiteReports(generatedAt),
    buildChartersData(generatedAt),
  ]);

  await Promise.all([
    writeJson(CONDITIONS_FILE, conditions),
    writeJson(BITE_FILE, biteReports),
    writeJson(CHARTERS_SEED_FILE, charters.seedEnvelope),
    writeJson(CHARTERS_FILE, charters.chartersEnvelope),
  ]);

  console.log("Cabo Marlin Ops data refresh complete.");
  console.log(`Generated at: ${generatedAt}`);
  console.log(`Conditions sources: ${conditions.sources.length}`);
  console.log(`Bite reports: ${biteReports.data.reports.length}`);
  console.log(`Charters: ${charters.chartersEnvelope.data.entries.length}`);
}

main().catch((error) => {
  console.error("Data refresh failed", error);
  process.exitCode = 1;
});
