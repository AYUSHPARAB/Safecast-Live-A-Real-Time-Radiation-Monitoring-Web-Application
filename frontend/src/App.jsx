import { useState } from "react";
import Header from "./components/Header.jsx";
import ConfigPanel from "./components/ConfigPanel.jsx";
import { Legend, Ticker } from "./components/Chrome.jsx";
import { AlertsFeed, SpikesFeed, StatsPanel, TopHotspots } from "./components/SidePanels.jsx";
import { useLeafletMap } from "./lib/useLeafletMap.js";

const DEFAULT_CONFIG = {
  threshold: 100,
  timespan: 3600,
  bbox: null,
  speed: 1,
};

export default function App() {
  const map = useLeafletMap("rc-map");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [showHeatmap, setShowHeatmap] = useState(false);

  function changeConfig(next) {
    setConfig(next);
    if (next.bbox) map.fitBox(next.bbox);
    else map.resetView();
  }

  function toggleHeatmap() {
    setShowHeatmap((visible) => {
      map.toggleHeatmap(!visible);
      return !visible;
    });
  }

  return (
    <div className="rc-root">
      <Header />
      <div className="rc-body">
        <ConfigPanel
          cfg={config}
          onChange={changeConfig}
          showHeat={showHeatmap}
          onToggleHeat={toggleHeatmap}
        />

        <main className="rc-map-wrap" aria-label="Radiation sensor map">
          <div id="rc-map" />
          <div className="rc-map-empty">Awaiting sensor data</div>
          <Legend />
        </main>

        <aside className="rc-rail right">
          <StatsPanel />
          <AlertsFeed alerts={[]} />
          <TopHotspots hotspots={[]} />
          <SpikesFeed spikes={[]} />
        </aside>
      </div>
      <Ticker items={[]} />
    </div>
  );
}
