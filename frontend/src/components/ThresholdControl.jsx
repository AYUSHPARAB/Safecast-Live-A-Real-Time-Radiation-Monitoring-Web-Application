import { useState } from "react";
import { setThreshold } from "../services/api";

export default function ThresholdControl({
  threshold = null,
  onThresholdChange,
}) {
  const [value, setValue] = useState(threshold ?? 300);
  const [status, setStatus] = useState(null); // "saving" | "ok" | "error"
 
  async function handleSet() {
    const nextThreshold = Number(value);
    if (!Number.isFinite(nextThreshold) || nextThreshold < 0) {
      setStatus("error");
      return;
    }

    setStatus("saving");

    try {
      await setThreshold(nextThreshold);
      onThresholdChange?.(nextThreshold);
      setStatus("ok");
    } catch (err) {
      console.error("threshold update failed:", err);
      setStatus("error");
    }
  }

  function handleClear() {
    setValue("");
    setStatus(null);
  }
 
  return (
    <div className="sidebar-card">
      <h3>Alert Threshold (CPM)</h3>
 
      <label>Base alert threshold</label>
      <input
        className="threshold-input"
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
 
      <button className="threshold-btn" onClick={handleSet}>
        Set Threshold
      </button>

      <button
        className="threshold-btn secondary"
        onClick={handleClear}
      >
        Clear Threshold
      </button>
 
      {status === "saving" && <p className="threshold-msg muted">Saving…</p>}
      {status === "ok" && (
        <p className="threshold-msg ok">Threshold set to {value} CPM</p>
      )}
      {status === "error" && (
        <p className="threshold-msg err">Failed to update. Try again.</p>
      )}
    </div>
  );
}
