import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAppRouter } from "@/core/router/router";
import "@/styles/fonts.css";
import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("The document has no #root element to mount into");
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
