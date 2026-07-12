import { COLORS } from "../constants.js";

function levelOf(cpm) {
  if (cpm >= 300) return "high";
  if (cpm >= 100) return "elevated";
  if (cpm >= 50) return "warning";
  return "safe";
}

function Sparkline({ timeseries, color }) {
  console.log("[Sparkline] timeseries:", timeseries);
  if (!timeseries || timeseries.length < 2) {
    return <div className="rc-spark rc-spark-empty">No trend data</div>;
  }

  const values = timeseries.map((point) => point.avg_cpm).filter(Number.isFinite);
  if (values.length < 2) {
    return <div className="rc-spark rc-spark-empty">No trend data</div>;
  }

  const width = 268;
  const height = 40;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values, minimum + 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - minimum) / (maximum - minimum)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg className="rc-spark" viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none" aria-label="Average CPM trend" role="img">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatsPanel({ stats, timeseries, alertsCount, onMap }) {
  const average = stats?.avg_cpm ?? null;
  const color = average === null ? "var(--muted)" : COLORS[levelOf(average)];

  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Global stats</div>
      <div className="rc-gauge">
        <div className="big" style={{ color }}>
          {average === null ? "—" : Number(average).toFixed(1)}
        </div>
        <div className="unit">AVG CPM</div>
      </div>
      <Sparkline timeseries={timeseries} color={color} />
      <div className="rc-statgrid">
        <div className="rc-stat"><div className="v">{stats?.max_cpm ?? "—"}</div><div className="l">Max CPM</div></div>
        <div className="rc-stat"><div className="v">{stats?.active_sensors ?? "—"}</div><div className="l">Sensors</div></div>
        <div className="rc-stat"><div className="v">{alertsCount ?? 0}</div><div className="l">Alerts</div></div>
        <div className="rc-stat"><div className="v">{onMap}</div><div className="l">On map</div></div>
      </div>
    </section>
  );
}

function EmptyFeed({ message }) {
  return <div className="rc-empty">{message}</div>;
}

function FeedRow({ level, primary, secondary, value, onClick, rank }) {
  return (
    <div className={`rc-row${onClick ? " rc-row--click" : ""}`} onClick={onClick}>
      {rank != null && <span className="rc-row-rank rc-mono">#{rank}</span>}
      <span className="rc-row-dot" style={{ background: COLORS[level] || COLORS.safe }} />
      <span className="rc-row-body">
        <span className="rc-row-primary">{primary}</span>
        {secondary && <span className="rc-row-secondary">{secondary}</span>}
      </span>
      <span className="rc-row-value rc-mono" style={{ color: COLORS[level] || COLORS.safe }}>
        {value}
      </span>
    </div>
  );
}

export function AlertsFeed({ alerts }) {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Live alerts <span>{alerts.length}</span></div>
      <div className="rc-feed">
        {alerts.length === 0 ? <EmptyFeed message="No alerts received." /> : alerts.map((alert, index) => (
          <FeedRow key={`${alert.sensor_key}-${alert.captured_at}-${index}`}
            level={alert.level}
            primary={[alert.city, alert.country].filter(Boolean).join(", ") || alert.sensor_key}
            secondary={alert.sensor_key}
            value={`${alert.cpm} CPM`} />
        ))}
      </div>
    </section>
  );
}

export function TopHotspots({ hotspots, onSelect }) {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Top hotspots <span>{hotspots.length}</span></div>
      <div className="rc-feed">
        {hotspots.length === 0 ? <EmptyFeed message="No hotspot data available." /> : hotspots.map((hotspot) => (
          <FeedRow key={hotspot.rank} rank={hotspot.rank} level={hotspot.level}
            primary={[hotspot.city, hotspot.country].join(", ")}
            secondary={`average: ${hotspot.avg_cpm}`}
            value={`${hotspot.max_cpm} CPM`}
            onClick={() => onSelect?.(hotspot.lat, hotspot.lon)} />
        ))}
      </div>
    </section>
  );
}

export function SpikesFeed({ spikes }) {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Spikes <span>{spikes.length}</span></div>
      <div className="rc-feed">
        {spikes.length === 0 ? <EmptyFeed message="No spikes received." /> : spikes.map((spike, index) => (
          <FeedRow key={`${spike.sensor_key}-${spike.captured_at}-${index}`}
            level={spike.level}
            primary={[spike.city, spike.country].filter(Boolean).join(", ") || spike.sensor_key}
            secondary={`${spike.previous_cpm} → ${spike.cpm} CPM`}
            value={`${spike.jump_ratio}×`} />
        ))}
      </div>
    </section>
  );
}
