import { useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../services/AppSettingsContext";

const titles = {
  "/": "Обзор проекта",
  "/users": "Управление пользователями",
  "/cities": "Каталог городов",
  "/places": "Управление POI",
  "/routes": "Управление маршрутами",
  "/poi-types": "Справочник типов POI",
  "/complaints": "Обработка жалоб",
  "/moderation": "Очередь модерации",
  "/ml-lab": "ML и операции импорта",
};

function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, clearSession } = useAppSettings();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="topbar-card p-3 p-lg-4">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <div className="section-title">Travel Control Room</div>
          <h1 className="h3 mb-1">{titles[location.pathname] || "Админ-панель"}</h1>
          <div className="text-secondary">
            Единая панель для сервисов из `feature/poi-service` и `feature/route-service`.
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {settings.currentUser?.username && (
            <span className="status-pill status-pill--info">{settings.currentUser.username}</span>
          )}
          <span className={`status-pill status-pill--${settings.mode === "mock" ? "secondary" : "info"}`}>
            {settings.mode === "mock" ? "Mock-режим" : "Live API"}
          </span>
          <span className={`status-pill status-pill--${settings.token ? "success" : "warning"}`}>
            {settings.token ? "JWT задан" : "JWT не задан"}
          </span>
          {settings.token && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
              Выйти
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Topbar;
