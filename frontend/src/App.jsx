import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import LiveMapPage from "./pages/LiveMapPage";
import TimeExplorerPage from "./pages/TimeExplorerPage";
import DataGraphsPage from "./pages/DataGraphsPage";
import AlertsPage from "./pages/AlertsPage";
import AboutPage from "./pages/AboutPage";
import "./styles/App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* MainLayout is the shell (header + sidebar + footer);
            the nested pages render in its <Outlet/>. */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<LiveMapPage />} />
          <Route path="time-explorer" element={<TimeExplorerPage />} />
          <Route path="data-graphs" element={<DataGraphsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="about" element={<AboutPage />} />
          {/* unknown routes -> live map */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
