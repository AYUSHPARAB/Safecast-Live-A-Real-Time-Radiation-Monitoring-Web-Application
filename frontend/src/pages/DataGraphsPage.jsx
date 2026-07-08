import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";
import { getSensors, getStats } from "../services/api";
import { cpmToColor, COLOR_SCALE } from "../utils/colors";

export default function DataGraphsPage() {
  const [sensors, setSensors] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const timelineRef = useRef([]);

  useEffect(() => {
    let active = true;

    async function tick() {
      try {
        const [s, st] = await Promise.all([getSensors(), getStats()]);
        if (!active) return;
        setSensors(s);

        const point = {
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          avg: st.avg_cpm,
        };
        timelineRef.current = [...timelineRef.current, point].slice(-30);
        setTimeline(timelineRef.current);
      } catch (e) {
        console.error("charts fetch failed:", e);
      }
    }

    tick();
    const id = setInterval(tick, 3000);
    return () => { active = false; clearInterval(id); };
  }, []);

  //Chart 1: distribution across the colour bands
  const distribution = COLOR_SCALE.map((band) => {
    const nums = band.label.match(/\d+/g)?.map(Number) || [];
    const lo = nums[0] ?? 0;
    const hi = nums.length > 1 ? nums[1] : Infinity;
    const count = sensors.filter((s) => s.cpm >= lo && s.cpm < hi).length;
    return { label: band.label, count, color: band.color };
  });

  //Chart 2: top 10 hottest sensors
  const topSensors = [...sensors]
    .sort((a, b) => b.cpm - a.cpm)
    .slice(0, 10)
    .map((s) => ({
      name: s.display_name || s.device_id,
      cpm: s.cpm,
      color: cpmToColor(s.cpm),
    }));

  return (
    <div className="page-placeholder">
      <h2>Data &amp; Graphs</h2>

      <div className="chart-block">
        <h3>CPM Distribution (sensors per level)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232b3d" />
            <XAxis dataKey="label" stroke="#9aa4b8" fontSize={12} />
            <YAxis stroke="#9aa4b8" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #232b3d", color: "#e5e7eb" }} />
            <Bar dataKey="count">
              {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-block">
        <h3>Top 10 Hottest Sensors (current)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topSensors} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232b3d" />
            <XAxis type="number" stroke="#9aa4b8" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="#9aa4b8" fontSize={11} width={120} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #232b3d", color: "#e5e7eb" }} />
            <Bar dataKey="cpm">
              {topSensors.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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