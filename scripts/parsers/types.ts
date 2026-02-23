export interface NormalizedBiteReport {
  source: string;
  date: string;
  species: string[];
  notes: string;
  distance_offshore_miles?: number;
  water_temp_f?: number;
  link: string;
}

export interface ParseFailure {
  source: string;
  link: string;
  error: string;
  snippet: string;
}

export interface ParseResult {
  reports: NormalizedBiteReport[];
  failures: ParseFailure[];
}
