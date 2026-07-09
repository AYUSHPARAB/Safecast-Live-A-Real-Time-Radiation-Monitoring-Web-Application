import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export default function HeatmapLayer({ cells = [] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Presentation only: Flink/backend should emit heatmap-ready cells.
    const heatPoints = cells
      .filter((cell) => cell.cell_lat != null && cell.cell_lon != null)
      .map((cell) => [
        cell.cell_lat,
        cell.cell_lon,
        Math.min(Number(cell.avg_cpm || cell.max_cpm || 0) / 500, 1),
      ]);

    if (heatPoints.length === 0) return;

    const heatLayer = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 20,
      maxZoom: 10,

      gradient: {
        0.20: "#0044ff",
        0.40: "#00ffff",
        0.60: "#00ff00",
        0.80: "#ffff00",
        1.00: "#ff0000",
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };

  }, [map, cells]);

  return null;
}
