import { useCallback, useEffect, useRef, useState } from "react";
import { useLeafletMap } from "./lib/useLeafletMap.js";
import { Legend } from "./components/Chrome.jsx";
import { getPointsHistory } from "./services/api.js";

// ── datetime helpers ────────────────────────────────────────────────
// Strip milliseconds -> "2026-07-11T09:00:00Z" (matches the backend example).
const toIsoZ = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z");

// A <input type="datetime-local"> value is LOCAL time with no zone
// (e.g. "2026-07-11T09:00"). new Date(...) parses it as local, and
// toISOString() converts to correct UTC. This line prevents the classic
// "every reading is shifted by my timezone" bug.
const localInputToIsoZ = (localValue) => toIsoZ(new Date(localValue));

// Format a Date for the value a datetime-local input expects (LOCAL, no zone).
const toLocalInputValue = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};

const PRESETS = [
  { label: "Last 1 min", minutes: 1 },
  { label: "Last 5 min", minutes: 5 },
  { label: "Last 15 min", minutes: 15 },
  { label: "Last 1 hour", minutes: 60 },
];
const SPEEDS = [1, 10, 60, 300]; // a 1-hour window replays in ~12s at 300×

const fmtClock = (ms) => (ms ? new Date(ms).toLocaleString() : "—");

// Styling for the datetime inputs — mirrors the app's <select> styling so it
// looks native (styles.css only styles select / range, not datetime-local).
const inputStyle = {
  width: "100%",
  padding: 7,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
};

