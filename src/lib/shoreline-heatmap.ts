import type { BiteReport } from "@/lib/schemas";

export type SeasonKey = "all" | "winter" | "spring" | "summer" | "fall";

type ZoneKey = "pacific_bank" | "golden_gate" | "corridor" | "gordo_banks" | "east_cape";

export interface SeasonOption {
  key: SeasonKey;
  label: string;
}

export interface ShoreDistanceBand {
  key: "nearshore" | "inshore" | "offshore" | "far_offshore";
  label: string;
  minMiles: number;
  maxMiles: number;
}

export interface SpeciesLayerOption {
  species: string;
  count: number;
  color: string;
}

export interface SpeciesHeatBand {
  key: ShoreDistanceBand["key"];
  label: string;
  minMiles: number;
  maxMiles: number;
  reportCount: number;
  intensity: number;
}

export interface SpeciesHeatCell {
  lat: number;
  lng: number;
  bandKey: ShoreDistanceBand["key"];
  zoneKey?: string;
  intensity: number;
}

export interface SpeciesHeatLayer {
  species: string;
  color: string;
  totalReports: number;
  rangedReports: number;
  bands: SpeciesHeatBand[];
  cells: SpeciesHeatCell[];
}

interface HeatGridPoint {
  lat: number;
  lng: number;
  bandKey: ShoreDistanceBand["key"];
  zoneKey: ZoneKey;
  zoneDistanceMiles: number;
}

interface HotspotZone {
  key: ZoneKey;
  label: string;
  center: [number, number];
  radiusMiles: number;
  keywords: string[];
}

const EARTH_RADIUS_M = 6371000;
const GRID_MIN_LAT = 22.66;
const GRID_MAX_LAT = 23.08;
const GRID_MIN_LNG = -110.27;
const GRID_MAX_LNG = -109.52;
const GRID_STEP_LAT = 0.018;
const GRID_STEP_LNG = 0.022;

const COLOR_PALETTE = ["#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#3b82f6"] as const;

const HOTSPOT_ZONES: HotspotZone[] = [
  {
    key: "pacific_bank",
    label: "Pacific Banks",
    center: [22.89, -110.19],
    radiusMiles: 21,
    keywords: ["pacific", "san jaime", "todos santos", "cerro", "lighthouse"],
  },
  {
    key: "golden_gate",
    label: "Golden Gate",
    center: [22.91, -110.09],
    radiusMiles: 18,
    keywords: ["golden gate", "95 spot", "1150", "1150 bank", "gate"],
  },
  {
    key: "corridor",
    label: "Tourist Corridor",
    center: [22.88, -109.96],
    radiusMiles: 17,
    keywords: ["corridor", "chileno", "santa maria", "medano", "inshore", "shoreline", "beach"],
  },
  {
    key: "gordo_banks",
    label: "Gordo Banks",
    center: [23.01, -109.73],
    radiusMiles: 22,
    keywords: ["gordo", "vinorama", "la ribera", "east cape", "banks"],
  },
  {
    key: "east_cape",
    label: "East Cape",
    center: [23.03, -109.64],
    radiusMiles: 21,
    keywords: ["east cape", "buena vista", "los barriles", "la paz"],
  },
];

const HOTSPOT_BY_KEY = new Map(HOTSPOT_ZONES.map((zone) => [zone.key, zone]));

export const SEASON_OPTIONS: SeasonOption[] = [
  { key: "all", label: "All Year" },
  { key: "winter", label: "Winter" },
  { key: "spring", label: "Spring" },
  { key: "summer", label: "Summer" },
  { key: "fall", label: "Fall" },
];

export const SHORE_DISTANCE_BANDS: ShoreDistanceBand[] = [
  { key: "nearshore", label: "Nearshore 0-10 mi", minMiles: 0, maxMiles: 10 },
  { key: "inshore", label: "Inshore 10-20 mi", minMiles: 10, maxMiles: 20 },
  { key: "offshore", label: "Offshore 20-35 mi", minMiles: 20, maxMiles: 35 },
  { key: "far_offshore", label: "Far Offshore 35-55 mi", minMiles: 35, maxMiles: 55 },
];

export const CABO_SHORELINE_POLYLINE: Array<[number, number]> = [
  [22.954, -110.164],
  [22.933, -110.143],
  [22.913, -110.12],
  [22.898, -110.098],
  [22.886, -110.079],
  [22.877, -110.06],
  [22.87, -110.041],
  [22.865, -110.021],
  [22.861, -110.001],
  [22.859, -109.98],
  [22.86, -109.958],
  [22.865, -109.936],
  [22.873, -109.914],
  [22.884, -109.892],
  [22.898, -109.868],
  [22.914, -109.842],
  [22.931, -109.814],
  [22.947, -109.787],
];

