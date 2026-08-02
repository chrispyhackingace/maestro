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

function average(values) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [
    ...values,
  ].sort(
    (a, b) => a - b,
  );

  const middle =
    Math.floor(
      sorted.length / 2,
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

export class TempoEstimator {
  constructor({
    maxBeats = 10,
    minBpm = 35,
    maxBpm = 240,
  } = {}) {
    this.maxBeats =
      maxBeats;

    this.minIntervalMs =
      60000 / maxBpm;

    this.maxIntervalMs =
      60000 / minBpm;

    this.reset();
  }

  reset() {
    this.beats = [];
  }

  ingestBeat(time) {
    const previous =
      this.beats.at(-1);

    if (previous) {
      const interval =
        time - previous;

      if (
        interval <
          this.minIntervalMs ||
        interval >
          this.maxIntervalMs
      ) {
        return this.getTempo();
      }
    }

    this.beats.push(time);

    if (
      this.beats.length >
      this.maxBeats
    ) {
      this.beats.shift();
    }

    return this.getTempo();
  }

  getTempo() {
    if (
      this.beats.length < 2
    ) {
      return {
        bpm: 0,
        consistency: 0,
        intervalMs: 0,
        beatCount:
          this.beats.length,
      };
    }

    const intervals = [];

    for (
      let index = 1;
      index <
      this.beats.length;
      index += 1
    ) {
      intervals.push(
        this.beats[index] -
          this.beats[
            index - 1
          ],
      );
    }

    const center =
      median(intervals);

    const accepted =
      intervals.filter(
        (interval) =>
          Math.abs(
            interval -
              center,
          ) <=
          center * 0.35,
      );

    const working =
      accepted.length
        ? accepted
        : intervals;

    const intervalMs =
      average(working);

    const variance =
      average(
        working.map(
          (interval) =>
            (
              interval -
              intervalMs
            ) ** 2,
        ),
      );

    const deviation =
      Math.sqrt(variance);

    const consistency =
      intervalMs > 0
        ? clamp(
            1 -
              deviation /
                intervalMs,
          )
        : 0;

    return {
      bpm:
        intervalMs > 0
          ? 60000 /
            intervalMs
          : 0,

      consistency,
      intervalMs,

      beatCount:
        this.beats.length,
    };
  }
}