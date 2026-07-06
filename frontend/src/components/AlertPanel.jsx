import { useEffect, useState } from "react";
import { getAlerts } from "../services/api";
import { cpmToColor } from "../utils/colors";

export default function AlertPanel() {
  const [alerts, setAlerts] =useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAlerts() {
      try {
        setLoading(true);

        const data = await getAlerts();

        setAlerts(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load alerts.");
      } finally {
        setLoading(false);
      }
    }

    loadAlerts();
  }, []);

  if (loading) {
    return (
      <div className="alerts-panel">
        <h3>Recent Alerts</h3>
        <p>Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-panel">
        <h3>Recent Alerts</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="alerts-panel">
        <h3>Recent Alerts</h3>
        <p>No active alerts.</p>
      </div>
    );
  }

  return (
    <div className="alerts-panel">
      <h3>Recent Alerts</h3>

      {alerts.map((alert) => (
        <div
          className="alert-row"
          key={`${alert.device_id}-${alert.captured_at}`}
        >
          <div className="alert-icon">
            ⚠️
          </div>

          <div className="alert-message">
            <strong>{alert.display_name}</strong>

            <div>
              {alert.alert_text}
            </div>

            <small
              style={{
                color: cpmToColor(alert.cpm),
                fontWeight: "bold",
              }}
            >
              {alert.cpm} CPM ({alert.level})
            </small>
          </div>

          <div
            className="alert-time"
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            {alert.captured_at_dt}
          </div>
        </div>
      ))}
    </div>
  );
}