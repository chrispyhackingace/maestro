const DEFAULT_OPTIONS =
  Object.freeze({
    dominantHand: "right",
    historySize: 60,
    minBeatGapMs: 280,
    minVisibility: 0.35,
    minAmplitude: 0.025,
    minDownwardVelocity: 0.1,
    minReboundVelocity: -0.005,
    pointSmoothing: 0.42,
    velocitySmoothing: 0.36,
    maximumStrokeMs: 1000,
  });

function clamp(
  value,
  min = 0,
  max = 1,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function lerp(
  previous,
  next,
  alpha,
) {
  return (
    previous +
    (next - previous) *
      alpha
  );
}

function distance2d(a, b) {
  if (!a || !b) {
    return 0;
  }

  return Math.hypot(
    a.x - b.x,
    a.y - b.y,
  );
}

function pointIsUsable(
  point,
  minVisibility,
) {
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return false;
  }

  const confidence =
    point.visibility ??
    point.presence ??
    1;

  return (
    confidence >=
    minVisibility
  );
}

function copyPoint(point) {
  return {
    x: point.x,
    y: point.y,
    z:
      Number.isFinite(point.z)
        ? point.z
        : 0,
    visibility:
      point.visibility ??
      point.presence ??
      1,
  };
}

function smoothPoint(
  point,
  previous,
  alpha,
) {
  if (!previous?.point) {
    return copyPoint(point);
  }

  return {
    x: lerp(
      previous.point.x,
      point.x,
      alpha,
    ),

    y: lerp(
      previous.point.y,
      point.y,
      alpha,
    ),

    z: lerp(
      previous.point.z,
      Number.isFinite(point.z)
        ? point.z
        : 0,
      alpha,
    ),

    visibility:
      point.visibility ??
      point.presence ??
      1,
  };
}

function inactiveSample(
  timestamp,
) {
  return {
    active: false,
    point: null,
    velocityX: 0,
    velocityY: 0,
    speed: 0,
    acceleration: 0,
    amplitude: 0,
    timestamp,
  };
}

function createMotionSample({
  point,
  shoulder,
  previous,
  timestamp,
  pointSmoothing,
  velocitySmoothing,
}) {
  if (!point) {
    return inactiveSample(
      timestamp,
    );
  }

  const filteredPoint =
    smoothPoint(
      point,
      previous,
      pointSmoothing,
    );

  const dt = previous
    ? clamp(
        (timestamp -
          previous.timestamp) /
          1000,
        1 / 120,
        0.1,
      )
    : 1 / 60;

  const rawVelocityX =
    previous
      ? (filteredPoint.x -
          previous.point.x) /
        dt
      : 0;

  const rawVelocityY =
    previous
      ? (filteredPoint.y -
          previous.point.y) /
        dt
      : 0;

  const velocityX =
    previous
      ? lerp(
          previous.velocityX,
          rawVelocityX,
          velocitySmoothing,
        )
      : rawVelocityX;

  const velocityY =
    previous
      ? lerp(
          previous.velocityY,
          rawVelocityY,
          velocitySmoothing,
        )
      : rawVelocityY;

  const speed = Math.hypot(
    velocityX,
    velocityY,
  );

  const acceleration =
    previous
      ? (speed -
          previous.speed) /
        dt
      : 0;

  return {
    active: true,
    point: filteredPoint,
    velocityX,
    velocityY,
    speed,
    acceleration,
    amplitude: shoulder
      ? distance2d(
          filteredPoint,
          shoulder,
        )
      : 0,
    timestamp,
  };
}

