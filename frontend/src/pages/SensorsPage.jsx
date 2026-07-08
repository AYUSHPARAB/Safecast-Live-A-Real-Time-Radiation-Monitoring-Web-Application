import { useEffect, useState } from "react";
import { getSensors } from "../services/api";

export default function SensorsPage() {
  const [sensors, setSensors] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getSensors()
      .then(setSensors)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page-placeholder">
      <h2>Sensors</h2>
      <p className="page-count">{sensors.length} sensor{sensors.length !== 1 ? "s" : ""} reporting</p>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      <table className="sensors-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Location</th>
            <th>CPM</th>
            <th>Level</th>
            <th>Latitude</th>
            <th>Longitude</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map((s) => (
            <tr key={s.sensor_key || s.device_id}>
              <td>{s.device_id}</td>
              <td>{s.display_name || s.location_name || "—"}</td>
              <td className="cpm-cell">{s.cpm}</td>
              <td>
                <span className={"sensor-level " + (s.level === "high" ? "high" : "safe")}>
                  {s.level === "high" ? "High" : "Safe"}
                </span>
              </td>
              <td>{s.latitude?.toFixed(3)}</td>
              <td>{s.longitude?.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}