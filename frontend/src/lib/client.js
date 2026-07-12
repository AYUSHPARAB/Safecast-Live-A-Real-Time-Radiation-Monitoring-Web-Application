import { API_URL } from "../constants.js";


async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}

export function fetchPoints() {
  return request("/api/points");
}

export function fetchAlerts() {
  return request("/api/alerts");
}

export function fetchSpikes() {
  return request("/api/spikes");
}

export function fetchStats() {
  return request("/api/stats/current");
}

export function fetchTop() {
  return request("/api/top");
}

export function fetchTrend(seconds = 3600) {
  return request(`/api/history/trend?seconds=${encodeURIComponent(seconds)}`);
}