import { useState } from "react";
import { postThreshold, postSpeed } from "../services/api.js";
import TrendChart from "./TrendChart.jsx";

const AREAS = [
  { label: "World (no filter)", bbox: null },
  { label: "Fukushima Region", bbox: { s: 36.5, w: 139.0, n: 38.5, e: 141.5 } },
  { label: "East Asia",        bbox: { s: 24.0, w: 118.0, n: 46.0, e: 146.0 } },
  { label: "Europe",           bbox: { s: 35.0, w: -11.0, n: 71.0, e: 40.0 } },
  { label: "North America",    bbox: { s: 24.0, w: -125.0, n: 50.0, e: -66.0 } },
  { label: "🇦🇺 Australia",      bbox: { s: -43.7, w: 113.3, n: -10.7, e: 153.6 } },
  { label: "🇦🇹 Austria",        bbox: { s: 46.4, w: 9.5,   n: 49.0,  e: 17.2  } },
  { label: "🇧🇪 Belgium",        bbox: { s: 49.5, w: 2.5,   n: 51.5,  e: 6.4   } },
  { label: "🇧🇷 Brazil",         bbox: { s: -33.8, w: -73.9, n: 5.3,  e: -34.8 } },
  { label: "🇨🇦 Canada",         bbox: { s: 41.7, w: -141.0, n: 83.1, e: -52.6 } },
  { label: "🇨🇳 China",          bbox: { s: 18.2, w: 73.5,  n: 53.6,  e: 134.8 } },
  { label: "🇨🇿 Czech Republic", bbox: { s: 48.6, w: 12.1,  n: 51.1,  e: 18.9  } },
  { label: "🇩🇰 Denmark",        bbox: { s: 54.6, w: 8.1,   n: 57.8,  e: 15.2  } },
  { label: "🇫🇮 Finland",        bbox: { s: 59.8, w: 20.0,  n: 70.1,  e: 31.6  } },
  { label: "🇫🇷 France",         bbox: { s: 41.3, w: -5.1,  n: 51.1,  e: 9.6   } },
  { label: "🇩🇪 Germany",        bbox: { s: 47.3, w: 5.9,   n: 55.1,  e: 15.0  } },
  { label: "🇯🇵 Japan",          bbox: { s: 24.4, w: 122.9, n: 45.5,  e: 145.8 } },
  { label: "🇰🇷 South Korea",    bbox: { s: 33.1, w: 124.6, n: 38.6,  e: 129.6 } },
  { label: "🇳🇱 Netherlands",    bbox: { s: 50.8, w: 3.4,   n: 53.5,  e: 7.2   } },
  { label: "🇳🇿 New Zealand",    bbox: { s: -46.6, w: 166.4, n: -34.4, e: 178.6 } },
  { label: "🇳🇴 Norway",         bbox: { s: 57.9, w: 4.6,   n: 71.2,  e: 31.1  } },
  { label: "🇵🇱 Poland",         bbox: { s: 49.0, w: 14.1,  n: 54.9,  e: 24.2  } },
  { label: "🇷🇺 Russia",         bbox: { s: 41.2, w: 19.6,  n: 81.9,  e: 180.0 } },
  { label: "🇸🇪 Sweden",         bbox: { s: 55.3, w: 11.1,  n: 69.1,  e: 24.2  } },
  { label: "🇨🇭 Switzerland",    bbox: { s: 45.8, w: 6.0,   n: 47.8,  e: 10.5  } },
  { label: "🇺🇦 Ukraine",        bbox: { s: 44.4, w: 22.1,  n: 52.4,  e: 40.2  } },
  { label: "🇬🇧 United Kingdom", bbox: { s: 49.9, w: -8.2,  n: 60.9,  e: 1.8   } },
  { label: "🇺🇸 United States",  bbox: { s: 24.4, w: -125.0, n: 49.4, e: -66.9 } },
];

const SPEED_STEPS = [
  { label: "Realtime",           value: 1      },
  { label: "Medium",             value: 0.001  },
  { label: "Fast",               value: 0.0001 },
  { label: "Firehose (fastest)", value: 0      },
];

function initialSpeedIndex(speed) {
  const i = SPEED_STEPS.findIndex((s) => s.value === speed);
  return i !== -1 ? i : 1;
}

export default function ConfigPanel({ cfg, onChange, showHeat, onToggleHeat, timeseries }) {
  const [draft, setDraft] = useState(cfg);
  const [area, setArea] = useState(AREAS[0].label);
  const [speedIndex, setSpeedIndex] = useState(() => initialSpeedIndex(cfg.speed));
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [savingSpeed, setSavingSpeed] = useState(false);

  function chooseArea(label) {
    const selection = AREAS.find((item) => item.label === label);
    setArea(label);
    const next = { ...draft, bbox: selection?.bbox ?? null };
    setDraft(next);
    onChange(next);
  }

  function updateTimespan(value) {
    const next = { ...draft, timespan: value };
    setDraft(next);
    onChange(next);
  }

  function dragThreshold(value) {
    setDraft((current) => ({ ...current, threshold: value }));
  }

  async function commitThreshold() {
    onChange(draft);
    setSavingThreshold(true);
    try {
      await postThreshold(draft.threshold);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingThreshold(false);
    }
  }

  async function chooseSpeed(index) {
    setSpeedIndex(index);
    const value = SPEED_STEPS[index].value;
    const next = { ...draft, speed: value };
    setDraft(next);
    onChange(next);
    setSavingSpeed(true);
    try {
      await postSpeed(value);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSpeed(false);
    }
  }

  return (
    <aside className="rc-rail left">
      <section className="rc-sec">
        <div className="rc-eyebrow">Configuration</div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="threshold">
            Alert threshold{" "}
            <span>{draft.threshold} CPM{savingThreshold ? " (saving…)" : ""}</span>
          </label>
          <input
            id="threshold"
            type="range"
            min="20"
            max="5000"
            step="10"
            value={draft.threshold}
            onChange={(e) => dragThreshold(Number(e.target.value))}
            onMouseUp={commitThreshold}
            onTouchEnd={commitThreshold}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="area">Display area</label>
          <select
            id="area"
            value={area}
            onChange={(e) => chooseArea(e.target.value)}
          >
            {AREAS.map((item) => (
              <option key={item.label}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="speed">
            Stream speed{" "}
            <span>{SPEED_STEPS[speedIndex].label}{savingSpeed ? " (saving…)" : ""}</span>
          </label>
          <input
            id="speed"
            type="range"
            min={0}
            max={SPEED_STEPS.length - 1}
            step={1}
            value={speedIndex}
            onChange={(e) => chooseSpeed(Number(e.target.value))}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
            <span>Realtime</span>
            <span>Firehose</span>
          </div>
        </div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="timespan">Timespan of displayed data</label>
          <select
            id="timespan"
            value={draft.timespan}
            onChange={(e) => updateTimespan(Number(e.target.value))}
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={12}>Last 12 hours</option>
            <option value={24}>Last 24 hours</option>
          </select>
        </div>

        <TrendChart timeseries={timeseries} hours={draft.timespan} />
        <button
          className={`rc-btn rc-heat${showHeat ? " on" : ""}`}
          type="button"
          onClick={onToggleHeat}
        >
          {showHeat ? "Hide heatmap layer" : "Show heatmap layer"}
        </button>
      </section>
    </aside>
  );
}