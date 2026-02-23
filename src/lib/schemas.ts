import { z } from "zod";

export const sourceStatusSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  fetched_at: z.string().datetime(),
  ok: z.boolean(),
  error: z.string().optional(),
});

const envelopeBase = z.object({
  generated_at: z.string().datetime(),
  sources: z.array(sourceStatusSchema),
});

export const conditionsHourlyPointSchema = z.object({
  ts: z.string().datetime(),
  wave_height_m: z.number().nullable(),
  swell_wave_height_m: z.number().nullable(),
  swell_wave_direction_deg: z.number().nullable(),
  swell_wave_period_s: z.number().nullable(),
  ocean_current_velocity_m_s: z.number().nullable(),
  ocean_current_direction_deg: z.number().nullable(),
  sea_surface_temperature_c: z.number().nullable(),
  sea_surface_temperature_f: z.number().nullable(),
  sea_level_height_msl_m: z.number().nullable(),
});

export const goNoGoLabelSchema = z.enum(["Go", "Caution", "No-Go"]);

export const conditionsDaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wave_height_median: z.number(),
  wave_height_p90: z.number(),
  sst_f_median: z.number(),
  current_velocity_median: z.number(),
  go_no_go_score: z.number().min(0).max(100),
  go_no_go_label: goNoGoLabelSchema,
  rule_inputs: z.object({
    wave_height_p90_m: z.number(),
    swell_period_median_s: z.number(),
    current_velocity_median_m_s: z.number(),
    sst_median_f: z.number(),
  }),
});

export const conditionsDataSchema = z.object({
  location: z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
  }),
  trip: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fishing_days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  }),
  hourly: z.array(conditionsHourlyPointSchema),
  day_summaries: z.array(conditionsDaySummarySchema),
});

export const conditionsEnvelopeSchema = envelopeBase.extend({
  data: conditionsDataSchema,
});

export const biteReportSchema = z.object({
  source: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  species: z.array(z.string()),
  notes: z.string(),
  distance_offshore_miles: z.number().optional(),
  water_temp_f: z.number().optional(),
  link: z.string().url(),
});

export const parseFailureSchema = z.object({
  source: z.string(),
  link: z.string().url(),
  error: z.string(),
  snippet: z.string(),
});

export const biteReportsDataSchema = z.object({
  reports: z.array(biteReportSchema),
  parse_failures: z.array(parseFailureSchema),
  metrics: z.object({
    marlin_mentions_last_72h: z.number().int().min(0),
    weighted_marlin_signal_last_72h: z.number().min(0).default(0),
    trend_last_72h: z.array(
      z.object({
        bucket_ts: z.string().datetime(),
        mentions: z.number().int().min(0),
      }),
    ),
    daily_marlin_counts: z.array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        total_reports: z.number().int().min(0),
        marlin_mentions: z.number().int().min(0),
        weighted_marlin_signal: z.number().min(0).default(0),
      }),
    ),
    season_context: z.object({
      sample_days: z.number().int().min(0),
      sample_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sample_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      latest_report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      latest_day_total_reports: z.number().int().min(0),
      latest_day_marlin_mentions: z.number().int().min(0),
      latest_day_percentile: z.number().min(0).max(100),
      average_daily_marlin_mentions: z.number().min(0),
      p90_daily_marlin_mentions: z.number().min(0),
      latest_vs_average_ratio: z.number().min(0),
      latest_day_weighted_signal: z.number().min(0).default(0),
      average_daily_weighted_signal: z.number().min(0).default(0),
    }),
    source_quality: z.array(
      z.object({
        source: z.string(),
        confidence: z.number().min(0).max(1),
        total_reports: z.number().int().min(0),
        marlin_reports: z.number().int().min(0),
        weighted_marlin_signal: z.number().min(0),
      }),
    ).default([]),
  }),
});

export const biteReportsEnvelopeSchema = envelopeBase.extend({
  data: biteReportsDataSchema,
});

export const charterSeedEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  boat_length_ft: z.number().optional(),
  max_people: z.number().optional(),
  typical_trip_hours: z.number(),
  starting_price_usd: z.number().optional(),
  link: z.string().url(),
  book_direct_link: z.string().url().optional(),
});

export const charterSeedDataSchema = z.object({
  entries: z.array(charterSeedEntrySchema),
});

export const chartersSeedEnvelopeSchema = envelopeBase.extend({
  data: charterSeedDataSchema,
});

export const charterOutputEntrySchema = charterSeedEntrySchema.extend({
  normalized: z.object({
    price_per_hour_usd: z.number().optional(),
    price_per_angler_usd: z.number().optional(),
  }),
  price_band: z.enum(["low", "typical", "high", "unknown"]),
});

export const chartersDataSchema = z.object({
  entries: z.array(charterOutputEntrySchema),
  price_band_constants: z.object({
    low_max_usd_per_hour: z.number(),
    high_min_usd_per_hour: z.number(),
  }),
});

export const chartersEnvelopeSchema = envelopeBase.extend({
  data: chartersDataSchema,
});

export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type ConditionsEnvelope = z.infer<typeof conditionsEnvelopeSchema>;
export type ConditionsData = z.infer<typeof conditionsDataSchema>;
export type ConditionsDaySummary = z.infer<typeof conditionsDaySummarySchema>;
export type BiteReportsEnvelope = z.infer<typeof biteReportsEnvelopeSchema>;
export type BiteReport = z.infer<typeof biteReportSchema>;
export type ParseFailure = z.infer<typeof parseFailureSchema>;
export type ChartersSeedEnvelope = z.infer<typeof chartersSeedEnvelopeSchema>;
export type CharterSeedEntry = z.infer<typeof charterSeedEntrySchema>;
export type ChartersEnvelope = z.infer<typeof chartersEnvelopeSchema>;
export type CharterOutputEntry = z.infer<typeof charterOutputEntrySchema>;
