import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import App from "./App";
import "./styles.css";
import { AppSettingsProvider } from "./services/AppSettingsContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