export const CABO_LAND_POLYGON: Array<[number, number]> = [
  [23.12, -110.27],
  [23.12, -109.52],
  [22.97, -109.57],
  [22.91, -109.67],
  [22.875, -109.79],
  [22.848, -109.93],
  [22.845, -110.07],
  [22.872, -110.18],
  [22.94, -110.25],
  [23.12, -110.27],
];

export function seasonFromDate(date: string): SeasonKey {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return "all";
  const month = parsed.getUTCMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

export function collectSpeciesLayerOptions(reports: BiteReport[], limit = 8): SpeciesLayerOption[] {
  const counts = new Map<string, number>();

  for (const report of reports) {
    const speciesSet = new Set(
      report.species
        .map((species) => species.trim().toLowerCase())
        .filter(Boolean),
    );
    for (const species of speciesSet) {
      counts.set(species, (counts.get(species) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([species, count], index) => ({
      species,
      count,
      color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    }));
}

export function buildSpeciesHeatLayers({
  reports,
  season,
  selectedSpecies,
}: {
  reports: BiteReport[];
  season: SeasonKey;
  selectedSpecies: SpeciesLayerOption[];
}): SpeciesHeatLayer[] {
  const seasonFiltered = reports.filter((report) => season === "all" || seasonFromDate(report.date) === season);

  return selectedSpecies.map((speciesLayer) => {
    const speciesReports = seasonFiltered.filter((report) =>
      report.species.some((species) => isSpeciesMatch(species, speciesLayer.species)),
    );

    const distanceCounts = new Map<ShoreDistanceBand["key"], number>(SHORE_DISTANCE_BANDS.map((band) => [band.key, 0]));
    const zoneCounts = new Map<ZoneKey, number>(HOTSPOT_ZONES.map((zone) => [zone.key, 0]));
    let rangedReports = 0;

    for (const report of speciesReports) {
      const estimatedDistance = report.distance_offshore_miles ?? defaultDistanceForSpecies(speciesLayer.species);
      const band = bandForDistance(estimatedDistance);
      distanceCounts.set(band.key, (distanceCounts.get(band.key) ?? 0) + 1);
      if (report.distance_offshore_miles !== undefined) rangedReports += 1;

      const zoneKey = inferZoneForReport(report, speciesLayer.species);
      zoneCounts.set(zoneKey, (zoneCounts.get(zoneKey) ?? 0) + 1);
    }

    const maxDistanceCount = Math.max(1, ...distanceCounts.values());
    const bands: SpeciesHeatBand[] = SHORE_DISTANCE_BANDS.map((band) => {
      const reportCount = distanceCounts.get(band.key) ?? 0;
      return {
        key: band.key,
        label: band.label,
        minMiles: band.minMiles,
        maxMiles: band.maxMiles,
        reportCount,
        intensity: reportCount / maxDistanceCount,
      };
    });

    const bandIntensity = new Map<ShoreDistanceBand["key"], number>(bands.map((band) => [band.key, band.intensity]));
    const maxZoneCount = Math.max(1, ...zoneCounts.values());
    const zoneIntensity = new Map<ZoneKey, number>([...zoneCounts.entries()].map(([key, count]) => [key, count / maxZoneCount]));

    const cells = HEAT_GRID_TEMPLATE.flatMap((point) => {
      const bandScore = bandIntensity.get(point.bandKey) ?? 0;
      const zoneScore = zoneIntensity.get(point.zoneKey) ?? 0;
      if (bandScore <= 0.03 || zoneScore <= 0.03) return [];

      const zone = HOTSPOT_BY_KEY.get(point.zoneKey);
      if (!zone) return [];

      const zoneDistanceFactor = clamp01(1 - point.zoneDistanceMiles / Math.max(1, zone.radiusMiles));
      const blendedScore = bandScore * 0.42 + zoneScore * 0.38 + zoneDistanceFactor * 0.2;
      const intensity = clamp01(blendedScore * (0.55 + zoneScore * 0.45));

      if (intensity <= 0.09) return [];
      return [
        {
          lat: point.lat,
          lng: point.lng,
          bandKey: point.bandKey,
          zoneKey: point.zoneKey,
          intensity: Number(intensity.toFixed(4)),
        },
      ];
    });

    return {
      species: speciesLayer.species,
      color: speciesLayer.color,
      totalReports: speciesReports.length,
      rangedReports,
      bands,
      cells,
    };
  });
}

function buildGridTemplate(): HeatGridPoint[] {
  const points: HeatGridPoint[] = [];

  for (let lat = GRID_MIN_LAT; lat <= GRID_MAX_LAT; lat += GRID_STEP_LAT) {
    for (let lng = GRID_MIN_LNG; lng <= GRID_MAX_LNG; lng += GRID_STEP_LNG) {
      if (isPointInPolygon(lat, lng, CABO_LAND_POLYGON)) continue;

      const shorelineDistance = distanceFromShorelineMiles(lat, lng);
      const band = bandForDistance(shorelineDistance);
      const nearestZone = nearestZoneForPoint(lat, lng);

      points.push({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        bandKey: band.key,
        zoneKey: nearestZone.key,
        zoneDistanceMiles: nearestZone.distanceMiles,
      });
    }
  }

  return points;
}

function bandForDistance(distanceMiles: number): ShoreDistanceBand {
  return (
    SHORE_DISTANCE_BANDS.find((band) => distanceMiles >= band.minMiles && distanceMiles < band.maxMiles) ??
    SHORE_DISTANCE_BANDS[SHORE_DISTANCE_BANDS.length - 1]
  );
}

function isSpeciesMatch(value: string, target: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  const normalizedTarget = target.trim().toLowerCase();
  if (normalizedValue === normalizedTarget) return true;
  return normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue);
}

function defaultDistanceForSpecies(species: string): number {
  const normalized = species.toLowerCase();
  if (normalized.includes("striped marlin") || normalized.includes("blue marlin") || normalized.includes("black marlin")) return 28;
  if (normalized.includes("marlin")) return 24;
  if (normalized.includes("tuna")) return 22;
  if (normalized.includes("dorado") || normalized.includes("mahi")) return 16;
  if (normalized.includes("wahoo") || normalized.includes("sailfish")) return 26;
  if (normalized.includes("roosterfish") || normalized.includes("snapper") || normalized.includes("amberjack")) return 10;
  return 20;
}

function inferZoneForReport(report: BiteReport, speciesLayer: string): ZoneKey {
  const note = report.notes.toLowerCase();

  for (const zone of HOTSPOT_ZONES) {
    if (zone.keywords.some((keyword) => note.includes(keyword))) {
      return zone.key;
    }
  }

  const preferredZones = preferredZonesForSpecies(speciesLayer);
  const hashInput = `${report.link}|${report.date}|${report.notes.slice(0, 96)}|${speciesLayer}`;
  const seed = hashString(hashInput);
  return preferredZones[seed % preferredZones.length];
}

function preferredZonesForSpecies(species: string): ZoneKey[] {
  const normalized = species.toLowerCase();
  if (normalized.includes("marlin")) return ["gordo_banks", "golden_gate", "pacific_bank"];
  if (normalized.includes("tuna")) return ["gordo_banks", "corridor", "east_cape"];
  if (normalized.includes("dorado") || normalized.includes("mahi")) return ["corridor", "east_cape", "pacific_bank"];
  if (normalized.includes("wahoo") || normalized.includes("sailfish")) return ["golden_gate", "pacific_bank", "gordo_banks"];
  if (normalized.includes("roosterfish") || normalized.includes("snapper") || normalized.includes("amberjack")) {
    return ["corridor", "pacific_bank", "golden_gate"];
  }
  return ["corridor", "gordo_banks", "pacific_bank", "golden_gate", "east_cape"];
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function nearestZoneForPoint(lat: number, lng: number): { key: ZoneKey; distanceMiles: number } {
  let best = HOTSPOT_ZONES[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const zone of HOTSPOT_ZONES) {
    const distance = haversineMiles(lat, lng, zone.center[0], zone.center[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = zone;
    }
  }

  return { key: best.key, distanceMiles: bestDistance };
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (EARTH_RADIUS_M * c) / 1609.34;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distanceFromShorelineMiles(lat: number, lng: number): number {
  const anchor = CABO_SHORELINE_POLYLINE[0];
  const originLat = anchor[0];
  const originLng = anchor[1];
  const point = toMeters(lat, lng, originLat, originLng);

  let minDistanceM = Number.POSITIVE_INFINITY;
  for (let index = 0; index < CABO_SHORELINE_POLYLINE.length - 1; index += 1) {
    const start = CABO_SHORELINE_POLYLINE[index];
    const end = CABO_SHORELINE_POLYLINE[index + 1];
    const startM = toMeters(start[0], start[1], originLat, originLng);
    const endM = toMeters(end[0], end[1], originLat, originLng);
    minDistanceM = Math.min(minDistanceM, pointToSegmentDistance(point.x, point.y, startM.x, startM.y, endM.x, endM.y));
  }

  return minDistanceM / 1609.34;
}

function toMeters(lat: number, lng: number, originLat: number, originLng: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const originLatRad = (originLat * Math.PI) / 180;
  const deltaLatRad = ((lat - originLat) * Math.PI) / 180;
  const deltaLngRad = ((lng - originLng) * Math.PI) / 180;

  return {
    x: EARTH_RADIUS_M * deltaLngRad * Math.cos((latRad + originLatRad) / 2),
    y: EARTH_RADIUS_M * deltaLatRad,
  };
}

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const projection = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  const t = Math.max(0, Math.min(1, projection));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function isPointInPolygon(lat: number, lng: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

const HEAT_GRID_TEMPLATE = buildGridTemplate();
