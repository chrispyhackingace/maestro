import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaPipeConducting } from "../hooks/useMediaPipeConducting";
import "./ConductingCoach.css";

const SECTION_NAMES = ["Strings", "Woodwinds", "Brass", "Percussion"];

function useSectionMedia() {
  const [sections, setSections] = useState(() =>
    SECTION_NAMES.map((name, index) => ({
      id: index + 1,
      name,
      enabled: true,
      imageUrl: `/section-images/${name.toLowerCase()}.svg`,
      audioUrl: null,
      audioName: "",
    })),
  );
  const urlsRef = useRef([]);

  const chooseAudio = useCallback((id, file) => {
    if (!file || !file.type.startsWith("audio/")) return;
    const audioUrl = URL.createObjectURL(file);
    setSections((current) => current.map((section) => {
      if (section.id !== id) return section;
      if (section.audioUrl) URL.revokeObjectURL(section.audioUrl);
      return { ...section, audioUrl, audioName: file.name };
    }));
  }, []);

  useEffect(() => {
    urlsRef.current = sections.map((section) => section.audioUrl).filter(Boolean);
  }, [sections]);

  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const toggleSection = useCallback((id) => {
    setSections((current) => current.map((section) =>
      section.id === id ? { ...section, enabled: !section.enabled } : section,
    ));
  }, []);

  return { sections, chooseAudio, toggleSection };
}

function FloatingWindow({ title, icon, children, initial, className = "", onClose }) {
  const [position, setPosition] = useState(initial);
  const dragRef = useRef(null);

  const beginDrag = (event) => {
    if (event.target.closest("button, input, label")) return;
    dragRef.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!dragRef.current) return;
    const width = event.currentTarget.parentElement?.offsetWidth || 300;
    const height = event.currentTarget.parentElement?.offsetHeight || 200;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - width - 8, dragRef.current.left + event.clientX - dragRef.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, dragRef.current.top + event.clientY - dragRef.current.y)),
    });
  };

  return (
    <section className={`floating-window ${className}`} style={{ left: position.x, top: position.y }}>
      <header className="window-titlebar" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }}>
        <span><span className="window-icon">{icon}</span>{title}</span>
        {onClose && <button type="button" className="window-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>}
      </header>
      <div className="window-content">{children}</div>
    </section>
  );
}

function Metric({ label, value, accent }) {
  return <div className="metric"><span>{label}</span><strong className={accent ? "metric-accent" : ""}>{value}</strong></div>;
}

