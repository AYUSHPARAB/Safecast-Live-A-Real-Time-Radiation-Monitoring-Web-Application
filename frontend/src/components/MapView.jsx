import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import { useMap } from "react-leaflet";

import { getSensors } from "../services/api";
import { cpmToColor } from "../utils/colors";
import SensorPopup from "./SensorPopup";
import HeatmapLayer from "./HeatmapLayer";

function ChangeMapView({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}


export default function MapView({ filters }) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSensors() {
      try {
        setLoading(true);
        setError("");

        // Pass filters to the API
        const sensorData = await getSensors(filters);

        setSensors(sensorData);
      } catch (err) {
        console.error(err);
        setError("Failed to load sensor data.");
      } finally {
        setLoading(false);
      }
    }

    loadSensors();
  }, [filters]); // Reload whenever filters change

  const visibleSensors = sensors.filter((sensor) => {
    if (!filters) return true;

    if (filters.minCpm != null && sensor.cpm < filters.minCpm) return false;
    if (filters.maxCpm != null && sensor.cpm > filters.maxCpm) return false;

    return true;
  });

  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      style={{
        height: "620px",
        width: "100%",
        background: "#0b1120",
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap, &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <HeatmapLayer sensors={visibleSensors} />

      <ChangeMapView
        center={filters?.center || [20, 10]}
        zoom={filters?.zoom || 2}
      />
      
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 1000,
            background: "#111827",
            color: "white",
            padding: "8px 12px",
            borderRadius: 6,
          }}
        >
          Loading sensors...
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 1000,
            background: "#7f1d1d",
            color: "white",
            padding: "8px 12px",
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      {visibleSensors.map((sensor) => (
        <CircleMarker
          key={sensor.sensor_key || sensor.device_id}
          center={[sensor.latitude, sensor.longitude]}
          radius={4}
          pathOptions={{
            color: cpmToColor(sensor.cpm),
            fillColor: cpmToColor(sensor.cpm),
            fillOpacity: 0.85,
            weight: 1,
          }}
        >
          <Popup>
            <SensorPopup sensor={sensor} />
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}