export class BeatTracker {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    this.reset();
  }

  reset() {
    this.rightHistory = [];
    this.leftHistory = [];

    this.lastBeatTime =
      Number.NEGATIVE_INFINITY;

    this.strokeStartedAt =
      null;

    this.strokePeakDownwardVelocity =
      0;

    this.strokePeakAmplitude =
      0;

    this.strokeStartY = null;

    this.wasMovingDown =
      false;
  }

  getHandPoint(
    results,
    side,
  ) {
    const directLandmarks =
      side === "right"
        ? results
            ?.rightHandLandmarks
        : results
            ?.leftHandLandmarks;

    const directPoint =
      directLandmarks?.[0];

    if (
      pointIsUsable(
        directPoint,
        this.options
          .minVisibility,
      )
    ) {
      return directPoint;
    }

    const pose =
      results
        ?.poseLandmarks ??
      [];

    const posePoint =
      side === "right"
        ? pose[16]
        : pose[15];

    return pointIsUsable(
      posePoint,
      this.options
        .minVisibility,
    )
      ? posePoint
      : null;
  }

  getShoulderPoint(
    results,
    side,
  ) {
    const pose =
      results
        ?.poseLandmarks ??
      [];

    const shoulder =
      side === "right"
        ? pose[12]
        : pose[11];

    return pointIsUsable(
      shoulder,
      this.options
        .minVisibility,
    )
      ? shoulder
      : null;
  }

  addHistory(
    history,
    sample,
  ) {
    if (!sample.active) {
      return;
    }

    history.push(sample);

    if (
      history.length >
      this.options
        .historySize
    ) {
      history.shift();
    }
  }

  clearStroke() {
    this.wasMovingDown =
      false;

    this.strokeStartedAt =
      null;

    this.strokePeakDownwardVelocity =
      0;

    this.strokePeakAmplitude =
      0;

    this.strokeStartY = null;
  }

  processFrame(
    results = {},
    timestamp =
      performance.now(),
  ) {
    const right =
      createMotionSample({
        point:
          this.getHandPoint(
            results,
            "right",
          ),

        shoulder:
          this.getShoulderPoint(
            results,
            "right",
          ),

        previous:
          this.rightHistory.at(
            -1,
          ),

        timestamp,

        pointSmoothing:
          this.options
            .pointSmoothing,

        velocitySmoothing:
          this.options
            .velocitySmoothing,
      });

    const left =
      createMotionSample({
        point:
          this.getHandPoint(
            results,
            "left",
          ),

        shoulder:
          this.getShoulderPoint(
            results,
            "left",
          ),

        previous:
          this.leftHistory.at(
            -1,
          ),

        timestamp,

        pointSmoothing:
          this.options
            .pointSmoothing,

        velocitySmoothing:
          this.options
            .velocitySmoothing,
      });

    this.addHistory(
      this.rightHistory,
      right,
    );

    this.addHistory(
      this.leftHistory,
      left,
    );

    const dominant =
      this.options
        .dominantHand ===
      "left"
        ? left
        : right;

    if (
      dominant.active &&
      dominant.velocityY > 0
    ) {
      if (
        !this.wasMovingDown
      ) {
        this.strokeStartedAt =
          timestamp;
        this.strokeStartY = dominant.point.y;
      }

      this.wasMovingDown =
        true;

      this.strokePeakDownwardVelocity =
        Math.max(
          this
            .strokePeakDownwardVelocity,
          dominant.velocityY,
        );

      this.strokePeakAmplitude =
        Math.max(
          this
            .strokePeakAmplitude,
          Math.max(0, dominant.point.y - this.strokeStartY),
        );
    }

    const strokeExpired =
      this.wasMovingDown &&
      this.strokeStartedAt !==
        null &&
      timestamp -
        this.strokeStartedAt >
        this.options
          .maximumStrokeMs;

    if (
      !dominant.active ||
      strokeExpired
    ) {
      this.clearStroke();
    }

    const rebound =
      dominant.active &&
      this.wasMovingDown &&
      dominant.velocityY <=
        this.options
          .minReboundVelocity;

    const enoughTimePassed =
      timestamp -
        this.lastBeatTime >=
      this.options
        .minBeatGapMs;

    const strongEnoughStroke =
      this
        .strokePeakDownwardVelocity >=
        this.options
          .minDownwardVelocity &&
      this
        .strokePeakAmplitude >=
        this.options
          .minAmplitude;

    const beatDetected =
      rebound &&
      enoughTimePassed &&
      strongEnoughStroke;

    const speedScore =
      clamp(
        this
          .strokePeakDownwardVelocity /
          (this.options
            .minDownwardVelocity *
            2.5),
      );

    const amplitudeScore =
      clamp(
        this
          .strokePeakAmplitude /
          (this.options
            .minAmplitude *
            2.2),
      );

    const beatConfidence =
      beatDetected
        ? clamp(
            speedScore *
              0.65 +
              amplitudeScore *
                0.35,
          )
        : 0;

    if (rebound) {
      this.clearStroke();
    }

    if (beatDetected) {
      this.lastBeatTime =
        timestamp;
    }

    return {
      beatDetected,

      beatTime:
        beatDetected
          ? timestamp
          : null,

      beatPoint:
        beatDetected
          ? dominant.point
          : null,

      beatConfidence,

      dominantHand:
        this.options
          .dominantHand,

      rightMotion: right,
      leftMotion: left,

      rightTrajectory:
        this.rightHistory.map(
          (sample) =>
            sample.point,
        ),

      leftTrajectory:
        this.leftHistory.map(
          (sample) =>
            sample.point,
        ),
    };
  }
}
