// Converts CPM value into marker color.

export function cpmToColor(cpm) {
  if (cpm < 50) return "#22c55e";   // Green
  if (cpm < 100) return "#84cc16";  // Light Green
  if (cpm < 200) return "#eab308";  // Yellow
  if (cpm < 300) return "#f97316";  // Orange
  return "#ef4444";                 // Red
}

// Converts CPM value into readable severity text.

export function cpmToSeverity(cpm) {
  if (cpm < 100) return "Normal";
  if (cpm < 300) return "Elevated";
  return "High";
}

// Used for sidebar legend.

export const COLOR_SCALE = [
  {
    label: "0 – 50",
    color: "#22c55e",
  },
  {
    label: "50 – 100",
    color: "#84cc16",
  },
  {
    label: "100 – 200",
    color: "#eab308",
  },
  {
    label: "200 – 300",
    color: "#f97316",
  },
  {
    label: "300+",
    color: "#ef4444",
  },
];