import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COLORS } from "../constants.js";

const DEFAULT_CENTER = [20, 10];
const DEFAULT_ZOOM = 2;
const MAX_MARKERS = 2500;

function sensorTooltip(reading) {
  const location = [reading.city, reading.country].filter(Boolean).join(", ") || reading.sensor_key;
  return `${location}<br><strong>${reading.cpm} CPM</strong> · ${reading.level}`;
}

export function useLeafletMap(containerId) {
  const mapRef = useRef(null);
  const sensorLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const markerOrderRef = useRef([]);
  const spikeTimersRef = useRef(new Set());
  const [markerTotal, setMarkerTotal] = useState(0);

  useEffect(() => {
    const map = L.map(containerId, {
      attributionControl: true,
      worldCopyJump: true,
      zoomControl: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 18,
      subdomains: "abcd",
    }).addTo(map);

    sensorLayerRef.current = L.layerGroup().addTo(map);
    heatLayerRef.current = L.layerGroup();
    mapRef.current = map;

    const markers = markersRef.current;
    const spikeTimers = spikeTimersRef.current;
    return () => {
      spikeTimers.forEach((timer) => clearInterval(timer));
      spikeTimers.clear();
      markers.clear();
      markerOrderRef.current = [];
      map.remove();
      mapRef.current = null;
      sensorLayerRef.current = null;
      heatLayerRef.current = null;
    };
  }, [containerId]);

  const renderSensor = useCallback((reading) => {
    const layer = sensorLayerRef.current;
    if (!layer || !reading?.sensor_key) return;

    const color = COLORS[reading.level] || COLORS.safe;
    const radius = 4 + Math.min(8, reading.cpm / 60);
    let marker = markersRef.current.get(reading.sensor_key);

    if (marker) {
      marker.setLatLng([reading.latitude, reading.longitude]);
      marker.setStyle({ color, fillColor: color });
      marker.setRadius(radius);
    } else {
      marker = L.circleMarker([reading.latitude, reading.longitude], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1,
      }).addTo(layer);
      markersRef.current.set(reading.sensor_key, marker);
      markerOrderRef.current.push(reading.sensor_key);

      if (markerOrderRef.current.length > MAX_MARKERS) {
        const oldestKey = markerOrderRef.current.shift();
        const oldestMarker = markersRef.current.get(oldestKey);
        if (oldestMarker) layer.removeLayer(oldestMarker);
        markersRef.current.delete(oldestKey);
      }
      setMarkerTotal(markersRef.current.size);
    }

    marker.bindTooltip(sensorTooltip(reading), { direction: "top", offset: [0, -4] });
  }, []);

  const renderSnapshot = useCallback((readings) => {
    const layer = sensorLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    markersRef.current.clear();
    markerOrderRef.current = [];
    readings.forEach(renderSensor);
    setMarkerTotal(markersRef.current.size);
  }, [renderSensor]);

  const renderHeatmap = useCallback((cells) => {
    const layer = heatLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    cells.forEach((cell) => {
      const color = COLORS[cell.level] || COLORS.safe;
      L.circleMarker([cell.cell_lat, cell.cell_lon], {
        radius: 10 + Math.min(20, cell.count / 10),
        color,
        fillColor: color,
        fillOpacity: 0.25,
        weight: 0,
      })
        .bindTooltip(`${cell.location || "Cluster"}<br>avg ${cell.avg_cpm} · max ${cell.max_cpm} · n=${cell.count}`)
        .addTo(layer);
    });
  }, []);

  const pulseSpike = useCallback((reading) => {
    const map = mapRef.current;
    if (!map) return;

    const ring = L.circleMarker([reading.latitude, reading.longitude], {
      radius: 6,
      color: COLORS.high,
      fillColor: COLORS.high,
      fillOpacity: 0.5,
      weight: 2,
    }).addTo(map);
    let radius = 6;
    const timer = setInterval(() => {
      radius += 4;
      ring.setRadius(radius);
      ring.setStyle({ fillOpacity: Math.max(0, 0.5 - radius / 60) });
      if (radius > 40) {
        clearInterval(timer);
        spikeTimersRef.current.delete(timer);
        map.removeLayer(ring);
      }
    }, 60);
    spikeTimersRef.current.add(timer);
  }, []);

  const fitBox = useCallback((bbox) => {
    mapRef.current?.fitBounds([[bbox.s, bbox.w], [bbox.n, bbox.e]]);
  }, []);

  const resetView = useCallback(() => {
    mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }, []);

  const flyTo = useCallback((lat, lon, zoom = 9) => {
    mapRef.current?.setView([lat, lon], zoom);
  }, []);

  const toggleHeatmap = useCallback((visible) => {
    const map = mapRef.current;
    const layer = heatLayerRef.current;
    if (!map || !layer) return;
    if (visible) layer.addTo(map);
    else layer.remove();
  }, []);

  const markerCount = useCallback(() => markerTotal, [markerTotal]);

  return {
    renderSnapshot,
    renderSensor,
    pulseSpike,
    renderHeatmap,
    flyTo,
    markerCount,
    fitBox,
    resetView,
    toggleHeatmap,
  };
}
