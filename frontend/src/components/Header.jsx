export default function Header() {
  return (
    <header className="rc-head">
      <div className="rc-logo">
        <span className="rc-pulse" />
        <div>
          <div className="rc-title rc-disp">SAFECAST&nbsp;LIVE</div>
          <div className="rc-sub rc-mono">RADIATION MONITORING CONSOLE</div>
        </div>
      </div>
      <div className="rc-spacer" />
      <div className="rc-conn rc-mono" aria-label="Backend connection status">
        <span className="rc-dot" /> BACKEND NOT CONNECTED
      </div>
    </header>
  );
}
