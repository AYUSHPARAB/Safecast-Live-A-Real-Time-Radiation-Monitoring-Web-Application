import { useOutletContext } from "react-router-dom";
import MapView from "../components/MapView";
import StatsPanel from "../components/StatsPanel";
import AlertPanel from "../components/AlertPanel";


export default function LiveMapPage() {
  const { filters } = useOutletContext();

  return (
    <>
      <MapView filters={filters} />

      <div className="bottom-section">
        <StatsPanel />
        <AlertPanel />
      </div>
    </>
  );
}