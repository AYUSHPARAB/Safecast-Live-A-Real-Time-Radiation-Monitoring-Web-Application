import { useEffect, useState } from "react";
import { getAlerts } from "../services/api";
import { subscribeLiveUpdates } from "../services/websocket";
import { levelToColor } from "../utils/colors";

const MAX_ALERTS = 5;

function alertKey(alert) {
  return `${alert.sensor_key || alert.device_id}-${alert.captured_at}-${alert.cpm}`;
}

export default function AlertPanel({ className = "" }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      try {
        setLoading(true);

        const data = await getAlerts(MAX_ALERTS);
        if (!active) return;

        setAlerts(Array.isArray(data) ? data.slice(0, MAX_ALERTS) : []);
      } catch (err) {
        console.error(err);
        if (active) setError("Unable to load alerts.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAlerts();

    const unsubscribeAlerts = subscribeLiveUpdates("alerts", (alert) => {
      if (!alert) return;

      setAlerts((current) => {
        const next = [alert, ...current];
        const seen = new Set();

        return next
          .filter((item) => {
            const key = alertKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, MAX_ALERTS);
      });
      setLoading(false);
      setError("");
    });

    return () => {
      active = false;
      unsubscribeAlerts();
    };
  }, []);

  if (loading) {
    return (
      <div className={`alerts-panel ${className}`.trim()}>
        <h3>Recent Alerts</h3>
        <p>Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`alerts-panel ${className}`.trim()}>
        <h3>Recent Alerts</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className={`alerts-panel ${className}`.trim()}>
        <h3>Recent Alerts</h3>
        <p>No active alerts.</p>
      </div>
    );
  }

  return (
    <div className={`alerts-panel ${className}`.trim()}>
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
              style={{ color: levelToColor(alert.level, alert.cpm) }}
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
      <div className="top-locations-placeholder">
        Top dangerous locations require backend exposure of radiation-top.
      </div>
    </div>
  );
}
