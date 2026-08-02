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

function motionEnergy(
  motion,
) {
  if (!motion?.active) {
    return 0;
  }

  const speed = clamp(motion.speed / 0.85);

  const acceleration =
    clamp(
      Math.abs(
        motion.acceleration,
      ) / 5,
    );

  return clamp(
    speed * 0.78 + acceleration * 0.22,
  );
}

function dynamicLabel(
  value,
) {
  if (value < 0.14) {
    return "pp";
  }

  if (value < 0.3) {
    return "p";
  }

  if (value < 0.48) {
    return "mp";
  }

  if (value < 0.65) {
    return "mf";
  }

  if (value < 0.82) {
    return "f";
  }

  return "ff";
}

export class DynamicsEstimator {
  constructor({
    attack = 0.42,
    release = 0.16,
  } = {}) {
    this.attack = attack;
    this.release = release;

    this.reset();
  }

  reset() {
    this.smoothedIntensity =
      0;
  }

  estimate({ motion }) {
    const rawIntensity = motionEnergy(motion);
    const smoothing = rawIntensity > this.smoothedIntensity ? this.attack : this.release;

    this.smoothedIntensity +=
      (
        rawIntensity -
        this
          .smoothedIntensity
      ) * smoothing;

    const intensity =
      clamp(
        this
          .smoothedIntensity,
      );

    return {
      intensity,

      label:
        dynamicLabel(
          intensity,
        ),

      rawIntensity,
    };
  }
}
