import { useCallback, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import ConfigPanel from "./components/ConfigPanel.jsx";
import { Legend, Ticker } from "./components/Chrome.jsx";
import { AlertsFeed, SpikesFeed, StatsPanel, TopHotspots } from "./components/SidePanels.jsx";
import { useLeafletMap } from "./lib/useLeafletMap.js";
import { useLiveStream } from "./lib/useLiveStream.js";

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

  // ── Live data state 
  
  const [stats,     setStats]     = useState(null);    
  const [alerts,    setAlerts]    = useState([]);        
  const [spikes,    setSpikes]    = useState([]);        
  const [hotspots,  setHotspots]  = useState([]);         
  const [tickItems, setTickItems] = useState([]);         

   const lastTickRef = useRef(0);


  const onMessage = useCallback((msg) => {
    console.log("WS message:", msg.channel, msg.data); 
    const { channel, data } = msg;

    
    if (!channel || data === undefined) return;

    switch (channel) {

      // "map" — snapshot of all current sensors, sent immediately on WS connect

      case "map":
        map.renderSnapshot(data.points ?? []);
        break;

      // "current" — a single live reading emitted every tick
      
      case "current":
        map.renderSensor(data);
        
        if (Date.now() - lastTickRef.current > 2000) {
          lastTickRef.current = Date.now();
          setTickItems((prev) =>
            [{ cpm: data.cpm, city: data.city, level: data.level }, ...prev].slice(0, 6)
          );
        }
        break;

      
      // cap at 20 (newest first)
      case "alerts":
        setAlerts((prev) => [data, ...prev].slice(0, 20));
        break;

      // "spikes" 
      
      case "spikes":
        setSpikes((prev) => [data, ...prev].slice(0, 10));
        map.pulseSpike(data);
        break;

      // "stats"
      
      case "stats":
        setStats(data);
        break;

      // "heatmap" 
      
      case "heatmap":
        map.renderHeatmap(data.cells ?? []);
        break;

      // "top" — ranked list of highest-CPM areas
      
      case "top":
        setHotspots(data.hotspots ?? []);
        break;

      // "config" — backend echoes a config change (e.g. threshold updated)
      case "config":
        if (data.threshold !== undefined) {
          setConfig((prev) => ({ ...prev, threshold: data.threshold }));
        }
        break;

      default:
        // Unknown channel — ignore safely
        break;
    }
  }, [map]); 

  
  const { status, connect, disconnect } = useLiveStream(onMessage);

  function handleToggle() {
    if (status === "live" || status === "connecting") {
      disconnect();
    } else {
      connect(); 
    }
  }


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
      {/* Header receives real status and real toggle handler */}
      <Header status={status} onToggle={handleToggle} />

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
          {/* StatsPanel — passing the stats object and marker count */}
          <StatsPanel stats={stats} onMap={map.markerCount()} />

          {/* pass the live arrays */}
          <AlertsFeed alerts={alerts} />
          <TopHotspots
            hotspots={hotspots}
            onSelect={(lat, lon) => map.flyTo(lat, lon)}
          />
          <SpikesFeed spikes={spikes} />
        </aside>
      </div>

      {/*  we pass the throttled tick items + status */}
      <Ticker items={tickItems} status={status} />
    </div>
  );
}


