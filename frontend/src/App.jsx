import { useCallback, useEffect, useState, useRef } from "react";
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
  getStatsTimeseries,
} from "./services/api.js";

const DEFAULT_CONFIG = {
  threshold: 100,
  timespan: 1,
  bbox: null,
  speed: .001,
};

export default function App() {
  const map = useLeafletMap("rc-map");

  const [config,      setConfig]      = useState(DEFAULT_CONFIG);

  // ── Live data state 
  const [stats,     setStats]     = useState(null);
  const [alerts,    setAlerts]    = useState([]);
  const [spikes,    setSpikes]    = useState([]);
  const [hotspots,  setHotspots]  = useState([]);
  const [tickItems, setTickItems] = useState([]);
  const [health,    setHealth]    = useState(undefined);
  const [timeseries, setTimeseries] = useState([]);
  const [liveTrend, setLiveTrend] = useState([]);
  

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
        setTickItems((prev) =>
          [{ cpm: data.cpm, city: data.city, level: data.level }, ...prev].slice(0, 50)
        );
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
        setLiveTrend(prev =>
          [...prev, { t: Date.now(), avg: Math.round(data.avg_cpm) }].slice(-30)
        );
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

  const loadTrend = useCallback(async (hours) => {
    try {
      const ts = await getStatsTimeseries(hours);
      if (Array.isArray(ts)) setTimeseries(ts);
    } catch (e) {
      console.error("timeseries fetch failed", e);
    }
  }, []);

  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;
    handleToggle();          // auto go-live on load
  }, []); 

  useEffect(() => {
    loadTrend(config.timespan);
    const id = setInterval(() => loadTrend(config.timespan), 30000);
    return () => clearInterval(id);
  }, [config.timespan, loadTrend]);


  function changeConfig(next) {
    setConfig(next);
    if (next.bbox) map.fitBox(next.bbox);
    else map.resetView();
    loadTrend(next.timespan);   
  }

  return (
    <div className="rc-root">
      <Header status={status} health={health} onToggle={handleToggle} />

      <div className="rc-body">
        <ConfigPanel
          cfg={config}
          onChange={changeConfig}
          timeseries={timeseries}
        />

        <main className="rc-map-wrap" aria-label="Radiation sensor map">
          <div id="rc-map" />
          <div className="rc-map-empty">Awaiting sensor data</div>
          <Legend />
        </main>

        <aside className="rc-rail right">
          
          <StatsPanel stats={stats} liveTrend={liveTrend} alertsCount={alerts.length} onMap={map.markerCount()} />

          
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
