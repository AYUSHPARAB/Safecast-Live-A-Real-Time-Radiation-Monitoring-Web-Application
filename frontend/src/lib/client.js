import { API_URL } from "../constants.js";

// Future integration boundary. These functions are never called on page load.
async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}

export function fetchSnapshot() {
  return request("/api/current");
}

export function postConfig(config) {
  return request("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export function fetchTrend(seconds = 3600) {
  return request(`/api/history/trend?seconds=${encodeURIComponent(seconds)}`);
}
