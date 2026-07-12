import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COLORS } from "../constants.js";
import "leaflet.heat";

const DEFAULT_CENTER = [20, 10];
const DEFAULT_ZOOM = 2;
const MAX_MARKERS = 2500;
const LEVEL_INTENSITY = { safe: 0.15, warning: 0.4, elevated: 0.7, high: 1.0 };
const ZOOM_SWITCH = 7;

function sensorTooltip(reading) {
  const location = [reading.city, reading.country].filter(Boolean).join(", ") || reading.sensor_key;
  return `${location}<br><strong>${reading.cpm} CPM</strong> · ${reading.level}`;
}

export function useLeafletMap(containerId) {
  const mapRef = useRef(null);
  const sensorLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const heatCellsRef = useRef(new Map());
  const markersRef = useRef(new Map());
  const markerOrderRef = useRef([]);
  const spikeTimersRef = useRef(new Set());
  const [markerTotal, setMarkerTotal] = useState(0);
  // const heatVisibleRef = useRef(true);

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
    heatLayerRef.current = L.heatLayer([], {
      radius: 28,
      blur: 20,
      max: 3.0,
      minOpacity: 0.2,
      maxZoom: 10,
      gradient: { 0.15:"#38f2a0", 0.4:"#ffb547", 0.7:"#ff7a3c", 1.0:"#ff3b4e" },
    }).addTo(map);   
    mapRef.current = map;

    const applyZoomMode = () => {
      const heat = heatLayerRef.current;
      if (!heat) return;
      if (map.getZoom() >= ZOOM_SWITCH) {
        if (map.hasLayer(heat)) map.removeLayer(heat);   // zoomed in -> hide
      } else {
        if (!map.hasLayer(heat)) map.addLayer(heat);     // zoomed out -> show
        redrawHeat();                                   
      }
    };
    map.on("zoomend", applyZoomMode);
    applyZoomMode();

    const heatPruneId = setInterval(() => {
      const cutoff = Date.now() - 3600 * 1000;  
      let changed = false;
      heatCellsRef.current.forEach((c, gh) => {
      if (c._ts && c._ts < cutoff) {
      heatCellsRef.current.delete(gh);
      changed = true;
    }
    });
    if (changed) redrawHeat();
  }, 60000); 

    const markers = markersRef.current;
    const spikeTimers = spikeTimersRef.current;
    return () => {
      map.off("zoomend", applyZoomMode);
      clearInterval(heatPruneId);
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

    // setTotalReceived((count) => count + 1);

    const el = document.querySelector(".rc-map-empty");   
    if (el) el.style.display = "none";

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
    // setTotalReceived(0);
    readings.forEach(renderSensor);
    setMarkerTotal(markersRef.current.size);
  }, [renderSensor]);

  const redrawHeat = useCallback(() => {
      const layer = heatLayerRef.current;
      if (!layer) return;
      const pts = [];
      heatCellsRef.current.forEach((cell) => {
        const intensity = LEVEL_INTENSITY[cell.level] ?? 0.15;
        pts.push([cell.cell_lat, cell.cell_lon, intensity]);
      });
      layer.setLatLngs(pts);
    }, []);

  // live single cell (channel="heatmap", data = one cell)
  const renderHeatmapCell = useCallback((cell) => {
    if (!cell?.geohash) return;
    cell._ts = Date.now();
    heatCellsRef.current.set(cell.geohash, cell);
    redrawHeat();
  }, [redrawHeat]);


  const renderHeatmap = useCallback((cells) => {
    if (!Array.isArray(cells)) return;
    const now = Date.now();
    cells.forEach((c) => {
      if (c?.geohash) { c._ts = now; heatCellsRef.current.set(c.geohash, c); }
    });
    redrawHeat();
  }, [redrawHeat]);

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

  // const toggleHeatmap = useCallback((visible) => {
  //   const map = mapRef.current;
  //   const layer = heatLayerRef.current;
  //   if (!map || !layer) return;
  //   heatVisibleRef.current = visible;
  //   const zoomedOut = map.getZoom() < 7;
  //   if (visible && zoomedOut) {
  //     if (!map.hasLayer(layer)) layer.addTo(map);
  //   } else {
  //     if (map.hasLayer(layer)) map.remove(layer);
  //   }
  // }, []);

  const markerCount = useCallback(() => markerTotal, [markerTotal]);

  return {
    renderSnapshot,
    renderSensor,
    pulseSpike,
    renderHeatmap,
    renderHeatmapCell,
    flyTo,
    markerCount,
    fitBox,
    resetView,
  };
}
