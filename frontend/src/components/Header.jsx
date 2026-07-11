const STATUS = {
  disconnected: { color: "var(--muted)",   label: "NOT CONNECTED" },
  connecting:   { color: "var(--accent)",  label: "CONNECTING…"  },
  live:         { color: "var(--safe)",    label: "LIVE"         },
  error:        { color: "var(--high)",    label: "DISCONNECTED" },
};

export default function Header({ status, health, onToggle }) {
  const { color, label } = STATUS[status] || STATUS.disconnected;
  const isLive = status === "live" || status === "connecting";
  const healthState = health === undefined
    ? { color: "var(--muted)", label: "CHECKING API…" }
    : health?.status === "ok" && health.redis
      ? { color: "var(--safe)", label: "API HEALTHY" }
      : health?.status === "ok"
        ? { color: "var(--warning)", label: "REDIS UNAVAILABLE" }
        : { color: "var(--high)", label: "API UNAVAILABLE" };

  return (
    <header className="rc-head">
      <div className="rc-logo">
        {/* Pulse dot — colour driven by connection status */}
        <span
          className="rc-pulse"
          style={{
            background: color,
            animation:  isLive ? "pulse-ring 2s infinite" : "none",
          }}
        />
        <div>
          <div className="rc-title rc-disp">SAFECAST&nbsp;LIVE</div>
          <div className="rc-sub rc-mono">RADIATION MONITORING CONSOLE</div>
        </div>
      </div>

      <div className="rc-spacer" />

      {/* Go live / Disconnect button */}
      <button
        className={`rc-conn-btn${isLive ? " rc-conn-btn--live" : ""}`}
        type="button"
        onClick={onToggle}
        style={{ marginRight: 10 }}
      >
        {isLive ? "Disconnect" : "Go live"}
      </button>

      <div className="rc-conn rc-mono" aria-label="Backend API health">
        <span className="rc-dot" style={{ background: healthState.color }} />
        {healthState.label}
      </div>

      {/* Status pill */}
      <div className="rc-conn rc-mono" aria-label="Backend connection status">
        <span className="rc-dot" style={{ background: color }} />
        {label}
      </div>
    </header>
  );
}


