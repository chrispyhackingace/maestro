function tempoMessage(
  delta,
  consistency,
) {
  if (
    Math.abs(delta) <= 3 &&
    consistency >= 0.7
  ) {
    return "Tempo locked.";
  }

  if (
    Math.abs(delta) <= 5
  ) {
    return "Tempo is close. Keep the pulse steady.";
  }

  if (delta > 0) {
    return "Slow down slightly.";
  }

  return "Increase the tempo slightly.";
}

function stabilityMessage(
  consistency,
) {
  if (
    consistency >= 0.85
  ) {
    return "The beat is very steady.";
  }

  if (
    consistency >= 0.62
  ) {
    return "The beat is becoming stable.";
  }

  if (consistency > 0) {
    return "Make each beat more regular.";
  }

  return "Show several clear downbeats.";
}

function dynamicsMessage(
  intensity,
) {
  if (intensity < 0.18) {
    return "Gesture size is very small.";
  }

  if (intensity < 0.62) {
    return "Gesture energy is balanced.";
  }

  return "Gesture energy is strong.";
}

export function buildConductingFeedback({
  targetBpm,
  detectedBpm,
  tempoConsistency,
  dynamicsIntensity,
  beatDetected,
  beatConfidence = 0,
}) {
  const hasTempo =
    Number.isFinite(
      detectedBpm,
    ) &&
    detectedBpm > 0;

  const tempoDelta =
    hasTempo
      ? detectedBpm -
        targetBpm
      : null;

  const messages = [];

  if (hasTempo) {
    messages.push(
      tempoMessage(
        tempoDelta,
        tempoConsistency,
      ),
    );
  } else {
    messages.push(
      "Waiting for a clear beat pattern.",
    );
  }

  messages.push(
    stabilityMessage(
      tempoConsistency,
    ),
  );

  messages.push(
    dynamicsMessage(
      dynamicsIntensity,
    ),
  );

  if (
    beatDetected &&
    beatConfidence < 0.45
  ) {
    messages.push(
      "Beat detected, but the rebound could be clearer.",
    );
  }

  return {
    primary: messages[0],
    messages,
    tempoDelta,
  };
}