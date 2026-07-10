function EmptyFeed({ message }) {
  return <div className="rc-empty">{message}</div>;
}

export function StatsPanel() {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Global stats</div>
      <div className="rc-gauge">
        <div className="big">—</div>
        <div className="unit">AVG CPM</div>
      </div>
      <div className="rc-spark rc-spark-empty">No trend data</div>
      <div className="rc-statgrid">
        <div className="rc-stat"><div className="v">—</div><div className="l">Max CPM</div></div>
        <div className="rc-stat"><div className="v">—</div><div className="l">Sensors</div></div>
        <div className="rc-stat"><div className="v">—</div><div className="l">Alerts</div></div>
        <div className="rc-stat"><div className="v">0</div><div className="l">On map</div></div>
      </div>
    </section>
  );
}

export function AlertsFeed({ alerts }) {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Live alerts <span>{alerts.length}</span></div>
      <div className="rc-feed"><EmptyFeed message="No alerts received." /></div>
    </section>
  );
}

export function TopHotspots({ hotspots }) {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Top hotspots <span>{hotspots.length}</span></div>
      <div className="rc-feed"><EmptyFeed message="No hotspot data available." /></div>
    </section>
  );
}

export function SpikesFeed({ spikes }) {
  return (
    <section className="rc-sec">
      <div className="rc-eyebrow">Spikes <span>{spikes.length}</span></div>
      <div className="rc-feed"><EmptyFeed message="No spikes received." /></div>
    </section>
  );
}