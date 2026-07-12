// src/components/TrendChart.jsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function TrendChart({ timeseries, hours }) {
  const data = (timeseries || []).map((r) => ({
    t: new Date(r.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    avg: Math.round(r.avg_cpm),
    max: Math.round(r.max_cpm),
  }));

  return (
    <div className="rc-trend">
      <div className="rc-eyebrow">Radiation trend · last {hours}h</div>
      {data.length < 2 ? (
        <div className="rc-trend-empty">Collecting data… need a few more minutes</div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="gAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38f2a0" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#38f2a0" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMax" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a3c" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ff7a3c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e2a28" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#7c8f8a" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "#7c8f8a" }} width={34} />
            <Tooltip
              contentStyle={{ background: "#12181a", border: "1px solid #25312f", fontSize: 11, color: "#d8e6e2" }}
              labelStyle={{ color: "#7c8f8a" }}
            />
            <Area type="monotone" dataKey="max" stroke="#ff7a3c" strokeWidth={1} fill="url(#gMax)" name="Max CPM" />
            <Area type="monotone" dataKey="avg" stroke="#38f2a0" strokeWidth={1.5} fill="url(#gAvg)" name="Avg CPM" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}