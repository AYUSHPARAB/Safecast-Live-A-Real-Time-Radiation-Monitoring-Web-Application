export const ALERT_LEVELS = [
  {
    id: "safe",
    label: "Safe",
    threshold: "Below alert threshold",
    color: "#22c55e",
  },
  {
    id: "warning",
    label: "Warning",
    threshold: "At least 1x threshold",
    color: "#eab308",
  },
  {
    id: "elevated",
    label: "Elevated",
    threshold: "At least 2x threshold",
    color: "#f97316",
  },
  {
    id: "high",
    label: "High",
    threshold: "At least 3x threshold",
    color: "#ef4444",
  },
];

const LEVEL_COLORS = Object.fromEntries(
  ALERT_LEVELS.map((level) => [level.id, level.color])
);

export function levelToColor(level, fallbackCpm = 0) {
  return LEVEL_COLORS[level] || cpmToColor(fallbackCpm);
}

// Converts CPM value into marker color when a backend level is unavailable.

export function cpmToColor(cpm) {
  if (cpm < 50) return "#22c55e";   // Green
  if (cpm < 100) return "#84cc16";  // Light Green
  if (cpm < 200) return "#eab308";  // Yellow
  if (cpm < 300) return "#f97316";  // Orange
  return "#ef4444";                 // Red
}

// Converts CPM value into readable severity text.

export function cpmToSeverity(cpm) {
  if (cpm < 100) return "Safe";
  if (cpm < 300) return "Elevated";
  return "High";
}

// Used for sidebar legend.
export const COLOR_SCALE = ALERT_LEVELS;
