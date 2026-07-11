import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ReplayPage from "./ReplayPage.jsx";

createRoot(document.getElementById("replay-root")).render(
  <StrictMode>
    <ReplayPage />
  </StrictMode>
);
