import { useEffect, useState } from "react";
import { getAlerts } from "../services/api";
import { subscribeLiveUpdates } from "../services/websocket";
import { cpmToColor } from "../utils/colors";

const MAX_ALERTS = 100;

function alertKey(alert) {
  return `${alert.sensor_key || alert.device_id}-${alert.captured_at}-${alert.cpm}`;
}

export default function AlertPanel({
  className = "",
  dangerSensors = [],
  threshold = null,
}) {
  const [alerts, setAlerts] =useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const thresholdValue = Number(threshold);
  const hasThreshold =
    threshold !== null &&
    threshold !== "" &&
    Number.isFinite(thresholdValue);

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      try {
        setLoading(true);

        const data = await getAlerts();
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

  if (hasThreshold) {
    return (
      <div className={`alerts-panel ${className}`.trim()}>
        <h3>Threshold Alerts</h3>

        {dangerSensors.length === 0 ? (
          <p>No sensors exceed {thresholdValue} CPM.</p>
        ) : (
          dangerSensors.map((sensor) => (
            <div
              className="alert-row"
              key={`${sensor.sensor_key || sensor.device_id}-${sensor.captured_at}`}
            >
              <div className="alert-icon">
                ⚠️
              </div>

              <div className="alert-message">
                <strong>
                  {sensor.display_name || sensor.location_name || sensor.device_id}
                </strong>

                <div>
                  CPM exceeds configured threshold
                </div>

                <small
                  style={{
                    color: cpmToColor(sensor.cpm),
                    fontWeight: "bold",
                  }}
                >
                  {sensor.cpm} CPM / threshold {thresholdValue} CPM
                </small>

                <div className="threshold-location">
                  {sensor.location_name || sensor.device_id}
                </div>
              </div>

              <div
                className="alert-time"
                style={{
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                {sensor.captured_at_dt || sensor.uploaded_at || ""}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

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
