import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ReplayPage from "./ReplayPage.jsx";
import "./styles.css";

createRoot(document.getElementById("replay-root")).render(
  <StrictMode>
    <ReplayPage />
  </StrictMode>
);
