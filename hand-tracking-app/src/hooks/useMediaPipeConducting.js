import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Holistic,
} from "@mediapipe/holistic";

import {
  BeatTracker,
} from "../motion/BeatTracker";

import {
  TempoEstimator,
} from "../motion/TempoEstimator";

import {
  DynamicsEstimator,
} from "../motion/DynamicsEstimator";

import {
  buildConductingFeedback,
} from "../feedback/feedback";

const INITIAL_ANALYSIS = {
  bpm: 0,
  consistency: 0,
  dynamicIntensity: 0,
  dynamicLabel: "pp",
  beatDetected: false,
  beatConfidence: 0,
  feedback:
    "Start the camera and show a clear conducting pattern.",
  messages: [],
  poseDetected: false,
  rightHandDetected: false,
  leftHandDetected: false,
  frameCount: 0,
};

const POSE_LINES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];

const HAND_LINES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],

  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],

  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],

  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],

  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],

  [5, 9],
  [9, 13],
  [13, 17],
];

function pointVisible(
  point,
  minimum = 0.35,
) {
  if (!point) {
    return false;
  }

  const confidence =
    point.visibility ??
    point.presence ??
    1;

  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    confidence >= minimum
  );
}

function drawLandmarkSet(
  context,
  landmarks,
  width,
  height,
  color,
  radius,
) {
  if (!landmarks?.length) {
    return;
  }

  context.fillStyle = color;

  landmarks.forEach((point) => {
    if (!pointVisible(point)) {
      return;
    }

    context.beginPath();

    context.arc(
      point.x * width,
      point.y * height,
      radius,
      0,
      Math.PI * 2,
    );

    context.fill();
  });
}

function drawConnections(
  context,
  landmarks,
  connections,
  width,
  height,
  color,
  lineWidth,
) {
  if (!landmarks?.length) {
    return;
  }

  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  connections.forEach(
    ([startIndex, endIndex]) => {
      const start =
        landmarks[startIndex];

      const end =
        landmarks[endIndex];

      if (
        !pointVisible(start) ||
        !pointVisible(end)
      ) {
        return;
      }

      context.beginPath();

      context.moveTo(
        start.x * width,
        start.y * height,
      );

      context.lineTo(
        end.x * width,
        end.y * height,
      );

      context.stroke();
    },
  );
}

function drawResults(
  canvas,
  video,
  results,
) {
  if (!canvas || !video) {
    return;
  }

  const width =
    video.videoWidth || 1280;

  const height =
    video.videoHeight || 720;

  if (
    canvas.width !== width ||
    canvas.height !== height
  ) {
    canvas.width = width;
    canvas.height = height;
  }

  const context =
    canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(
    0,
    0,
    width,
    height,
  );

  drawConnections(
    context,
    results.poseLandmarks,
    POSE_LINES,
    width,
    height,
    "#60a5fa",
    4,
  );

  drawLandmarkSet(
    context,
    results.poseLandmarks,
    width,
    height,
    "#dbeafe",
    4,
  );

  drawConnections(
    context,
    results.rightHandLandmarks,
    HAND_LINES,
    width,
    height,
    "#22c55e",
    3,
  );

  drawLandmarkSet(
    context,
    results.rightHandLandmarks,
    width,
    height,
    "#86efac",
    4,
  );

  drawConnections(
    context,
    results.leftHandLandmarks,
    HAND_LINES,
    width,
    height,
    "#f97316",
    3,
  );

  drawLandmarkSet(
    context,
    results.leftHandLandmarks,
    width,
    height,
    "#fdba74",
    4,
  );
}

