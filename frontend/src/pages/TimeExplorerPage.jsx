import { useMemo, useState } from "react";

import { AREAS } from "../utils/areas";
import { TIME_RANGES } from "../utils/timeRanges";
import { PLAYBACK_SPEEDS } from "../utils/playbackSpeeds";

import HistoricalMap from "../components/HistoricalMap";

import { getMockHistoricalFrames } from "../utils/mockData";

export default function TimeExplorerPage() {
  const [timeRange, setTimeRange] = useState("live");
  const [area, setArea] = useState("world");
  const [speed, setSpeed] = useState("1x");

  const [appliedFilters, setAppliedFilters] = useState({
    time: "Live",
    area: "World",
    speed: "1x",
  });

  const historicalFrames = useMemo(
    () => getMockHistoricalFrames(40),
    []
  );

  const visibleFrames = useMemo(() => {
    switch (timeRange) {
      case "15m":
        return historicalFrames.slice(-15);

      case "1h":
        return historicalFrames;

      case "6h":
        return historicalFrames;

      case "24h":
        return historicalFrames;

      case "live":
      default:
        return historicalFrames;
    }
  }, [historicalFrames, timeRange]);

  const [currentFrame, setCurrentFrame] = useState(
    historicalFrames[0]
  );

  const selectedTime =
    TIME_RANGES.find((t) => t.id === timeRange)?.name || "";

  const selectedArea =
    AREAS.find((a) => a.id === area)?.name || "";

  const selectedSpeed =
    PLAYBACK_SPEEDS.find((s) => s.id === speed)?.name || "";

  function handleApply() {
    setAppliedFilters({
      time: selectedTime,
      area: selectedArea,
      speed: selectedSpeed,
    });
  }

  const sensors = currentFrame?.sensors || [];

  const average =
    sensors.length > 0
      ? (
          sensors.reduce((sum, s) => sum + s.cpm, 0) /
          sensors.length
        ).toFixed(1)
      : "--";

  const maximum =
    sensors.length > 0
      ? Math.max(...sensors.map((s) => s.cpm)).toFixed(1)
      : "--";

  const alerts = sensors.filter(
    (sensor) => sensor.cpm >= 100
  ).length;

  return (
    <div className="time-explorer-page">
      <h2>Time Explorer</h2>

      <p className="page-subtitle">
        Explore historical radiation data across different
        time ranges and locations.
      </p>

      <div className="time-dashboard">

        {/* Filters */}

        <div className="dashboard-card">

          <h3>Filters</h3>

          <label>Time Range</label>

          <select
            value={timeRange}
            onChange={(e) =>
              setTimeRange(e.target.value)
            }
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

          <label>Area</label>

          <select
            value={area}
            onChange={(e) =>
              setArea(e.target.value)
            }
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

          <label>Playback Speed</label>

          <select
            value={speed}
            onChange={(e) =>
              setSpeed(e.target.value)
            }
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

          <button
            className="time-apply-btn"
            onClick={handleApply}
          >
            Apply Filters
          </button>

        </div>

        {/* Historical Map */}

        <div className="dashboard-card">

          <h3>Historical Radiation Map</h3>

          <HistoricalMap
            frames={visibleFrames}
            playback={{
              speed,
              area,
              timeRange,
            }}
            onFrameChange={setCurrentFrame}
          />

        </div>

        {/* Playback Settings */}

        <div className="dashboard-card">

          <h3>Playback Settings</h3>

          <div className="summary-grid">

            <div className="summary-item">
              <span>Time Range</span>
              <strong>{appliedFilters.time}</strong>
            </div>

            <div className="summary-item">
              <span>Area</span>
              <strong>{appliedFilters.area}</strong>
            </div>

            <div className="summary-item">
              <span>Playback Speed</span>
              <strong>{appliedFilters.speed}</strong>
            </div>

            <div className="summary-item">
              <span>Current Time</span>
              <strong>
                {currentFrame?.timestamp
                  ? new Date(
                      currentFrame.timestamp
                    ).toLocaleTimeString()
                  : "--"}
              </strong>
            </div>

          </div>

        </div>

        {/* Historical Statistics */}

        <div className="dashboard-card">

          <h3>Historical Statistics</h3>

          <div className="stats-grid">

            <div className="stat-card">
              <span>Average CPM</span>
              <strong>{average}</strong>
            </div>

            <div className="stat-card">
              <span>Maximum CPM</span>
              <strong>{maximum}</strong>
            </div>

            <div className="stat-card">
              <span>Active Sensors</span>
              <strong>{sensors.length}</strong>
            </div>

            <div className="stat-card">
              <span>Alerts</span>
              <strong>{alerts}</strong>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}