import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import { useMap } from "react-leaflet";

import { getSensors } from "../services/api";
import { subscribeLiveUpdates } from "../services/websocket";
import { cpmToColor } from "../utils/colors";
import SensorPopup from "./SensorPopup";
import HeatmapLayer from "./HeatmapLayer";

const MAX_SENSOR_POINTS = 10000;

function sensorIdentity(sensor) {
  return (
    sensor.sensor_key ||
    sensor.device_id ||
    `${Number(sensor.latitude).toFixed(4)}:${Number(sensor.longitude).toFixed(4)}`
  );
}

function mergeSensor(existingSensors, nextSensor) {
  const nextKey = sensorIdentity(nextSensor);
  const merged = new Map(
    existingSensors.map((sensor) => [sensorIdentity(sensor), sensor])
  );

  merged.set(nextKey, nextSensor);

  return Array.from(merged.values()).slice(-MAX_SENSOR_POINTS);
}

function ChangeMapView({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}


export default function MapView({ filters, onDangerSensorsChange }) {
  const [sensors, setSensors] = useState([]);
  const [heatmapCells, setHeatmapCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const thresholdValue = Number(filters?.threshold);
  const hasThreshold =
    filters?.threshold !== null &&
    filters?.threshold !== "" &&
    Number.isFinite(thresholdValue);

  useEffect(() => {
    let active = true;

    async function loadSensors() {
      try {
        setLoading(true);
        setError("");

        const sensorData = await getSensors(filters);
        if (!active) return;

        setSensors(Array.isArray(sensorData) ? sensorData.slice(-MAX_SENSOR_POINTS) : []);
      } catch (err) {
        console.error(err);
        if (active) setError("Failed to load sensor data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSensors();

    return () => {
      active = false;
    };
  }, [filters?.bbox, filters?.minCpm]);

  useEffect(() => {
    const unsubscribeMap = subscribeLiveUpdates("map", (data) => {
      const points = data?.points;
      if (!Array.isArray(points)) return;

      setSensors(points.slice(-MAX_SENSOR_POINTS));
      setLoading(false);
      setError("");
    });

    const unsubscribeCurrent = subscribeLiveUpdates("current", (point) => {
      if (!point) return;

      setSensors((current) => mergeSensor(current, point));
      setLoading(false);
      setError("");
    });

    const unsubscribeHeatmap = subscribeLiveUpdates("heatmap", (data) => {
      const cells = Array.isArray(data?.cells) ? data.cells : data ? [data] : [];
      setHeatmapCells(cells.slice(-MAX_SENSOR_POINTS));
    });

    return () => {
      unsubscribeMap();
      unsubscribeCurrent();
      unsubscribeHeatmap();
    };
  }, []);

  const visibleSensors = useMemo(() => {
    return sensors.filter((sensor) => {
      if (!filters) return true;

      if (filters.minCpm != null && sensor.cpm < filters.minCpm) return false;
      if (filters.maxCpm != null && sensor.cpm > filters.maxCpm) return false;
      if (hasThreshold && Number(sensor.cpm) < thresholdValue) return false;

      return true;
    });
  }, [filters, hasThreshold, sensors, thresholdValue]);

  const dangerSensors = useMemo(() => {
    return hasThreshold ? visibleSensors : [];
  }, [hasThreshold, visibleSensors]);

  useEffect(() => {
    onDangerSensorsChange?.(dangerSensors);
  }, [dangerSensors, onDangerSensorsChange]);

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
      
      <HeatmapLayer cells={heatmapCells} />

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

      {!loading && !error && visibleSensors.length === 0 && (
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
          No sensor data for the current filters.
        </div>
      )}

      {visibleSensors.map((sensor) => (
        <CircleMarker
          key={sensor.sensor_key || sensor.device_id}
          center={[sensor.latitude, sensor.longitude]}
          radius={hasThreshold ? 6 : 4}
          pathOptions={{
            color: hasThreshold ? "#ef4444" : cpmToColor(sensor.cpm),
            fillColor: hasThreshold ? "#ef4444" : cpmToColor(sensor.cpm),
            fillOpacity: hasThreshold ? 0.95 : 0.85,
            weight: hasThreshold ? 2 : 1,
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