export default function ReplayPage() {
  // Reuse the SAME map hook as the live app — identical tiles, colours, markers.
  const map = useLeafletMap("rc-map");

  // ── refs the animation needs without triggering re-renders ──
  const readingsRef = useRef([]);   // sorted readings (oldest -> newest)
  const cursorRef = useRef(0);      // index of next reading not yet drawn
  const clockRef = useRef(0);       // virtual time (ms since epoch)
  const rafRef = useRef(null);      // requestAnimationFrame handle
  const lastFrameRef = useRef(0);   // real timestamp of previous frame

  // ── UI state ──
  const [startInput, setStartInput] = useState(toLocalInputValue(Date.now() - 3600_000));
  const [endInput, setEndInput] = useState(toLocalInputValue(Date.now()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bounds, setBounds] = useState({ t0: 0, t1: 0 });
  const [clockUi, setClockUi] = useState(0);
  const [lastQuery, setLastQuery] = useState(null);

  // live copies for the rAF-loop closures
  const speedRef = useRef(speed);
  const playingRef = useRef(isPlaying);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);

  // draw every reading up to a virtual time (forward only)
  const advanceTo = useCallback((targetMs) => {
    const readings = readingsRef.current;
    let i = cursorRef.current;
    while (i < readings.length && readings[i]._t <= targetMs) {
      map.renderSensor(readings[i]);   // team's own renderer -> identical look
      i++;
    }
    cursorRef.current = i;
  }, [map]);

  // rebuild from scratch up to a time (used when scrubbing BACKWARDS)
  const rebuildTo = useCallback((targetMs) => {
    map.renderSnapshot([]);            // clears the sensor layer + marker map
    cursorRef.current = 0;
    advanceTo(targetMs);
  }, [map, advanceTo]);

  // jump the clock to an exact time
  const seek = useCallback((targetMs) => {
    if (targetMs >= clockRef.current) advanceTo(targetMs); // forward: cheap
    else rebuildTo(targetMs);                              // backward: replay from 0
    clockRef.current = targetMs;
    setClockUi(targetMs);
  }, [advanceTo, rebuildTo]);

  // the animation loop
  const tick = useCallback((now) => {
    if (!playingRef.current) return;
    const last = lastFrameRef.current || now;
    const realDelta = now - last;               // real ms since last frame
    lastFrameRef.current = now;

    const next = clockRef.current + realDelta * speedRef.current;
    if (next >= bounds.t1) {                     // reached the end
      clockRef.current = bounds.t1;
      advanceTo(bounds.t1);
      setClockUi(bounds.t1);
      setIsPlaying(false);
      return;
    }
    clockRef.current = next;
    advanceTo(next);
    setClockUi(next);
    rafRef.current = requestAnimationFrame(tick);
  }, [advanceTo, bounds.t1]);

  // start / stop the loop when play state flips
  useEffect(() => {
    if (isPlaying) {
      lastFrameRef.current = 0;                  // first delta ~0, no jump
      rafRef.current = requestAnimationFrame(tick);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, tick]);

  // fetch a window and prime the replay
  const loadRange = useCallback(async (startIso, endIso) => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setLastQuery({ start: startIso, end: endIso });
    try {
      const data = await getPointsHistory(startIso, endIso, 5000);

      // precompute _t we replay against. Backend windows on ingested_at, so we
      // replay on ingested_at too. (Prefer real capture time? swap to captured_at.)
      const readings = (Array.isArray(data) ? data : [])
        .map((r) => ({ ...r, _t: Date.parse(r.ingested_at) }))
        .filter((r) => Number.isFinite(r._t) && r.latitude != null && r.longitude != null)
        .sort((a, b) => a._t - b._t);

      readingsRef.current = readings;
      map.renderSnapshot([]);          // clear the map
      cursorRef.current = 0;
      setCount(readings.length);

      if (readings.length === 0) {
        setBounds({ t0: 0, t1: 0 });
        setClockUi(0);
        return;
      }

      // zoom to where the data actually is
      let s = 90, n = -90, w = 180, e = -180;
      for (const r of readings) {
        s = Math.min(s, r.latitude); n = Math.max(n, r.latitude);
        w = Math.min(w, r.longitude); e = Math.max(e, r.longitude);
      }
      map.fitBox({ s, w, n, e });

      const t0 = readings[0]._t;
      const t1 = readings[readings.length - 1]._t;
      setBounds({ t0, t1 });
      clockRef.current = t0;
      setClockUi(t0);
      setIsPlaying(true);              // auto-play once loaded
    } catch (err) {
      setError(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [map]);

  // preset buttons: auto-generate start/end and load
  const runPreset = useCallback((minutes) => {
    const end = new Date();
    const start = new Date(Date.now() - minutes * 60_000);
    setStartInput(toLocalInputValue(start));   // reflect into the pickers
    setEndInput(toLocalInputValue(end));
    loadRange(toIsoZ(start), toIsoZ(end));
  }, [loadRange]);

  const runCustom = useCallback(() => {
    loadRange(localInputToIsoZ(startInput), localInputToIsoZ(endInput));
  }, [startInput, endInput, loadRange]);

  const togglePlay = () => {
    if (count === 0) return;
    if (!isPlaying && clockRef.current >= bounds.t1) seek(bounds.t0); // restart if at end
    setIsPlaying((p) => !p);
  };

  const pct = bounds.t1 > bounds.t0
    ? Math.round(((clockUi - bounds.t0) / (bounds.t1 - bounds.t0)) * 100)
    : 0;

  return (
    <div className="rc-root">
      {/* ── header (mirrors the live app's rc-head) ── */}
      <header className="rc-head">
        <div className="rc-logo">
          <span className="rc-pulse" style={{ background: "var(--accent)" }} />
          <div>
            <div className="rc-title rc-disp">SAFECAST&nbsp;LIVE</div>
            <div className="rc-sub rc-mono">HISTORICAL REPLAY</div>
          </div>
        </div>
        <div className="rc-spacer" />
        <a className="rc-conn-btn" href="/" style={{ marginRight: 10, textDecoration: "none" }}>
          ← Live map
        </a>
        <div className="rc-conn rc-mono">
          <span className="rc-dot" style={{ background: count ? "var(--safe)" : "var(--muted)" }} />
          {count ? `${count} READINGS` : "NO DATA"}
        </div>
      </header>

      {/* ── body: left controls + map (2 columns instead of 3) ── */}
      <div className="rc-body" style={{ gridTemplateColumns: "280px 1fr" }}>
        <aside className="rc-rail left">
          {/* TIME WINDOW */}
          <div className="rc-sec">
            <div className="rc-eyebrow"><span>Time window</span></div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
              {PRESETS.map((p) => (
                <button key={p.minutes} className="rc-btn" onClick={() => runPreset(p.minutes)}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="rc-field">
              <div className="rc-flabel"><label>Start</label></div>
              <input type="datetime-local" value={startInput} style={inputStyle}
                onChange={(e) => setStartInput(e.target.value)} />
            </div>
            <div className="rc-field">
              <div className="rc-flabel"><label>End</label></div>
              <input type="datetime-local" value={endInput} style={inputStyle}
                onChange={(e) => setEndInput(e.target.value)} />
            </div>

            <button className="rc-apply" onClick={runCustom} disabled={loading}>
              {loading ? "Loading…" : "Load range"}
            </button>

            {lastQuery && (
              <p className="rc-hint rc-mono" style={{ wordBreak: "break-all" }}>
                GET /api/points/history?start={lastQuery.start}&amp;end={lastQuery.end}
              </p>
            )}
          </div>

          {/* PLAYBACK */}
          <div className="rc-sec">
            <div className="rc-eyebrow"><span>Playback</span></div>

            <button className="rc-apply" onClick={togglePlay} disabled={count === 0}
              style={{ marginBottom: 12 }}>
              {isPlaying ? "⏸  Pause" : "▶  Play"}
            </button>

            <div className="rc-flabel"><span>Speed</span><span className="rc-mono">{speed}×</span></div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {SPEEDS.map((s) => (
                <button key={s} className={`rc-btn${speed === s ? " on" : ""}`}
                  style={{ flex: 1 }} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>

            <div className="rc-flabel"><span>Timeline</span><span className="rc-mono">{pct}%</span></div>
            <input type="range" min={bounds.t0} max={bounds.t1 || bounds.t0 + 1}
              value={clockUi} disabled={count === 0}
              onChange={(e) => { setIsPlaying(false); seek(Number(e.target.value)); }} />

            <p className="rc-hint rc-mono">
              {error ? <span style={{ color: "var(--high)" }}>⚠ {error}</span>
                : count === 0 ? "Pick a preset or range to load history."
                : `clock: ${fmtClock(clockUi)}  ·  ${map.markerCount()} sensors on map`}
            </p>
          </div>
        </aside>

        <main className="rc-map-wrap" aria-label="Radiation replay map">
          <div id="rc-map" />
          <div className="rc-map-empty">Awaiting sensor data</div>
          <Legend />
        </main>
      </div>
    </div>
  );
}
