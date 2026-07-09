import { getMockSensors, getMockAlerts, getMockStats } from "../utils/mockData";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, value);
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}


export async function getSensors(filters = {}) {
  if (USE_MOCK) return getMockSensors();
  const res = await fetch(
    apiUrl(`/api/points${buildQuery({
      bbox: filters.bbox,
    })}`)
  );
  if (!res.ok) throw new Error(`points ${res.status}`);
  return res.json();            
}

// ---- STATS ----
export async function getStats() {
  if (USE_MOCK) {
    return getMockStats(getMockSensors());
  }
  const res = await fetch(apiUrl("/api/stats/current"));
  if (!res.ok) throw new Error(`stats ${res.status}`);
  return res.json();
}

// ---- ALERTS ----
export async function getAlerts(limit = 20) {
  if (USE_MOCK) return getMockAlerts();
  const res = await fetch(apiUrl(`/api/alerts?limit=${limit}`));
  if (!res.ok) throw new Error(`alerts ${res.status}`);
  return res.json();            // backend returns a bare array
}

// Placeholder for the future backend history API. Time Explorer still uses
// mock frames until the backend exposes a real historical endpoint.
export async function getHistoricalFrames({ bbox, from, to } = {}) {
  const params = new URLSearchParams();

  if (bbox) params.set("bbox", bbox);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const query = params.toString();
  const res = await fetch(apiUrl(`/api/points${query ? `?${query}` : ""}`));

  if (!res.ok) throw new Error(`historical frames ${res.status}`);

  return res.json();
}

// ---- THRESHOLD CONFIG (POST) ----
export async function setThreshold(threshold) {
  if (USE_MOCK) return { status: "ok", threshold };
  const res = await fetch(apiUrl("/api/config/threshold"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threshold }),
  });
  if (!res.ok) throw new Error(`threshold ${res.status}`);
  return res.json();
}
