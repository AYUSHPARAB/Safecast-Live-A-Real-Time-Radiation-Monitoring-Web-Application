// Mock data matching backend API format

const SEED_SENSORS = [
  {
    device_id: "JP-TKY-0023",
    latitude: 35.6895,
    longitude: 139.6917,
    base: 310,
    name: "Tokyo, Japan",
  },
  {
    device_id: "JP-FKS-0011",
    latitude: 37.4216,
    longitude: 141.0329,
    base: 480,
    name: "Fukushima, Japan",
  },
  {
    device_id: "DE-BLN-0007",
    latitude: 52.52,
    longitude: 13.405,
    base: 18,
    name: "Berlin, Germany",
  },
  {
    device_id: "DE-HAM-0003",
    latitude: 53.5511,
    longitude: 9.9937,
    base: 22,
    name: "Hamburg, Germany",
  },
  {
    device_id: "US-NYC-0042",
    latitude: 40.7128,
    longitude: -74.006,
    base: 35,
    name: "New York, USA",
  },
  {
    device_id: "US-LAX-0019",
    latitude: 34.0522,
    longitude: -118.2437,
    base: 60,
    name: "Los Angeles, USA",
  },
  {
    device_id: "FR-PAR-0005",
    latitude: 48.8566,
    longitude: 2.3522,
    base: 28,
    name: "Paris, France",
  },
  {
    device_id: "IT-MIL-0008",
    latitude: 45.4642,
    longitude: 9.19,
    base: 240,
    name: "Milan, Italy",
  },
  {
    device_id: "CN-BEI-0031",
    latitude: 39.9042,
    longitude: 116.4074,
    base: 150,
    name: "Beijing, China",
  },
  {
    device_id: "BR-SAO-0014",
    latitude: -23.5505,
    longitude: -46.6333,
    base: 40,
    name: "São Paulo, Brazil",
  },
  {
    device_id: "AU-SYD-0002",
    latitude: -33.8688,
    longitude: 151.2093,
    base: 25,
    name: "Sydney, Australia",
  },
  {
    device_id: "IN-DEL-0027",
    latitude: 28.6139,
    longitude: 77.209,
    base: 70,
    name: "Delhi, India",
  },
];

function jitter(base) {
  const delta = (Math.random() - 0.5) * base * 0.3;
  return Math.max(1, +(base + delta).toFixed(1));
}

export function getMockSensors() {
  const now = Date.now();

  return SEED_SENSORS.map((sensor) => {
    const cpm = jitter(sensor.base);

    return {
      captured_at: now,
      uploaded_at: new Date(now).toISOString(),

      latitude: sensor.latitude,
      longitude: sensor.longitude,

      cpm,
      unit: "cpm",

      device_id: sensor.device_id,
      location_name: sensor.name,

      level: cpm >= 100 ? "high" : "safe",

      sensor_key: `dev:${sensor.device_id}`,
      display_name: sensor.name,
    };
  });
}

export function getMockAlerts() {
  const now = Date.now();

  return [
    {
      captured_at: now - 2 * 60 * 1000,
      latitude: 37.4216,
      longitude: 141.0329,
      cpm: 482,
      unit: "cpm",
      device_id: "JP-FKS-0011",
      location_name: "Fukushima, Japan",
      level: "high",
      display_name: "Fukushima, Japan",
      alert_text: "Dangerous radiation detected in Fukushima, Japan",
    },
    {
      captured_at: now - 5 * 60 * 1000,
      latitude: 39.9042,
      longitude: 116.4074,
      cpm: 312,
      unit: "cpm",
      device_id: "CN-BEI-0031",
      location_name: "Beijing, China",
      level: "high",
      display_name: "Beijing, China",
      alert_text: "Elevated radiation levels detected near Beijing",
    },
    {
      captured_at: now - 10 * 60 * 1000,
      latitude: 45.4642,
      longitude: 9.19,
      cpm: 305,
      unit: "cpm",
      device_id: "IT-MIL-0008",
      location_name: "Milan, Italy",
      level: "high",
      display_name: "Milan, Italy",
      alert_text: "Gamma radiation spike in Northern Italy",
    },
  ];
}

export function getMockStats(sensors) {
  const cpms = sensors.map((sensor) => sensor.cpm);

  const avg = cpms.reduce((sum, value) => sum + value, 0) / cpms.length;
  const max = Math.max(...cpms);

  return {
    avg_cpm: Number(avg.toFixed(1)),
    max_cpm: Number(max.toFixed(1)),
    active_sensors: sensors.length,
    alert_count: 3,
    reading_count: 18392,
  };
}

// ADD THIS AT THE VERY END OF mockData.js

export function getMockHistoricalFrames(frameCount = 30) {
  const frames = [];

  for (let frame = 0; frame < frameCount; frame++) {
    const sensors = getMockSensors().map((sensor) => ({
      ...sensor,
      captured_at:
        Date.now() - (frameCount - frame) * 60 * 1000,

      cpm: Math.max(
        1,
        Number(
          (
            sensor.cpm +
            Math.sin(frame / 3) * 15 +
            (Math.random() - 0.5) * 8
          ).toFixed(1)
        )
      ),
    }));

    frames.push({
      timestamp: new Date(
        Date.now() - (frameCount - frame) * 60 * 1000
      ).toISOString(),

      sensors,
    });
  }

  return frames;
}