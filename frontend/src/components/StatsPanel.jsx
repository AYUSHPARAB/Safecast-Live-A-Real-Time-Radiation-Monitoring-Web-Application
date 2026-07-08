import { useEffect, useState } from "react";
import { getStats } from "../services/api";

export default function StatsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await getStats();
        setStats(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load statistics.");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="stats-panel">
        <h3>Global Statistics</h3>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-panel">
        <h3>Global Statistics</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      <h3>Global Statistics</h3>

      <div className="stats-grid">

        <div className="stat-card green">
          <div className="stat-value">
            {Number(stats.avg_cpm).toFixed(1)}
          </div>
          <div className="stat-label">Average CPM</div>
        </div>

        <div className="stat-card red">
          <div className="stat-value">
            {Number(stats.max_cpm).toFixed(1)}
          </div>
          <div className="stat-label">Maximum CPM</div>
        </div>

        <div className="stat-card blue">
          <div className="stat-value">
            {stats.active_sensors.toLocaleString()}
          </div>
          <div className="stat-label">Active Sensors</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-value">
            {stats.alert_count.toLocaleString()}
          </div>
          <div className="stat-label">Alerts</div>
        </div>

        <div className="stat-card purple">
          <div className="stat-value">
            {stats.reading_count.toLocaleString()}
          </div>
          <div className="stat-label">Total Readings</div>
        </div>

      </div>
    </div>
  );
}