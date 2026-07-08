import { NavLink } from "react-router-dom";


const NAV_ITEMS = [
  { to: "/", label: "Live Map", icon: "◉", end: true },
  { to: "/time-explorer", label: "Time Explorer", icon: "◷" },
  { to: "/data-graphs", label: "Data & Graphs", icon: "▦" },
  { to: "/alerts", label: "Alerts", icon: "⚠" },
  { to: "/sensors", label: "Sensors", icon: "◈" },
  { to: "/about", label: "About", icon: "ⓘ" },
];

export default function NavMenu() {
  return (
    <nav className="nav-menu">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            "nav-item" + (isActive ? " nav-item-active" : "")
          }
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}