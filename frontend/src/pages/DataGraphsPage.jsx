import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getStats } from "../services/api";

export default function DataGraphsPage() {
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const timelineRef = useRef([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function tick() {
      try {
        const st = await getStats();
        if (!active) return;
        setStats(st);

        if (!st?.avg_cpm && st?.avg_cpm !== 0) return;

        const point = {
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          avg: Number(st.avg_cpm),
        };
        timelineRef.current = [...timelineRef.current, point].slice(-30);
        setTimeline(timelineRef.current);
        setError("");
      } catch (e) {
        console.error("charts fetch failed:", e);
        if (active) setError("Unable to load live statistics.");
      }
    }

    tick();
    const id = setInterval(tick, 3000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return (
    <div className="page-placeholder">
      <h2>Data &amp; Graphs</h2>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      <div className="chart-block">
        <h3>Current Global Statistics</h3>
        {stats ? (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{Number(stats.avg_cpm ?? 0).toFixed(1)}</div>
              <div className="stat-label">Average CPM</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Number(stats.max_cpm ?? 0).toFixed(1)}</div>
              <div className="stat-label">Maximum CPM</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Number(stats.active_sensors ?? 0).toLocaleString()}</div>
              <div className="stat-label">Active Sensors</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Number(stats.alert_count ?? 0).toLocaleString()}</div>
              <div className="stat-label">Alerts</div>
            </div>
          </div>
        ) : (
          <p className="muted">No live statistics available yet.</p>
        )}
      </div>

      <div className="chart-block">
        <h3>Global Average CPM (live, this session)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232b3d" />
            <XAxis dataKey="time" stroke="#9aa4b8" fontSize={11} />
            <YAxis stroke="#9aa4b8" fontSize={12} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #232b3d", color: "#e5e7eb" }} />
            <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        {timeline.length < 2 && (
          <p className="muted" style={{ fontSize: 12 }}>Collecting data… the line builds as the page stays open.</p>
        )}
      </div>
    </div>
  );
}