export function useMediaPipeConducting({
  targetBpm = 96,
  dominantHand = "right",
} = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const streamRef = useRef(null);
  const holisticRef = useRef(null);
  const animationFrameRef =
    useRef(null);

  const runningRef = useRef(false);
  const processingRef =
    useRef(false);

  const targetBpmRef =
    useRef(targetBpm);

  const dominantHandRef =
    useRef(dominantHand);

  const quadrantCandidateRef =
    useRef({ id: null, since: 0 });

  const frameCountRef =
    useRef(0);

  const lastUiUpdateRef =
    useRef(0);

  const beatTrackerRef =
    useRef(new BeatTracker());

  const tempoEstimatorRef =
    useRef(
      new TempoEstimator(),
    );

  const dynamicsEstimatorRef =
    useRef(
      new DynamicsEstimator(),
    );

  const [status, setStatus] =
    useState("idle");

  const [error, setError] =
    useState(null);

  const [analysis, setAnalysis] =
    useState(INITIAL_ANALYSIS);

  const [pointer, setPointer] =
    useState(null);

  const [hoveredQuadrant, setHoveredQuadrant] =
    useState(null);

  const [activeQuadrant, setActiveQuadrant] =
    useState(null);

  useEffect(() => {
    targetBpmRef.current =
      targetBpm;
  }, [targetBpm]);

  useEffect(() => {
    dominantHandRef.current = dominantHand;
    beatTrackerRef.current = new BeatTracker({ dominantHand });
    tempoEstimatorRef.current.reset();
  }, [dominantHand]);

  const reset = useCallback(() => {
    beatTrackerRef.current.reset();
    tempoEstimatorRef.current.reset();
    dynamicsEstimatorRef.current.reset();

    frameCountRef.current = 0;
    lastUiUpdateRef.current = 0;

    setAnalysis(
      INITIAL_ANALYSIS,
    );
    setPointer(null);
    setHoveredQuadrant(null);
    setActiveQuadrant(null);
    quadrantCandidateRef.current = { id: null, since: 0 };
  }, []);

  const handleResults = useCallback(
    (results) => {
      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;

      drawResults(
        canvas,
        video,
        results,
      );

      const timestamp =
        performance.now();

      const selectedLandmarks = dominantHandRef.current === "left"
        ? results.leftHandLandmarks
        : results.rightHandLandmarks;
      const indexTip = selectedLandmarks?.[8];
      const displayPointer = indexTip && Number.isFinite(indexTip.x) && Number.isFinite(indexTip.y)
        ? { x: 1 - indexTip.x, y: indexTip.y }
        : null;

      if (displayPointer) {
        const quadrant = (displayPointer.y < 0.5 ? 0 : 2) + (displayPointer.x < 0.5 ? 1 : 2);
        setPointer(displayPointer);
        setHoveredQuadrant(quadrant);
        if (quadrantCandidateRef.current.id !== quadrant) {
          quadrantCandidateRef.current = { id: quadrant, since: timestamp };
        } else if (timestamp - quadrantCandidateRef.current.since >= 150) {
          setActiveQuadrant(quadrant);
        }
      } else {
        setPointer(null);
        setHoveredQuadrant(null);
        quadrantCandidateRef.current = { id: null, since: 0 };
      }

      const motion =
        beatTrackerRef.current
          .processFrame(
            results,
            timestamp,
          );

      let tempo =
        tempoEstimatorRef.current
          .getTempo();

      if (motion.beatDetected) {
        tempo =
          tempoEstimatorRef.current
            .ingestBeat(timestamp);
      }

      const dynamics =
        dynamicsEstimatorRef.current
          .estimate({
            motion: dominantHandRef.current === "left"
              ? motion.leftMotion
              : motion.rightMotion,
          });

      const feedback =
        buildConductingFeedback({
          targetBpm:
            targetBpmRef.current,
          detectedBpm:
            tempo.bpm,
          tempoConsistency:
            tempo.consistency,
          dynamicsIntensity:
            dynamics.intensity,
          beatDetected:
            motion.beatDetected,
          beatConfidence:
            motion.beatConfidence,
        });

      frameCountRef.current += 1;

      const nextAnalysis = {
        bpm: tempo.bpm,
        consistency:
          tempo.consistency,
        dynamicIntensity:
          dynamics.intensity,
        dynamicLabel:
          dynamics.label,
        beatDetected:
          motion.beatDetected,
        beatConfidence:
          motion.beatConfidence,
        feedback:
          feedback.primary,
        messages:
          feedback.messages,
        poseDetected:
          Boolean(
            results
              .poseLandmarks
              ?.length,
          ),
        rightHandDetected:
          Boolean(
            results
              .rightHandLandmarks
              ?.length,
          ),
        leftHandDetected:
          Boolean(
            results
              .leftHandLandmarks
              ?.length,
          ),
        frameCount:
          frameCountRef.current,
      };

      if (
        motion.beatDetected ||
        timestamp -
          lastUiUpdateRef.current >=
          100
      ) {
        lastUiUpdateRef.current =
          timestamp;

        setAnalysis(
          nextAnalysis,
        );
      }
    },
    [],
  );

  const stop = useCallback(
    async () => {
      runningRef.current = false;
      processingRef.current = false;

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );

        animationFrameRef.current =
          null;
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject =
          null;
      }

      const holistic =
        holisticRef.current;

      holisticRef.current = null;

      if (holistic) {
        try {
          await holistic.close();
        } catch {
          // Ignore cleanup errors.
        }
      }

      if (canvasRef.current) {
        const context =
          canvasRef.current
            .getContext("2d");

        context?.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height,
        );
      }

      setStatus("idle");
    },
    [],
  );

  const start = useCallback(
    async () => {
      if (
        runningRef.current ||
        status === "starting"
      ) {
        return;
      }

      setStatus("starting");
      setError(null);

      try {
        if (
          !navigator.mediaDevices
            ?.getUserMedia
        ) {
          throw new Error(
            "Camera access is not supported by this browser.",
          );
        }

        const video =
          videoRef.current;

        if (!video) {
          throw new Error(
            "The video element is not mounted.",
          );
        }

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                width: {
                  ideal: 1280,
                },
                height: {
                  ideal: 720,
                },
                facingMode:
                  "user",
              },
              audio: false,
            });

        streamRef.current =
          stream;

        video.srcObject =
          stream;

        await video.play();

        const holistic =
          new Holistic({
            locateFile: (
              file,
            ) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
          });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation:
            false,
          refineFaceLandmarks:
            false,
          minDetectionConfidence:
            0.55,
          minTrackingConfidence:
            0.55,
        });

        holistic.onResults(
          handleResults,
        );

        holisticRef.current =
          holistic;

        runningRef.current =
          true;

        setStatus("running");

        const processFrame =
          async () => {
            if (
              !runningRef.current
            ) {
              return;
            }

            if (
              video.readyState >= 2 &&
              !processingRef.current
            ) {
              processingRef.current =
                true;

              try {
                await holistic.send({
                  image: video,
                });
              } catch (frameError) {
                console.error(
                  "MediaPipe frame error:",
                  frameError,
                );
              } finally {
                processingRef.current =
                  false;
              }
            }

            if (
              runningRef.current
            ) {
              animationFrameRef.current =
                requestAnimationFrame(
                  processFrame,
                );
            }
          };

        animationFrameRef.current =
          requestAnimationFrame(
            processFrame,
          );
      } catch (startError) {
        runningRef.current = false;

        streamRef.current
          ?.getTracks()
          .forEach((track) => {
            track.stop();
          });

        streamRef.current = null;

        setStatus("error");

        setError(
          startError instanceof Error
            ? startError.message
            : String(startError),
        );
      }
    },
    [
      handleResults,
      status,
    ],
  );

  useEffect(() => {
    return () => {
      runningRef.current = false;

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });

      const holistic =
        holisticRef.current;

      holisticRef.current = null;

      if (holistic) {
        void holistic.close();
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    analysis,
    pointer,
    hoveredQuadrant,
    activeQuadrant,
    start,
    stop,
    reset,
  };
}
