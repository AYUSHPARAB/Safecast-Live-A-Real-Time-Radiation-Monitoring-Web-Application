import { cpmToColor, cpmToSeverity } from "../utils/colors";

export default function SensorPopup({ sensor }) {
  if (!sensor) return null;

  return (
    <div
      style={{
        minWidth: "230px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <h3
        style={{
          margin: "0 0 10px",
          color: "#2563eb",
          fontSize: "18px",
        }}
      >
        {sensor.display_name || sensor.location_name || "Unknown Location"}
      </h3>

      {/* CPM */}
      <div
        style={{
          fontSize: "26px",
          fontWeight: "700",
          color: cpmToColor(sensor.cpm),
          marginBottom: "12px",
        }}
      >
        {sensor.cpm} CPM
      </div>

      <table
        style={{
          width: "100%",
          fontSize: "13px",
          borderCollapse: "collapse",
        }}
      >
        <tbody>
          <tr>
            <td>
              <strong>Status</strong>
            </td>
            <td>{sensor.level || cpmToSeverity(sensor.cpm)}</td>
          </tr>

          <tr>
            <td>
              <strong>Sensor</strong>
            </td>
            <td>{sensor.device_id}</td>
          </tr>

          <tr>
            <td>
              <strong>Latitude</strong>
            </td>
            <td>{sensor.latitude.toFixed(4)}</td>
          </tr>

          <tr>
            <td>
              <strong>Longitude</strong>
            </td>
            <td>{sensor.longitude.toFixed(4)}</td>
          </tr>

          <tr>
            <td>
              <strong>Captured</strong>
            </td>
            <td>{sensor.captured_at_dt || "-"}</td>
          </tr>

          <tr>
            <td>
              <strong>Unit</strong>
            </td>
            <td>{sensor.unit || "CPM"}</td>
          </tr>
        </tbody>
      </table>

      {/* Placeholder for future chart */}
      <div
        style={{
          marginTop: "16px",
          padding: "10px",
          textAlign: "center",
          border: "1px dashed #cbd5e1",
          borderRadius: "6px",
          color: "#64748b",
          fontSize: "12px",
        }}
      >
        📈 Time-Series Chart
        <br />
        <small>(Coming soon)</small>
      </div>
    </div>
  );
}