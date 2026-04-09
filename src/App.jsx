import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import DashboardPage from "./pages/DashboardPage";
import EntityPage from "./pages/EntityPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ModerationPage from "./pages/ModerationPage";
import MLLabPage from "./pages/MLLabPage";
import NotFoundPage from "./pages/NotFoundPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import PlacesPage from "./pages/PlacesPage";
import RoutesPage from "./pages/RoutesPage";
import { entityConfigs } from "./data/entityConfigs";
import { useAppSettings } from "./services/AppSettingsContext";

function ProtectedLayout() {
  const { settings } = useAppSettings();

  if (!settings.token) {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="cities" element={<EntityPage config={entityConfigs.cities} />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="poi-types" element={<EntityPage config={entityConfigs.poiTypes} />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="ml-lab" element={<MLLabPage />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
