import { clamp } from "@/lib/utils";

export type GoNoGoLabel = "Go" | "Caution" | "No-Go";

export interface GoNoGoInputs {
  waveHeightP90M: number;
  swellPeriodMedianS: number;
  currentVelocityMedianMS: number;
  sstFMedian: number;
}

export interface GoNoGoResult {
  score: number;
  label: GoNoGoLabel;
  penalties: {
    wave: number;
    swell: number;
    current: number;
    sst: number;
  };
}

export function computeGoNoGo(inputs: GoNoGoInputs): GoNoGoResult {
  let score = 100;

  const wavePenalty = inputs.waveHeightP90M > 2.4 ? 40 : inputs.waveHeightP90M > 1.8 ? 20 : 0;
  const swellPenalty = inputs.swellPeriodMedianS < 8 ? 10 : 0;
  const currentPenalty = inputs.currentVelocityMedianMS > 1.2 ? 15 : 0;
  const sstPenalty = inputs.sstFMedian < 72 || inputs.sstFMedian > 84 ? 10 : 0;

  score -= wavePenalty + swellPenalty + currentPenalty + sstPenalty;
  score = clamp(score, 0, 100);

  let label: GoNoGoLabel = "Go";
  if (score < 50) label = "No-Go";
  else if (score < 70) label = "Caution";

  return {
    score,
    label,
    penalties: {
      wave: wavePenalty,
      swell: swellPenalty,
      current: currentPenalty,
      sst: sstPenalty,
    },
  };
}

export interface BiteScoreInputs {
  marlinMentionsLast72h: number;
  sstF: number;
  waveHeightM: number;
  currentVelocityMS: number;
}

export interface BiteScoreBreakdown {
  marlinSignal: number;
  sstAlignment: number;
  waveComfort: number;
  currentAlignment: number;
}

export interface BiteScoreResult {
  score: number;
  breakdown: BiteScoreBreakdown;
  weights: {
    marlinSignal: number;
    sstAlignment: number;
    waveComfort: number;
    currentAlignment: number;
  };
}

const BITE_WEIGHTS = {
  marlinSignal: 0.6,
  sstAlignment: 0.15,
  waveComfort: 0.15,
  currentAlignment: 0.1,
} as const;

function scoreMarlinSignal(mentions: number): number {
  if (mentions >= 8) return 100;
  return clamp((mentions / 8) * 100, 0, 100);
}

function scoreSstAlignment(sstF: number): number {
  if (sstF >= 74 && sstF <= 82) return 100;
  const distance = Math.min(Math.abs(sstF - 74), Math.abs(sstF - 82));
  return clamp(100 - distance * 10, 0, 100);
}

function scoreWaveComfort(waveHeightM: number): number {
  if (waveHeightM <= 2) return 100;
  return clamp(100 - (waveHeightM - 2) * 35, 0, 100);
}

function scoreCurrentAlignment(currentVelocityMS: number): number {
  if (currentVelocityMS >= 0.3 && currentVelocityMS <= 1.0) return 100;
  const distance =
    currentVelocityMS < 0.3 ? 0.3 - currentVelocityMS : Math.max(0, currentVelocityMS - 1.0);
  return clamp(100 - distance * 80, 0, 100);
}

export function computeBiteScore(inputs: BiteScoreInputs): BiteScoreResult {
  const breakdown: BiteScoreBreakdown = {
    marlinSignal: scoreMarlinSignal(inputs.marlinMentionsLast72h),
    sstAlignment: scoreSstAlignment(inputs.sstF),
    waveComfort: scoreWaveComfort(inputs.waveHeightM),
    currentAlignment: scoreCurrentAlignment(inputs.currentVelocityMS),
  };

  const weighted =
    breakdown.marlinSignal * BITE_WEIGHTS.marlinSignal +
    breakdown.sstAlignment * BITE_WEIGHTS.sstAlignment +
    breakdown.waveComfort * BITE_WEIGHTS.waveComfort +
    breakdown.currentAlignment * BITE_WEIGHTS.currentAlignment;

  return {
    score: Math.round(clamp(weighted, 0, 100)),
    breakdown,
    weights: BITE_WEIGHTS,
  };
}
