import { useState } from "react";

const AREAS = [
  { label: "World (no filter)", bbox: null },
  { label: "Germany", bbox: { s: 47.2, w: 5.8, n: 55.1, e: 15.1 } },
  { label: "Japan", bbox: { s: 31, w: 129.4, n: 45.6, e: 145.8 } },
  { label: "Europe", bbox: { s: 35, w: -11, n: 71, e: 31 } },
  { label: "United States", bbox: { s: 24, w: -125, n: 49, e: -66 } },
];

export default function ConfigPanel({ cfg, onChange, showHeat, onToggleHeat }) {
  const [draft, setDraft] = useState(cfg);
  const [area, setArea] = useState(AREAS[0].label);

  function chooseArea(label) {
    const selection = AREAS.find((item) => item.label === label);
    setArea(label);
    setDraft((current) => ({ ...current, bbox: selection?.bbox ?? null }));
  }

  return (
    <aside className="rc-rail left">
      <section className="rc-sec">
        <div className="rc-eyebrow">Configuration</div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="threshold">
            Alert threshold <span>{draft.threshold} CPM</span>
          </label>
          <input id="threshold" type="range" min="20" max="500" step="10"
            value={draft.threshold}
            onChange={(event) => setDraft({ ...draft, threshold: Number(event.target.value) })} />
        </div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="timespan">Timespan of displayed data</label>
          <select id="timespan" value={draft.timespan}
            onChange={(event) => setDraft({ ...draft, timespan: Number(event.target.value) })}>
            <option value={300}>Last 5 minutes</option>
            <option value={900}>Last 15 minutes</option>
            <option value={3600}>Last hour</option>
            <option value={21600}>Last 6 hours</option>
            <option value={86400}>Last 24 hours</option>
          </select>
        </div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="area">Display area</label>
          <select id="area" value={area} onChange={(event) => chooseArea(event.target.value)}>
            {AREAS.map((item) => <option key={item.label}>{item.label}</option>)}
          </select>
          <p className="rc-hint">Map navigation is local. Filtering will be applied by the backend later.</p>
        </div>

        <div className="rc-field">
          <label className="rc-flabel" htmlFor="speed">
            Stream speed <span>{draft.speed}×</span>
          </label>
          <input id="speed" type="range" min="0.5" max="10" step="0.5"
            value={draft.speed}
            onChange={(event) => setDraft({ ...draft, speed: Number(event.target.value) })} />
          <p className="rc-hint">Stored as configuration only; no stream is simulated in the browser.</p>
        </div>

        <button className="rc-apply" type="button" onClick={() => onChange(draft)}>
          Apply configuration
        </button>
        <button className={`rc-btn rc-heat${showHeat ? " on" : ""}`} type="button" onClick={onToggleHeat}>
          {showHeat ? "Hide heatmap layer" : "Show heatmap layer"}
        </button>
        <p className="rc-hint">Heatmap is empty until backend cells are integrated.</p>
      </section>
    </aside>
  );
}