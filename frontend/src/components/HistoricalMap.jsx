import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";

import { cpmToColor } from "../utils/colors";

export default function HistoricalMap({
  frames = [],
  playback = {},
  onFrameChange,
}) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
  if (!playing || frames.length === 0) return;

  const speedMap = {
    "0.5x": 2000,
    "1x": 1000,
    "2x": 500,
    "4x": 250,
  };

  const interval =
    speedMap[playback.speed] || 1000;

  const timer = setInterval(() => {
    setFrame((previous) => {
      if (previous >= frames.length - 1) {
        return 0;
      }

      return previous + 1;
    });
  }, interval);

  return () => clearInterval(timer);

}, [playing, frames, playback.speed]);

  useEffect(() => {
    if (frames.length > 0 && onFrameChange) {
      onFrameChange(frames[frame]);
    }
  }, [frame, frames, onFrameChange]);

  const currentFrame = useMemo(() => {

  if (frames.length === 0) {
    return {
      timestamp: "",
      sensors: [],
    };
  }

  const frameData = frames[frame];

  let sensors = frameData.sensors;

  if (
    playback.area &&
    playback.area !== "world"
  ) {
    sensors = sensors.filter((sensor) =>
      sensor.device_id.startsWith(
        playback.area.toUpperCase()
      )
    );
  }

  return {
    ...frameData,
    sensors,
  };

}, [frame, frames, playback.area]);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <button
          className="time-apply-btn"
          onClick={() => setPlaying(true)}
        >
          ▶ Play
        </button>

        <button
          className="time-apply-btn"
          onClick={() => setPlaying(false)}
        >
          ❚❚ Pause
        </button>

        <button
          className="time-apply-btn"
          onClick={() => {
            setPlaying(false);
            setFrame(0);
          }}
        >
          ↺ Reset
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={frame}
          onChange={(e) => {
            setFrame(Number(e.target.value));
          }}
          style={{
            flex: 1,
          }}
        />
      </div>

      <div
        style={{
          marginBottom: "15px",
          color: "#9ca3af",
        }}
      >
        {currentFrame.timestamp}
      </div>

      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        worldCopyJump
        style={{
          height: "520px",
          width: "100%",
          background: "#0b1120",
          borderRadius: "10px",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap, &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {currentFrame.sensors.map((sensor) => (
          <CircleMarker
            key={sensor.sensor_key}
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
    </>
  );
}