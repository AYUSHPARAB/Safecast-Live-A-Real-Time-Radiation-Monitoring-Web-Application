import { useCallback, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import ConfigPanel from "./components/ConfigPanel.jsx";
import { Legend, Ticker } from "./components/Chrome.jsx";
import { AlertsFeed, SpikesFeed, StatsPanel, TopHotspots } from "./components/SidePanels.jsx";
import { useLeafletMap } from "./lib/useLeafletMap.js";
import { useLiveStream } from "./lib/useLiveStream.js";
import {
  getAlerts,
  getCurrentStats,
  getHealth,
  getSpikes,
  getTopHotspots,
} from "./services/api.js";

const DEFAULT_CONFIG = {
  threshold: 100,
  timespan: 3600,
  bbox: null,
  speed: 1,
};

export default function App() {
  const map = useLeafletMap("rc-map");

  const [config,      setConfig]      = useState(DEFAULT_CONFIG);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // ── Live data state 
  const [stats,     setStats]     = useState(null);
  const [alerts,    setAlerts]    = useState([]);
  const [spikes,    setSpikes]    = useState([]);
  const [hotspots,  setHotspots]  = useState([]);
  const [tickItems, setTickItems] = useState([]);
  const [health,    setHealth]    = useState(undefined);

  const lastTickRef = useRef(0);

  const onMessage = useCallback((msg) => {
    const { channel, data } = msg;
    if (!channel || data === undefined) return;

    console.log("[WS]", channel, data);
    switch (channel) {

      case "map":
        // Full sensor snapshot sent once on WS connect.
        
        map.renderSnapshot(data.points ?? []);
        break;

      case "current":
        
        map.renderSensor(data);
        // Update ticker at most every 2 seconds — otherwise unreadable
        if (Date.now() - lastTickRef.current > 2000) {
          lastTickRef.current = Date.now();
          setTickItems((prev) =>
            [{ cpm: data.cpm, city: data.city, level: data.level }, ...prev].slice(0, 6)
          );
        }
        break;

      case "alerts":
        
        setAlerts((prev) => [data, ...prev].slice(0, 20));
        break;

      case "spikes":
       
        setSpikes((prev) => [data, ...prev].slice(0, 10));
        map.pulseSpike(data);
        break;

      case "stats":
        
        setStats(data);
        break;

      case "heatmap":
       
        map.renderHeatmap(data.cells ?? []);
        break;

      case "top":
        
        setHotspots(data.hotspots ?? []);
        break;

      case "config":
        
        if (data.threshold !== undefined) {
          setConfig((prev) => ({ ...prev, threshold: data.threshold }));
        }
        break;

      default:
        break;
    }
  }, [map]);

  const { status, connect, disconnect } = useLiveStream(onMessage);

 
  async function handleToggle() {
    if (status === "live" || status === "connecting") {
      disconnect();
      return;
    }

    
    try {
      const h = await getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }

    
    await Promise.allSettled([
      getCurrentStats().then((data) =>
        onMessage({ channel: "stats", data })
      ),
      getAlerts(20).then((items) => {
        if (!Array.isArray(items)) return;
        items.forEach((d) => onMessage({ channel: "alerts", data: d }));
      }),
      getSpikes(50).then((items) => {
        if (!Array.isArray(items)) return;
        items.forEach((d) => onMessage({ channel: "spikes", data: d }));
      }),
      getTopHotspots().then((data) =>
        onMessage({ channel: "top", data })
      ),
    ]);

    // Open WebSocket — live ticks continue from here
    connect();
  }

  // ── Config apply 
  function changeConfig(next) {
    setConfig(next);
    // Map zoom 
    if (next.bbox) map.fitBox(next.bbox);
    else           map.resetView();
    
  }

  function toggleHeatmap() {
    setShowHeatmap((visible) => {
      map.toggleHeatmap(!visible);
      return !visible;
    });
  }

  return (
    <div className="rc-root">
      <Header status={status} health={health} onToggle={handleToggle} />

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
          
          <StatsPanel stats={stats} timeseries={timeseries} onMap={map.receivedCount()} />

          
          <AlertsFeed alerts={alerts} />
          <TopHotspots
            hotspots={hotspots}
            onSelect={(lat, lon) => map.flyTo(lat, lon)}
          />
          <SpikesFeed spikes={spikes} />
        </aside>
      </div>

      
      <Ticker items={tickItems} status={status} />
    </div>
  );
}
