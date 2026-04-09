import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

function AdminLayout() {
  return (
    <div className="admin-shell d-lg-flex">
      <Sidebar />
      <main className="admin-content p-3 p-lg-4">
        <Topbar />
        <div className="pt-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
