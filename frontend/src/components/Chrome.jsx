import { COLORS } from "../constants.js";

const LEVELS = [
  ["safe"],
  ["warning"],
  ["elevated"],
  ["high"],
];

export function Legend() {
  return (
    <div className="rc-legend rc-mono">
      <div className="rc-legend-head">LEVEL</div>
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
