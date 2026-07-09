import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import { Range, getTrackBackground } from "react-range";

import { AREAS } from "../utils/areas";
import { cpmToColor } from "../utils/colors";

const SPEED_INTERVALS = {
  "1x": 1000,
  "2x": 500,
  "5x": 250,
  "10x": 100,
};

function formatTime(timestamp) {
  if (!timestamp) return "--";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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

function getTimelineTicks(frames, tickCount = 6) {
  if (frames.length === 0) return [];
  if (frames.length === 1) {
    return [
      {
        index: 0,
        label: formatTime(frames[0].timestamp),
      },
    ];
  }

  const lastIndex = frames.length - 1;
  const count = Math.min(tickCount, frames.length);

  return Array.from({ length: count }, (_, tick) => {
    const index = Math.round((tick / (count - 1)) * lastIndex);

    return {
      index,
      label: formatTime(frames[index]?.timestamp),
    };
  });
}

function parseBbox(bbox) {
  if (!bbox) return null;

  const values = bbox.split(",").map(Number);
  if (values.length !== 4 || values.some(Number.isNaN)) return null;

  const [minLon, minLat, maxLon, maxLat] = values;

  return {
    minLon,
    minLat,
    maxLon,
    maxLat,
  };
}

function isSensorInsideArea(sensor, selectedArea) {
  const areaConfig = AREAS.find((area) => area.id === selectedArea);
  const bbox = parseBbox(areaConfig?.bbox);

  if (!bbox) return true;

  return (
    sensor.latitude >= bbox.minLat &&
    sensor.latitude <= bbox.maxLat &&
    sensor.longitude >= bbox.minLon &&
    sensor.longitude <= bbox.maxLon
  );
}

function ChangeMapView({ area }) {
  const map = useMap();
  const areaConfig = AREAS.find((item) => item.id === area);

  useEffect(() => {
    if (!areaConfig) return;

    map.setView(areaConfig.center, areaConfig.zoom);
  }, [areaConfig, map]);

  return null;
}

export default function HistoricalMap({
  frames = [],
  playback = {},
  onFrameChange,
}) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setFrame(0);
    setPlaying(false);
  }, [frames]);

  useEffect(() => {
    if (frame <= frames.length - 1) return;

    setFrame(Math.max(frames.length - 1, 0));
  }, [frame, frames.length]);

  useEffect(() => {
    if (!playing || frames.length === 0) return undefined;

    const interval = SPEED_INTERVALS[playback.speed] || SPEED_INTERVALS["1x"];
    const timer = setInterval(() => {
      setFrame((previous) => {
        if (previous >= frames.length - 1) return 0;

        return previous + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [playing, frames.length, playback.speed]);

  const currentFrame = useMemo(() => {
    if (frames.length === 0) {
      return {
        timestamp: "",
        sensors: [],
      };
    }

    const safeFrameIndex = Math.min(frame, frames.length - 1);
    const frameData = frames[safeFrameIndex];
    const sensors = (frameData.sensors || []).filter((sensor) =>
      isSensorInsideArea(sensor, playback.area)
    );

    return {
      ...frameData,
      sensors,
    };
  }, [frame, frames, playback.area]);

  useEffect(() => {
    if (onFrameChange) {
      onFrameChange(currentFrame);
    }
  }, [currentFrame, onFrameChange]);

  const maxFrame = Math.max(frames.length - 1, 0);
  const timelineTicks = getTimelineTicks(frames);
  const startTimestamp = frames[0]?.timestamp;
  const endTimestamp = frames[frames.length - 1]?.timestamp;
  const currentValue = Math.min(frame, maxFrame);
  const sliderMax = Math.max(maxFrame, 1);

  function handleReset() {
    setPlaying(false);
    setFrame(0);
  }

  return (
    <div className="historical-map">
      <div className="playback-console">
        <div className="historical-map-toolbar">
          <div className="playback-actions">
            <button
              className="time-control-btn"
              disabled={frames.length === 0 || playing}
              onClick={() => setPlaying(true)}
            >
              Play
            </button>

            <button
              className="time-control-btn"
              disabled={!playing}
              onClick={() => setPlaying(false)}
            >
              Pause
            </button>

            <button
              className="time-control-btn secondary"
              disabled={frames.length === 0}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          <div className="historical-map-status">
            <span className="mode-badge">MOCK DATA</span>
            <span className="speed-badge">{playback.speed || "1x"}</span>
            <strong>
              Frame {frames.length === 0 ? 0 : currentValue + 1} / {frames.length}
            </strong>
          </div>
        </div>

        <div className="timeline-endpoints">
          <span>{formatTime(startTimestamp)}</span>
          <span>{formatTime(endTimestamp)}</span>
        </div>

        <div className="historical-map-timeline">
          <Range
            values={[currentValue]}
            step={1}
            min={0}
            max={sliderMax}
            disabled={frames.length <= 1}
            onChange={(values) => {
              setFrame(values[0]);
            }}
            renderTrack={({ props, children }) => (
              <div
                className="timeline-track-wrap"
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                style={props.style}
              >
                <div
                  ref={props.ref}
                  className="timeline-track"
                  style={{
                    background: getTrackBackground({
                      values: [currentValue],
                      colors: ["#60a5fa", "#111827"],
                      min: 0,
                      max: sliderMax,
                    }),
                  }}
                >
                  {children}
                </div>
              </div>
            )}
            renderThumb={({ props, isDragged }) => (
              <div
                {...props}
                className={`timeline-thumb${isDragged ? " dragging" : ""}`}
              />
            )}
          />
        </div>

        <div className="timeline-ticks">
          {timelineTicks.map((tick) => (
            <span key={`${tick.index}-${tick.label}`}>{tick.label}</span>
          ))}
        </div>

        <div className="timeline-current">
          Current: {formatDateTime(currentFrame.timestamp)}
        </div>
      </div>

      <MapContainer
        className="historical-leaflet-map"
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        worldCopyJump
      >
        <TileLayer
          attribution="&copy; OpenStreetMap, &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <ChangeMapView area={playback.area} />

        {currentFrame.sensors.map((sensor) => (
          <CircleMarker
            key={sensor.sensor_key || sensor.device_id}
            center={[
              sensor.latitude,
              sensor.longitude,
            ]}
            radius={5}
            pathOptions={{
              color: cpmToColor(sensor.cpm),
              fillColor: cpmToColor(sensor.cpm),
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{sensor.display_name}</strong>
              <br />
              CPM: {sensor.cpm}
              <br />
              {sensor.device_id}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
