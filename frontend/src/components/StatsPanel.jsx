import { useEffect, useState } from "react";
import { getStats } from "../services/api";
import { subscribeLiveUpdates } from "../services/websocket";

export default function StatsPanel({ className = "" }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        setLoading(true);
        const data = await getStats();
        if (!active) return;
        setStats(data);
      } catch (err) {
        console.error(err);
        if (active) setError("Unable to load statistics.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStats();

    const unsubscribeStats = subscribeLiveUpdates("stats", (data) => {
      setStats(data);
      setLoading(false);
      setError("");
    });

    return () => {
      active = false;
      unsubscribeStats();
    };
  }, []);

  if (loading) {
    return (
      <div className={`stats-panel ${className}`.trim()}>
        <h3>Global Statistics</h3>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`stats-panel ${className}`.trim()}>
        <h3>Global Statistics</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`stats-panel ${className}`.trim()}>
        <h3>Global Statistics</h3>
        <p>No statistics available yet.</p>
      </div>
    );
  }

  const avgCpm = Number(stats.avg_cpm ?? 0);
  const maxCpm = Number(stats.max_cpm ?? 0);
  const activeSensors = Number(stats.active_sensors ?? 0);
  const alertCount = Number(stats.alert_count ?? 0);
  const readingCount = Number(stats.reading_count ?? 0);

  return (
    <div className={`stats-panel ${className}`.trim()}>
      <h3>Global Statistics</h3>

      <div className="stats-grid">

        <div className="stat-card green">
          <div className="stat-value">
            {avgCpm.toFixed(1)}
          </div>
          <div className="stat-label">Average CPM</div>
        </div>

        <div className="stat-card red">
          <div className="stat-value">
            {maxCpm.toFixed(1)}
          </div>
          <div className="stat-label">Maximum CPM</div>
        </div>

        <div className="stat-card blue">
          <div className="stat-value">
            {activeSensors.toLocaleString()}
          </div>
          <div className="stat-label">Active Sensors</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-value">
            {alertCount.toLocaleString()}
          </div>
          <div className="stat-label">Alerts</div>
        </div>

        <div className="stat-card purple">
          <div className="stat-value">
            {readingCount.toLocaleString()}
          </div>
          <div className="stat-label">Total Readings</div>
        </div>

      </div>
    </div>
  );
}
