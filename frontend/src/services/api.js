
import { getMockSensors, getMockAlerts, getMockStats } from "../utils/mockData";

export const USE_MOCK = false;                 
const BASE_URL = "http://localhost:8000";      


export async function getSensors() {
  if (USE_MOCK) return getMockSensors();
  const res = await fetch(`${BASE_URL}/api/points`);
  if (!res.ok) throw new Error(`points ${res.status}`);
  return res.json();            
}

// ---- STATS ----
export async function getStats() {
  if (USE_MOCK) {
    return getMockStats(getMockSensors());
  }
  const res = await fetch(`${BASE_URL}/api/stats/current`);
  if (!res.ok) throw new Error(`stats ${res.status}`);
  return res.json();
}

// ---- ALERTS ----
export async function getAlerts(limit = 20) {
  if (USE_MOCK) return getMockAlerts();
  const res = await fetch(`${BASE_URL}/api/alerts?limit=${limit}`);
  if (!res.ok) throw new Error(`alerts ${res.status}`);
  return res.json();            // backend returns a bare array
}

// ---- THRESHOLD CONFIG (POST) ----
export async function setThreshold(threshold) {
  if (USE_MOCK) return { status: "ok", threshold };
  const res = await fetch(`${BASE_URL}/api/config/threshold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threshold }),
  });
  if (!res.ok) throw new Error(`threshold ${res.status}`);
  return res.json();
}