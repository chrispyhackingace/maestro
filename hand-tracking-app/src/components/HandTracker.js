import React, { useRef, useEffect, useState, useCallback } from 'react';
import './HandTracker.css';

const HandTracker = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [detectedHands, setDetectedHands] = useState(0);
  const [gestureState, setGestureState] = useState('unknown');
  const [fps, setFps] = useState(0);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // distance
  const calculateDistance = useCallback((p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // gesture logic (unchanged)
  const detectGesture = useCallback((landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const palmBase = landmarks[0];

    const thumbIndexDistance = calculateDistance(thumbTip, indexTip);
    const indexMiddleDistance = calculateDistance(indexTip, middleTip);

    if (thumbIndexDistance < 0.05) return 'pinch';

    if (
      calculateDistance(thumbTip, palmBase) < 0.1 &&
      calculateDistance(indexTip, palmBase) < 0.1 &&
      calculateDistance(middleTip, palmBase) < 0.1 &&
      calculateDistance(ringTip, palmBase) < 0.1 &&
      calculateDistance(pinkyTip, palmBase) < 0.1
    ) {
      return 'fist';
    }

    if (thumbIndexDistance > 0.1 && indexMiddleDistance > 0.05) {
      return 'open hand';
    }

    return 'neutral';
  }, [calculateDistance]);

  // results handler (unchanged UI logic)
  const onResults = useCallback((results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');

    // FPS
    frameCountRef.current++;
    const now = Date.now();

    if (now - lastTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks?.length) {
      setDetectedHands(results.multiHandLandmarks.length);

      results.multiHandLandmarks.forEach((landmarks) => {
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
            color: '#00FF41',
            lineWidth: 2,
          });
        }

        if (window.drawLandmarks) {
          window.drawLandmarks(ctx, landmarks, {
            color: '#FF006E',
            lineWidth: 1.5,
          });
        }
      });

      setGestureState(detectGesture(results.multiHandLandmarks[0]));
    } else {
      setDetectedHands(0);
      setGestureState('no hands');
    }
  }, [detectGesture]);

  useEffect(() => {
    const init = async () => {
      // wait for CDN scripts (safe fallback)
      let attempts = 0;
      while ((!window.Hands || !window.Camera) && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.Hands || !window.Camera) {
        console.error('MediaPipe failed to load');
        setIsLoading(false);
        return;
      }

      // ✅ FIXED: NO pinned SIMD build (this was your crash)
      const hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      hands.onResults(onResults);
      handsRef.current = hands;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = 1280;
      canvas.height = 720;

      const camera = new window.Camera(video, {
        onFrame: async () => {
          if (video.readyState >= 2) {
            await hands.send({ image: video });
          }
        },
        width: 1280,
        height: 720,
      });

      cameraRef.current = camera;
      camera.start();

      setIsLoading(false);
    };

    init();

    return () => {
      cameraRef.current?.stop();
    };
  }, [onResults]);

  return (
    <div className="hand-tracker-container">
      <div className="tracker-content">
        <div className="video-container">
          <video ref={videoRef} className="video-feed" playsInline style={{ display: 'none' }} />
          <canvas ref={canvasRef} className="tracking-canvas" style={{ background: '#000' }} />

          {isLoading && (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>Loading MediaPipe Hands Model...</p>
            </div>
          )}
        </div>

        <div className="stats-panel">
          <div className="stat-item">
            <label>Hands Detected:</label>
            <span className="stat-value">{detectedHands}</span>
          </div>
          <div className="stat-item">
            <label>Gesture:</label>
            <span className="stat-value">{gestureState}</span>
          </div>
          <div className="stat-item">
            <label>FPS:</label>
            <span className="stat-value">{fps}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HandTracker;