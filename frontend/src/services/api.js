import { API_URL } from "../constants";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let detail = "";

    try {
      const errorBody = await response.json();
      detail =
        typeof errorBody?.detail === "string"
          ? errorBody.detail
          : JSON.stringify(errorBody?.detail ?? errorBody);
    } catch {
      detail = await response.text();
    }

    throw new Error(
      `API request failed: ${response.status} ${response.statusText}${
        detail ? ` — ${detail}` : ""
      }`
    );
  }

  return response.json();
}

export function getCurrentStats({ signal } = {}) {
  return apiRequest("/api/stats/current", { signal });
}

export function getStatsTimeseries({
  days = 1,
  interval = "1 hour",
  signal,
} = {}) {
  const params = new URLSearchParams({
    days: String(days),
    interval,
  });

  return apiRequest(`/api/stats/timeseries?${params.toString()}`, { signal });
}

export function getAlerts(limit = 20) {
  return apiRequest(`/api/alerts?limit=${limit}`);
}

export function getAlertHistory(days = 30) {
  return apiRequest(`/api/history/alerts?days=${days}`);
}

export function getSpikes(limit = 50) {
  return apiRequest(`/api/spikes?limit=${limit}`);
}

export function getTopHotspots() {
  return apiRequest("/api/top");
}

export function getSensors() {
  return apiRequest("/api/sensors");
}

export function getSensorHistory(sensorKey, hours = 24) {
  return apiRequest(
    `/api/sensors/${encodeURIComponent(sensorKey)}/history?hours=${hours}`
  );
}

export function getIngestionSpeed() {
  return apiRequest("/api/config/speed");
}

export function setIngestionSpeed(multiplier) {
  return apiRequest("/api/config/speed", {
    method: "POST",
    body: JSON.stringify({
      multiplier: Number(multiplier),
    }),
  });
}

export function getHealth({ signal } = {}) {
  return apiRequest("/api/health", { signal });
}
