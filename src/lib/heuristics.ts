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

export interface MarlinConditionsSummary {
  overall: "Favorable" | "Mixed" | "Marginal";
  summary: string;
  details: Array<{
    label: string;
    status: "ideal" | "workable" | "weak";
    detail: string;
  }>;
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

export function summarizeMarlinConditions(inputs: GoNoGoInputs): MarlinConditionsSummary {
  const details: MarlinConditionsSummary["details"] = [];

  if (inputs.sstFMedian >= 74 && inputs.sstFMedian <= 82) {
    details.push({ label: "SST", status: "ideal", detail: `SST is in the 74-82F sweet spot at ${inputs.sstFMedian.toFixed(1)}F.` });
  } else if (inputs.sstFMedian >= 72 && inputs.sstFMedian <= 84) {
    details.push({ label: "SST", status: "workable", detail: `SST is fishable at ${inputs.sstFMedian.toFixed(1)}F, but not in the strongest historical band.` });
  } else {
    details.push({ label: "SST", status: "weak", detail: `SST is outside the preferred range at ${inputs.sstFMedian.toFixed(1)}F.` });
  }

  if (inputs.waveHeightP90M <= 1.5) {
    details.push({ label: "Sea state", status: "ideal", detail: `Wave p90 is calm at ${inputs.waveHeightP90M.toFixed(2)}m.` });
  } else if (inputs.waveHeightP90M <= 2.0) {
    details.push({ label: "Sea state", status: "workable", detail: `Wave p90 is manageable at ${inputs.waveHeightP90M.toFixed(2)}m.` });
  } else {
    details.push({ label: "Sea state", status: "weak", detail: `Wave p90 is elevated at ${inputs.waveHeightP90M.toFixed(2)}m.` });
  }

  if (inputs.currentVelocityMedianMS >= 0.3 && inputs.currentVelocityMedianMS <= 1.0) {
    details.push({
      label: "Current",
      status: "ideal",
      detail: `Current is in a comfortable working range at ${inputs.currentVelocityMedianMS.toFixed(2)} m/s.`,
    });
  } else if (inputs.currentVelocityMedianMS <= 1.2) {
    details.push({
      label: "Current",
      status: "workable",
      detail: `Current is slightly strong but still workable at ${inputs.currentVelocityMedianMS.toFixed(2)} m/s.`,
    });
  } else {
    details.push({
      label: "Current",
      status: "weak",
      detail: `Current is strong enough to make spread control harder at ${inputs.currentVelocityMedianMS.toFixed(2)} m/s.`,
    });
  }

  if (inputs.swellPeriodMedianS >= 9) {
    details.push({
      label: "Swell period",
      status: "ideal",
      detail: `Swell period is clean at ${inputs.swellPeriodMedianS.toFixed(1)}s.`,
    });
  } else if (inputs.swellPeriodMedianS >= 8) {
    details.push({
      label: "Swell period",
      status: "workable",
      detail: `Swell period is acceptable at ${inputs.swellPeriodMedianS.toFixed(1)}s.`,
    });
  } else {
    details.push({
      label: "Swell period",
      status: "weak",
      detail: `Short-period swell at ${inputs.swellPeriodMedianS.toFixed(1)}s can make the ride choppy.`,
    });
  }

  const idealCount = details.filter((detail) => detail.status === "ideal").length;
  const weakCount = details.filter((detail) => detail.status === "weak").length;

  if (weakCount === 0 && idealCount >= 3) {
    return {
      overall: "Favorable",
      summary: "This looks like a favorable striped-marlin setup: good temperature, manageable sea state, and clean enough water movement to fish effectively.",
      details,
    };
  }

  if (weakCount <= 1) {
    return {
      overall: "Mixed",
      summary: "This is a workable marlin setup, but one variable is a little off the ideal band and should be monitored when you choose the fishing day.",
      details,
    };
  }

  return {
    overall: "Marginal",
    summary: "This setup is fishable only if the crew prioritizes comfort and conditions first; multiple variables are outside the preferred marlin pattern.",
    details,
  };
}
