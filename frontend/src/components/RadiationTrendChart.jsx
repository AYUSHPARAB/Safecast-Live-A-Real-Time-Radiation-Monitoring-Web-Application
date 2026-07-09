import { useEffect, useMemo, useState } from "react";
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
import { subscribeLiveUpdates } from "../services/websocket";

const RANGE_OPTIONS = [
  { id: "15m", label: "15m", durationMs: 15 * 60 * 1000 },
  { id: "1h", label: "1h", durationMs: 60 * 60 * 1000 },
  { id: "6h", label: "6h", durationMs: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "24h", durationMs: 24 * 60 * 60 * 1000 },
];

function formatChartTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function RadiationTrendChart() {
  const [points, setPoints] = useState([]);
  const [activeRange, setActiveRange] = useState("15m");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    function appendStatsPoint(stats) {
      if (!stats || stats.avg_cpm == null) return;

      const now = new Date();
      const point = {
        id: now.getTime(),
        time: formatChartTime(now),
        timestamp: now.getTime(),
        avg: Number(stats.avg_cpm),
      };

      setPoints((current) => [...current, point].slice(-50));
      setError("");
    }

    async function loadInitialStats() {
      try {
        const stats = await getStats();
        if (active) appendStatsPoint(stats);
      } catch (err) {
        console.error("trend chart initial stats fetch failed:", err);
        if (active) setError("Unable to load trend data.");
      }
    }

    loadInitialStats();

    const unsubscribeStats = subscribeLiveUpdates("stats", (stats) => {
      appendStatsPoint(stats);
    });

    return () => {
      active = false;
      unsubscribeStats();
    };
  }, []);

  const visiblePoints = useMemo(() => {
    const selected = RANGE_OPTIONS.find((item) => item.id === activeRange);
    if (!selected || points.length === 0) return points;

    const cutoff = Date.now() - selected.durationMs;
    const filtered = points.filter((point) => point.timestamp >= cutoff);

    return filtered.length > 0 ? filtered : points;
  }, [activeRange, points]);

  return (
    <div className="live-chart-card">
      <div className="chart-header">
        <div>
          <h3>Radiation Over Time</h3>
          <span>Global Average CPM</span>
        </div>

        <div className="chart-range-buttons">
          {RANGE_OPTIONS.map((range) => (
            <button
              className={
                activeRange === range.id
                  ? "chart-range-btn chart-range-btn-active"
                  : "chart-range-btn"
              }
              key={range.id}
              onClick={() => setActiveRange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="trend-chart-body">
        {error && <p className="trend-chart-message">{error}</p>}

        {!error && visiblePoints.length < 2 && (
          <p className="trend-chart-message">
            Collecting live average CPM readings...
          </p>
        )}

        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={visiblePoints}
            margin={{
              top: 12,
              right: 18,
              bottom: 8,
              left: 0,
            }}
          >
            <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              stroke="#9aa4b8"
              fontSize={12}
              minTickGap={28}
            />
            <YAxis
              stroke="#9aa4b8"
              fontSize={12}
              width={46}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#111827",
                border: "1px solid #323d56",
                borderRadius: 8,
                color: "#e5e7eb",
              }}
              formatter={(value) => [`${Number(value).toFixed(1)} CPM`, "Avg"]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 5,
                fill: "#93c5fd",
                stroke: "#111827",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
