export const DEFAULT_CONDUCTING_CONFIG = Object.freeze({
  targetBpm: 96,
  uiUpdateIntervalMs: 66,
  beatTracker: {
    dominantHand: "right",
    historySize: 72,
    minBeatGapMs: 260,
    minVisibility: 0.35,
    minAmplitude: 0.075,
    minDownwardVelocity: 0.22,
    minReboundVelocity: -0.015,
    pointSmoothing: 0.42,
    velocitySmoothing: 0.35,
  },
  tempoEstimator: {
    minBpm: 35,
    maxBpm: 240,
    maxBeats: 12,
    smoothing: 0.35,
    staleAfterMs: 3000,
  },
  dynamicsEstimator: {
    attack: 0.32,
    release: 0.12,
    speedReference: 2.4,
    amplitudeReference: 0.55,
    accelerationReference: 8,
  },
});

export function mergeConductingConfig(overrides = {}) {
  return {
    ...DEFAULT_CONDUCTING_CONFIG,
    ...overrides,
    targetBpm: overrides.targetBpm ?? DEFAULT_CONDUCTING_CONFIG.targetBpm,
    uiUpdateIntervalMs:
      overrides.uiUpdateIntervalMs ??
      DEFAULT_CONDUCTING_CONFIG.uiUpdateIntervalMs,
    beatTracker: {
      ...DEFAULT_CONDUCTING_CONFIG.beatTracker,
      ...overrides.beatTracker,
    },
    tempoEstimator: {
      ...DEFAULT_CONDUCTING_CONFIG.tempoEstimator,
      ...overrides.tempoEstimator,
    },
    dynamicsEstimator: {
      ...DEFAULT_CONDUCTING_CONFIG.dynamicsEstimator,
      ...overrides.dynamicsEstimator,
    },
  };
}
