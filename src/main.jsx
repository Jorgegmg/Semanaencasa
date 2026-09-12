import React from "react";
import { createRoot } from "react-dom/client";
import { instalarAlmacen } from "./almacen";
import App from "./App";

instalarAlmacen();
createRoot(document.getElementById("root")).render(<App />);
