import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";


export default function MainLayout() {
  const [filters, setFilters] = useState({
    area: "world",
    bbox: null,
    center: [20, 10],
    zoom: 2,
    threshold: null,

    timeRange: "live",
  });

  return (
    <>
      <Header />

      <div className="dashboard">
        <div className="top-section">
          <Sidebar filters={filters} onFilterChange={setFilters} />

          <main>
            {/* pass render pages*/}
            <Outlet context={{ filters }} />
          </main>
        </div>
      </div>

      <Footer />
    </>
  );
}
