import { COLOR_SCALE } from "../utils/colors";
import { AREAS } from "../utils/areas";
import NavMenu from "./NavMenu";
import ThresholdControl from "./ThresholdControl";

export default function Sidebar({ filters, onFilterChange }) {
  function handleMin(e) {
    onFilterChange({ ...filters, minCpm: Number(e.target.value) });
  }

  function handleMax(e) {
    const v = e.target.value;
    onFilterChange({
      ...filters,
      maxCpm: v === "500+" ? null : Number(v),
    });
  }

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

  return (
    <aside className="sidebar">

      {/* Navigation */}
      <div className="sidebar-card">
        <NavMenu />
      </div>

      {/* Colour scale legend */}
      <div className="sidebar-card">
        <h3>Color Scale (CPM)</h3>

        {COLOR_SCALE.map((item) => (
          <div className="legend-item" key={item.label}>
            <span
              className="legend-color"
              style={{ background: item.color }}
            ></span>

            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Data filters */}
      <div className="sidebar-card">
        <h3>Data Filters</h3>

        <label>Min CPM</label>

        <select value={filters.minCpm} onChange={handleMin}>
          <option value="0">0</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>

        <label>Max CPM</label>

        <select
          value={filters.maxCpm === null ? "500+" : String(filters.maxCpm)}
          onChange={handleMax}
        >
          <option value="500+">500+</option>
          <option value="300">300</option>
          <option value="200">200</option>
          <option value="100">100</option>
        </select>

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

      <ThresholdControl />

    </aside>
  );
}