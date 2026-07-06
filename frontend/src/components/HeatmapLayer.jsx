import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

import { clusterSensors } from "../utils/heatmapCluster";

export default function HeatmapLayer({ sensors = [] }) {
  const map = useMap();

  const zoom = map.getZoom();

  useEffect(() => {
    if (!map) return;

    //--------------------------------------------------
    // Create weighted clusters
    //--------------------------------------------------

  const clusters = clusterSensors(
    sensors,
    {
      zoom,
      maxExpectedCPM:500,
      cpmWeight:0.7,
      densityWeight:0.3,
    }
    );

    //--------------------------------------------------
    // Convert to Leaflet heat format
    //--------------------------------------------------

    const heatPoints = clusters.map((cluster) => [
      cluster.lat,
      cluster.lon,
      cluster.weight,
    ]);

    //--------------------------------------------------
    // Create heat layer
    //--------------------------------------------------

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

  }, [map, sensors]);

  return null;
}