import { COLORS } from "../constants.js";

const LEVELS = [
  ["safe", "< 50"],
  ["warning", "50–99"],
  ["elevated", "100–299"],
  ["high", "≥ 300"],
];

export function Legend() {
  return (
    <div className="rc-legend rc-mono">
      <div className="rc-legend-head">LEVEL · CPM</div>
      {LEVELS.map(([level, range]) => (
        <div className="rc-li" key={level}>
          <span className="rc-lvl" style={{ background: COLORS[level] }} />
          <span>{level}</span>
          <span className="rc-li-v">{range}</span>
        </div>
      ))}
    </div>
  );
}

export function Ticker({ items }) {
  return (
    <footer className="rc-ticker">
      <span className="rc-geiger" />
      <span className="rc-tick-label">STREAM</span>
      {items.length === 0 ? (
        <span className="rc-tick-item">Awaiting backend readings…</span>
      ) : null}
    </footer>
  );
}
