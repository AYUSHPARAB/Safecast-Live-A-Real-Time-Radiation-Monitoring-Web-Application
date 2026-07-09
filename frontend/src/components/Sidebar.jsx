import { ALERT_LEVELS } from "../utils/colors";
import { AREAS } from "../utils/areas";
import NavMenu from "./NavMenu";
import ThresholdControl from "./ThresholdControl";

export default function Sidebar({ filters, onFilterChange }) {
  function handleArea(e) {
    const selected = AREAS.find((area) => area.id === e.target.value);

    onFilterChange({
      ...filters,
      area: selected.id,
      bbox: selected.bbox,
      center: selected.center,
      zoom: selected.zoom,
    });
  }

  function handleThresholdChange(threshold) {
    onFilterChange({
      ...filters,
      threshold,
    });
  }

  return (
    <aside className="sidebar">

      {/* Navigation */}
      <div className="sidebar-card">
        <NavMenu />
      </div>

      {/* Colour scale legend */}
      <div className="sidebar-card">
        <h3>Alert Levels</h3>

        {ALERT_LEVELS.map((item) => (
          <div className="legend-item" key={item.id}>
            <span
              className="legend-color"
              style={{ background: item.color }}
            ></span>

            <span className="legend-text">
              <strong>{item.label}</strong>
              <small>{item.threshold}</small>
            </span>
          </div>
        ))}
      </div>

      {/* Data filters */}
      <div className="sidebar-card">
        <h3>Data Filters</h3>

        <label>Area</label>

        <select
          value={filters.area}
          onChange={handleArea}
        >
          {AREAS.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <ThresholdControl
        threshold={filters.threshold}
        onThresholdChange={handleThresholdChange}
      />

    </aside>
  );
}
