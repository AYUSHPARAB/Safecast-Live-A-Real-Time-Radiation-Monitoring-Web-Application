import { useOutletContext } from "react-router-dom";
import MapView from "../components/MapView";
import StatsPanel from "../components/StatsPanel";
import AlertPanel from "../components/AlertPanel";
import RadiationTrendChart from "../components/RadiationTrendChart";


export default function LiveMapPage() {
  const { filters } = useOutletContext();

  return (
    <>
      <MapView filters={filters} />

      <div className="live-bottom-dashboard">
        <div className="live-bottom-left">
          <StatsPanel className="live-stats-card" />
          <AlertPanel
            className="live-alerts-card"
          />
        </div>

        <RadiationTrendChart />
      </div>
    </>
  );
}
