import { useEffect, useState } from "react";
import { getAlerts } from "../services/api";
import { cpmToColor } from "../utils/colors";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getAlerts(100)
      .then(setAlerts)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page-placeholder">
      <h2>Alerts</h2>
      <p className="page-count">{alerts.length} active alert{alerts.length !== 1 ? "s" : ""}</p>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}
      {alerts.length === 0 && !error && <p className="muted">No alerts right now.</p>}

      <div className="alerts-page-list">
        {alerts.map((a, i) => (
          <div className="alert-card" key={i}>
            <span className="alert-badge">⚠</span>
            <div className="alert-body">
              <div className="alert-title">
                {a.alert_text || `High radiation at ${a.display_name || a.device_id}`}
              </div>
              <div className="alert-sub">
                {a.display_name || a.device_id}
                {a.device_id ? ` · ${a.device_id}` : ""}
              </div>
            </div>
            <div className="alert-cpm" style={{ color: cpmToColor(a.cpm) }}>
              {a.cpm} CPM
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}