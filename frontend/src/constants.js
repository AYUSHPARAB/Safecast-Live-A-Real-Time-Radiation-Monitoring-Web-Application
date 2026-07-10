export const COLORS = {
  safe: "#3fb950",
  warning: "#d29922",
  elevated: "#f0883e",
  high: "#f85149",
};

// Reserved for the future backend integration. Nothing connects automatically.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