export default function ConductingCoach() {
  const [targetBpm, setTargetBpm] = useState(96);
  const [dominantHand, setDominantHand] = useState("right");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const { sections, chooseAudio, toggleSection } = useSectionMedia();
  const [orchestraPlaying, setOrchestraPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRefs = useRef({});
  const { videoRef, canvasRef, status, error, analysis, pointer, hoveredQuadrant, activeQuadrant, start, stop, reset } =
    useMediaPipeConducting({ targetBpm, dominantHand });

  const running = status === "running";
  const starting = status === "starting";
  const pointedSection = sections[activeQuadrant - 1];
  const activeSection = pointedSection?.enabled ? pointedSection : null;

  useEffect(() => {
    sections.forEach((section) => {
      const audio = audioRefs.current[section.id];
      if (!audio) return;
      audio.muted = !section.enabled;
      audio.volume = activeSection?.id === section.id
        ? Math.min(1, 0.16 + analysis.dynamicIntensity * 0.84)
        : 0.16;
      if (orchestraPlaying && audio.paused) {
        audio.play().catch(() => setAudioError("Press Play orchestra again to allow browser audio playback."));
      }
    });
  }, [activeSection?.id, analysis.dynamicIntensity, orchestraPlaying, sections]);

  const toggleOrchestra = async () => {
    const tracks = Object.values(audioRefs.current).filter(Boolean);
    if (!tracks.length) {
      setAudioError("Upload at least one section audio track first.");
      return;
    }
    setAudioError("");
    if (orchestraPlaying) {
      tracks.forEach((audio) => audio.pause());
      setOrchestraPlaying(false);
      return;
    }
    const results = await Promise.allSettled(tracks.map((audio) => audio.play()));
    if (results.some((result) => result.status === "rejected")) {
      setAudioError("The browser blocked playback. Press Play orchestra again.");
    } else {
      setOrchestraPlaying(true);
    }
  };

  return (
    <main className="coach-shell">
      <div className="quadrant-stage" aria-label="Orchestra section cueing area">
        {sections.map((section) => (
          <div key={section.id} className={`quadrant quadrant-${section.id} ${activeSection?.id === section.id ? "is-active" : ""} ${hoveredQuadrant === section.id ? "is-hovered" : ""} ${!section.enabled ? "is-disabled" : ""}`}>
            {section.imageUrl && <img src={section.imageUrl} alt="" />}
            <div className="quadrant-shade" />
            <div className="quadrant-label"><span>0{section.id}</span><strong>{section.name}</strong></div>
            {activeSection?.id === section.id && <div className="cue-pill">CUE ACTIVE</div>}
            {!section.enabled && <div className="disabled-pill">SECTION OFF</div>}
          </div>
        ))}
        <div className="crosshair crosshair-v" /><div className="crosshair crosshair-h" />
        {pointer && <div className="cue-pointer" style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}><span /></div>}
        <div className="brand"><span className="brand-mark">M</span><div><strong>Maestro</strong><small>VISUAL CONDUCTING SYSTEM</small></div></div>
        <div className="top-actions">
          {!workspaceOpen && <button type="button" onClick={() => setWorkspaceOpen(true)}>Open workspace</button>}
          <button type="button" onClick={() => setSettingsOpen((open) => !open)}>⚙ Settings</button>
        </div>
        <div className={`system-status ${running ? "online" : ""}`}><i /> {running ? "SYSTEM ONLINE" : status.toUpperCase()}</div>
      </div>

      <FloatingWindow title="Conductor Camera" icon="◉" initial={{ x: 26, y: 104 }} className="camera-window">
        <div className="camera-view">
          <video ref={videoRef} autoPlay muted playsInline />
          <canvas ref={canvasRef} />
          {!running && <div className="camera-placeholder"><span>◎</span>{starting ? "Initializing tracking…" : "Camera offline"}</div>}
          <div className={`beat-light ${analysis.beatDetected ? "active" : ""}`} />
          {running && <span className="live-badge">● LIVE</span>}
        </div>
        <div className="camera-toolbar">
          <button className="primary-button" type="button" onClick={start} disabled={running || starting}>{starting ? "Starting…" : "Start camera"}</button>
          <button type="button" onClick={stop} disabled={!running && !starting}>Stop</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
        {error && <div className="error">{error}</div>}
      </FloatingWindow>

      {workspaceOpen && <FloatingWindow title="Conductor Workspace" icon="⌁" initial={{ x: Math.max(470, window.innerWidth - 450), y: 104 }} className="workspace-window" onClose={() => setWorkspaceOpen(false)}>
        <div className="active-readout"><span>ACTIVE SECTION</span><strong>{activeSection ? activeSection.name : "Awaiting cue"}</strong><small>{activeSection ? `Quadrant 0${activeSection.id}` : "Point to a quadrant"}</small></div>
        <div className="metrics-grid">
          <Metric label="Tempo" value={analysis.bpm ? `${Math.round(analysis.bpm)}` : "—"} accent />
          <Metric label="Stability" value={`${Math.round(analysis.consistency * 100)}%`} />
          <Metric label="Dynamics" value={analysis.dynamicLabel.toUpperCase()} />
          <Metric label="Confidence" value={`${Math.round(analysis.beatConfidence * 100)}%`} />
        </div>
        <div className="feedback"><span>COACH FEEDBACK</span><strong>{analysis.feedback}</strong><small>{analysis.messages[1] || "Start with a clear downward stroke and rebound."}</small></div>
        <div className="orchestra-controls">
          <button type="button" className={orchestraPlaying ? "is-playing" : ""} onClick={toggleOrchestra}>{orchestraPlaying ? "Pause orchestra" : "Play orchestra"}</button>
          <small>Background 16% · active section follows dynamics</small>
        </div>
        {audioError && <div className="error">{audioError}</div>}
        <div className="upload-heading"><span>ORCHESTRA SECTIONS</span><small>Enable present sections + add audio</small></div>
        <div className="uploads">
          {sections.map((section) => <div className="section-media" key={section.id}>
            <span>0{section.id}</span><strong>{section.name}</strong>
            <label className={section.audioUrl ? "has-file" : ""}><small>{section.audioName || "Audio"}</small><b>{section.audioUrl ? "✓" : "+"}</b><input type="file" accept="audio/*" onChange={(event) => chooseAudio(section.id, event.target.files?.[0])} /></label>
            <button type="button" className={`section-toggle ${section.enabled ? "enabled" : ""}`} onClick={() => toggleSection(section.id)} aria-pressed={section.enabled}>{section.enabled ? "On" : "Off"}</button>
            {section.audioUrl && <audio ref={(element) => { if (element) audioRefs.current[section.id] = element; else delete audioRefs.current[section.id]; }} src={section.audioUrl} loop preload="auto" />}
          </div>)}
        </div>
      </FloatingWindow>}

      {settingsOpen && <FloatingWindow title="Settings" icon="⚙" initial={{ x: Math.max(320, window.innerWidth / 2 - 180), y: 140 }} className="settings-window" onClose={() => setSettingsOpen(false)}>
        <label className="setting"><span><strong>Target tempo</strong><small>Tempo used for coaching feedback</small></span><b>{targetBpm} BPM</b></label>
        <input className="tempo-slider" type="range" min="40" max="220" value={targetBpm} onChange={(event) => setTargetBpm(Number(event.target.value))} />
        <fieldset><legend>Conducting hand</legend><label><input type="radio" checked={dominantHand === "right"} onChange={() => setDominantHand("right")} /> Right</label><label><input type="radio" checked={dominantHand === "left"} onChange={() => setDominantHand("left")} /> Left</label></fieldset>
        <p className="settings-note">Use your index fingertip to cue sections. Wrist movement controls beat and gesture analysis.</p>
      </FloatingWindow>}
    </main>
  );
}
