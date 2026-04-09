import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Дашборд", icon: "bi-speedometer2" },
  { to: "/users", label: "Пользователи", icon: "bi-people-fill" },
  { to: "/cities", label: "Города", icon: "bi-buildings-fill" },
  { to: "/places", label: "POI", icon: "bi-signpost-2-fill" },
  { to: "/routes", label: "Маршруты", icon: "bi-map-fill" },
  { to: "/poi-types", label: "Типы POI", icon: "bi-tags-fill" },
  { to: "/complaints", label: "Жалобы", icon: "bi-flag-fill" },
  { to: "/moderation", label: "Модерация", icon: "bi-shield-check" },
  { to: "/ml-lab", label: "ML и импорт", icon: "bi-cpu-fill" },
];

function Sidebar() {
  return (
    <aside className="admin-sidebar p-3 p-lg-4">
      <div className="admin-brand p-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="rounded-4 bg-white text-dark d-inline-flex align-items-center justify-content-center p-3">
            <i className="bi bi-compass-fill fs-4" />
          </div>
          <div>
            <div className="fw-bold fs-5">Travel Admin</div>
            <div className="small text-white-50">Панель управления на React + Bootstrap</div>
          </div>
        </div>
      </div>

      <div className="small text-uppercase text-white-50 fw-semibold mb-3">Разделы</div>

      <nav className="admin-nav d-flex flex-column gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
          >
            <i className={`bi ${item.icon}`} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 pt-4 border-top border-secondary-subtle">
        <div className="small text-uppercase text-white-50 fw-semibold mb-2">Docker</div>
        <div className="small text-white-50">
          Бэкенд разнесён по веткам, но рабочий стек уже собирается внутри сети `travel-net`.
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
