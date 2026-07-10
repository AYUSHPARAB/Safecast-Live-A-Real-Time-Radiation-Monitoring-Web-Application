import { useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [20, 10];
const DEFAULT_ZOOM = 2;

export function useLeafletMap(containerId) {
  const mapRef = useRef(null);
  const heatLayerRef = useRef(null);

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

    heatLayerRef.current = L.layerGroup();
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      heatLayerRef.current = null;
    };
  }, [containerId]);

  const fitBox = useCallback((bbox) => {
    mapRef.current?.fitBounds([[bbox.s, bbox.w], [bbox.n, bbox.e]]);
  }, []);

  const resetView = useCallback(() => {
    mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }, []);

  const toggleHeatmap = useCallback((visible) => {
    const map = mapRef.current;
    const layer = heatLayerRef.current;
    if (!map || !layer) return;
    if (visible) layer.addTo(map);
    else layer.remove();
  }, []);

  return { fitBox, resetView, toggleHeatmap };
}
