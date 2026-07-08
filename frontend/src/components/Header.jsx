export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">☢️</span>

        <div>
          <h2>Radiation Monitor</h2>
        </div>
      </div>

      <div className="status-live">
        <span className="live-dot"></span>
        LIVE
      </div>
    </header>
  );
}