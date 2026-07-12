import { COLORS } from "../constants.js";

const LEVELS = [
  ["safe"],
  ["warning"],
  ["elevated"],
  ["high"],
];

const DOT_COLOR = {
  disconnected: "var(--muted)",
  connecting:   "var(--accent)",
  live:         "var(--safe)",
  error:        "var(--high)",
};

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

export function Ticker({ items, status }) {
  const dotColor = DOT_COLOR[status] || "var(--muted)";

  return (
    <footer className="rc-ticker">
      <span
        className="rc-geiger"
        style={{
          background: dotColor,
          animation: status === "live" ? "ticker-blink 0.9s step-start infinite" : "none",
          flexShrink: 0,
        }}
      />
      <span className="rc-tick-label" style={{ flexShrink: 0 }}>
        STREAM
      </span>

      {/* ADD this wrapper div */}
      <div className="rc-ticker-track">
        {items.length === 0 ? (
          <span className="rc-tick-item" style={{ color: "var(--muted)" }}>
            {status === "live" ? "Receiving…" : "Awaiting backend readings…"}
          </span>
        ) : (
          items.map((item, i) => (
            <span className="rc-tick-item" key={i}>
              {item.city || "—"}&nbsp;
              <b style={{ color: COLORS[item.level] || COLORS.safe }}>
                {item.cpm} cpm
              </b>
              <span style={{ color: "var(--muted)", margin: "0 6px" }}>·</span>
            </span>
          ))
        )}
      </div>
    </footer>
  );
}
