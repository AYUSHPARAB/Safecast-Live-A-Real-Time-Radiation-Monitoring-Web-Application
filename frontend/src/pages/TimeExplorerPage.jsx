import { useMemo, useState } from "react";

import { AREAS } from "../utils/areas";
import { TIME_RANGES } from "../utils/timeRanges";
import { PLAYBACK_SPEEDS } from "../utils/playbackSpeeds";

import HistoricalMap from "../components/HistoricalMap";

import { getMockHistoricalFrames } from "../utils/mockData";

function getFrameStats(frame) {
  const sensors = frame?.sensors || [];

  if (sensors.length === 0) {
    return {
      average: "--",
      maximum: "--",
      activeSensors: 0,
      alerts: 0,
    };
  }

  const totalCpm = sensors.reduce((sum, sensor) => sum + sensor.cpm, 0);

  return {
    average: (totalCpm / sensors.length).toFixed(1),
    maximum: Math.max(...sensors.map((sensor) => sensor.cpm)).toFixed(1),
    activeSensors: sensors.length,
    alerts: sensors.filter((sensor) => sensor.cpm >= 100).length,
  };
}

function formatDateTime(timestamp) {
  if (!timestamp) return "--";

  return new Date(timestamp).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function TimeExplorerPage() {
  const [timeRange, setTimeRange] = useState("live");
  const [area, setArea] = useState("world");
  const [speed, setSpeed] = useState("1x");

  const [appliedFilters, setAppliedFilters] = useState({
    timeRange: "live",
    area: "world",
    speed: "1x",
    timeLabel: "Live",
    areaLabel: "World",
    speedLabel: "1x",
  });

  // Temporary source until the backend exposes historical frame endpoints.
  const historicalFrames = useMemo(
    () => getMockHistoricalFrames(40),
    []
  );

  const visibleFrames = useMemo(() => {
    switch (appliedFilters.timeRange) {
      case "15m":
        return historicalFrames.slice(-15);

      case "30m":
        return historicalFrames.slice(-30);

      case "1h":
      case "6h":
      case "24h":
      case "live":
      default:
        return historicalFrames;
    }
  }, [appliedFilters.timeRange, historicalFrames]);

  const [currentFrame, setCurrentFrame] = useState(historicalFrames[0]);

  const selectedTime =
    TIME_RANGES.find((item) => item.id === timeRange)?.name || "";

  const selectedArea =
    AREAS.find((item) => item.id === area)?.name || "";

  const selectedSpeed =
    PLAYBACK_SPEEDS.find((item) => item.id === speed)?.name || "";

  function handleApply() {
    setAppliedFilters({
      timeRange,
      area,
      speed,
      timeLabel: selectedTime,
      areaLabel: selectedArea,
      speedLabel: selectedSpeed,
    });
  }

  const stats = getFrameStats(currentFrame);
  const selectedAreaConfig = AREAS.find(
    (item) => item.id === appliedFilters.area
  );
  const integrationTarget = selectedAreaConfig?.bbox
    ? `/api/points?bbox=${selectedAreaConfig.bbox}&from=&to=`
    : "/api/points?bbox=&from=&to=";

  return (
    <div className="time-explorer-page">
      <div className="time-page-header">
        <div>
          <h2>Time Explorer</h2>
          <p className="page-subtitle">
            Historical playback of radiation readings across selected areas
            and time ranges.
          </p>
        </div>
      </div>

      <div className="time-layout">
        <div className="dashboard-card">
          <div className="card-heading">
            <h3>Playback Configuration</h3>
            <span>Mock history, backend-ready query shape</span>
          </div>

          <div className="time-filter-grid">
            <label>
              <span>Time Range</span>
              <select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
              >
                {TIME_RANGES.map((range) => (
                  <option
                    key={range.id}
                    value={range.id}
                  >
                    {range.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Area</span>
              <select
                value={area}
                onChange={(event) => setArea(event.target.value)}
              >
                {AREAS.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Playback Speed</span>
              <select
                value={speed}
                onChange={(event) => setSpeed(event.target.value)}
              >
                {PLAYBACK_SPEEDS.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="apply-column">
              <button
                className="time-apply-btn"
                onClick={handleApply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-heading">
            <h3>Historical Radiation Map</h3>
            <span>
              {appliedFilters.areaLabel} · {appliedFilters.timeLabel}
            </span>
          </div>

          <HistoricalMap
            frames={visibleFrames}
            playback={{
              speed: appliedFilters.speed,
              area: appliedFilters.area,
              timeRange: appliedFilters.timeRange,
            }}
            onFrameChange={setCurrentFrame}
          />
        </div>

        <div className="time-info-grid">
          <div className="dashboard-card">
            <div className="card-heading">
              <h3>Playback Status</h3>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span>Time Range</span>
                <strong>{appliedFilters.timeLabel}</strong>
              </div>

              <div className="summary-item">
                <span>Area</span>
                <strong>{appliedFilters.areaLabel}</strong>
              </div>

              <div className="summary-item">
                <span>Playback Speed</span>
                <strong>{appliedFilters.speedLabel}</strong>
              </div>

              <div className="summary-item">
                <span>Current Time</span>
                <strong>{formatDateTime(currentFrame?.timestamp)}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-heading">
              <h3>Historical Statistics</h3>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Average CPM</span>
                <strong>{stats.average}</strong>
              </div>

              <div className="stat-card">
                <span>Maximum CPM</span>
                <strong>{stats.maximum}</strong>
              </div>

              <div className="stat-card">
                <span>Active Sensors</span>
                <strong>{stats.activeSensors}</strong>
              </div>

              <div className="stat-card">
                <span>Alerts</span>
                <strong>{stats.alerts}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-heading">
            <h3>Historical Summary</h3>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span>Frames Loaded</span>
              <strong>{visibleFrames.length}</strong>
            </div>

            <div className="summary-item">
              <span>Current Source</span>
              <strong>Mock Dataset</strong>
            </div>

            <div className="summary-item">
              <span>Backend</span>
              <strong>Pending Integration</strong>
            </div>

            <div className="summary-item wide">
              <span>Integration Target</span>
              <strong>{integrationTarget}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
