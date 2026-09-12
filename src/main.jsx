import React from "react";
import { createRoot } from "react-dom/client";
import { instalarAlmacen } from "./almacen";
import App from "./App";

instalarAlmacen();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(<App />);
