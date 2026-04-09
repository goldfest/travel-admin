import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";
import { useAppSettings } from "../services/AppSettingsContext";
import { getCurrentUser, login } from "../services/adminApi";

function LoginPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useAppSettings();
  const [email, setEmail] = useState("admin@mail.ru");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (settings.token) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const authResponse = await login({ email, password });

      updateSettings({
        mode: "api",
        token: authResponse.accessToken || "",
        refreshToken: authResponse.refreshToken || "",
        currentUser: authResponse.user || null,
      });

      try {
        const currentUser = await getCurrentUser();
        updateSettings((current) => ({
          ...current,
          currentUser,
        }));
      } catch {
        // Токен уже сохранён, этого достаточно для дальнейшей навигации.
      }

      navigate("/");
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить вход в админку.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-6">
          <SectionCard
            title="Вход в админ-панель"
            subtitle="После успешной авторизации панель открывается в live-режиме и работает только с backend-данными из БД."
          >
            {error && <div className="alert alert-danger">{error}</div>}

            <form className="row g-3" onSubmit={handleSubmit}>
              <div className="col-12">
                <label className="form-label">Email администратора</label>
                <input
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label">Пароль</label>
                <input
                  className="form-control"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Вхожу..." : "Войти"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
