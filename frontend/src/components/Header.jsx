const STATUS = {
  disconnected: { color: "var(--muted)",   label: "NOT CONNECTED" },
  connecting:   { color: "var(--accent)",  label: "CONNECTING…"  },
  live:         { color: "var(--safe)",    label: "LIVE"         },
  error:        { color: "var(--high)",    label: "DISCONNECTED" },
};

export default function Header({ status, onToggle }) {
  const { color, label } = STATUS[status] || STATUS.disconnected;
  const isLive = status === "live" || status === "connecting";

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

      {/* Status pill */}
      <div className="rc-conn rc-mono" aria-label="Backend connection status">
        <span className="rc-dot" style={{ background: color }} />
        {label}
      </div>
    </header>
  );
}



