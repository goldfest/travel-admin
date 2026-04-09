import { useEffect, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useAppSettings } from "../services/AppSettingsContext";
import {
  countRoutes,
  getCurrentUser,
  getPendingReportsCount,
  getRouteHealth,
  listCities,
  listPoiTypes,
  listUnverifiedPois,
} from "../services/adminApi";
import { getDashboardSnapshot } from "../services/storage";

function DashboardPage() {
  const { settings, updateSettings } = useAppSettings();
  const [formState, setFormState] = useState(settings);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isApiMode = settings.mode === "api";
  const snapshot = getDashboardSnapshot();

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  useEffect(() => {
    if (!isApiMode || !settings.token) {
      return;
    }

    const loadLiveMetrics = async () => {
      setLoading(true);
      setError("");

      try {
        const [
          meResult,
          citiesResult,
          poiTypesResult,
          pendingReportsResult,
          unverifiedResult,
          routeCountResult,
          routeHealthResult,
        ] = await Promise.allSettled([
          getCurrentUser(),
          listCities(),
          listPoiTypes(),
          getPendingReportsCount(),
          listUnverifiedPois(),
          countRoutes(),
          getRouteHealth(),
        ]);

        const currentUser = meResult.status === "fulfilled" ? meResult.value : null;

        setLiveMetrics({
          currentUser,
          citiesCount: citiesResult.status === "fulfilled" ? citiesResult.value.totalElements : 0,
          poiTypesCount: poiTypesResult.status === "fulfilled" ? poiTypesResult.value.totalElements : 0,
          pendingReports: pendingReportsResult.status === "fulfilled" ? pendingReportsResult.value : 0,
          unverifiedPois: unverifiedResult.status === "fulfilled" ? unverifiedResult.value.totalElements : 0,
          routesCount: routeCountResult.status === "fulfilled" ? routeCountResult.value : 0,
          routeHealth: routeHealthResult.status === "fulfilled" ? routeHealthResult.value : null,
        });

        if (currentUser) {
          updateSettings((current) => ({
            ...current,
            currentUser,
          }));
        }

        const failedServices = [
          meResult.status === "rejected" ? "auth" : null,
          citiesResult.status === "rejected" ? "city" : null,
          poiTypesResult.status === "rejected" ? "poi-types" : null,
          pendingReportsResult.status === "rejected" ? "review" : null,
          unverifiedResult.status === "rejected" ? "poi moderation" : null,
          routeCountResult.status === "rejected" ? "routes" : null,
          routeHealthResult.status === "rejected" ? "route health" : null,
        ].filter(Boolean);

        if (failedServices.length > 0) {
          setError(`Часть live-метрик недоступна: ${failedServices.join(", ")}.`);
        }
      } finally {
        setLoading(false);
      }
    };

    loadLiveMetrics();
  }, [isApiMode, settings.token, updateSettings]);

  const statCards = isApiMode
    ? [
        { label: "Текущий админ", value: liveMetrics?.currentUser?.username || "-", tone: "info", icon: "bi-person-badge-fill" },
        { label: "Города", value: liveMetrics?.citiesCount ?? "-", tone: "success", icon: "bi-buildings-fill" },
        { label: "Типы POI", value: liveMetrics?.poiTypesCount ?? "-", tone: "warning", icon: "bi-tags-fill" },
        { label: "Маршруты", value: liveMetrics?.routesCount ?? "-", tone: "info", icon: "bi-map-fill" },
        { label: "Жалобы в работе", value: liveMetrics?.pendingReports ?? "-", tone: "danger", icon: "bi-flag-fill" },
      ]
    : [
        { label: "Пользователи", value: snapshot.totalUsers, tone: "info", icon: "bi-people-fill" },
        { label: "Города", value: snapshot.totalCities, tone: "success", icon: "bi-buildings-fill" },
        { label: "POI", value: snapshot.totalPlaces, tone: "warning", icon: "bi-signpost-2-fill" },
        { label: "Жалобы в очереди", value: snapshot.pendingComplaints, tone: "danger", icon: "bi-flag-fill" },
      ];

  const handleFieldChange = (section, key, value) => {
    if (section === "root") {
      setFormState((current) => ({ ...current, [key]: value }));
      return;
    }

    setFormState((current) => ({
      ...current,
      services: {
        ...current.services,
        [key]: value,
      },
    }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    updateSettings(formState);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        {statCards.map((card) => (
          <div className="col-12 col-md-6 col-xl" key={card.label}>
            <StatCard {...card} />
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <SectionCard
            title="Настройки подключения"
            subtitle="Панель может работать в mock-режиме или напрямую с живыми docker-сервисами."
          >
            {error && <div className="alert alert-warning">{error}</div>}
            {loading && <div className="text-secondary mb-3">Обновляю live-метрики...</div>}

            <form className="row g-3" onSubmit={handleSave}>
              <div className="col-12">
                <label className="form-label">JWT-токен</label>
                <input
                  className="form-control"
                  placeholder="Bearer token для auth, poi, review и route сервисов"
                  value={formState.token}
                  onChange={(event) => handleFieldChange("root", "token", event.target.value)}
                />
              </div>

              {Object.entries(formState.services).map(([key, value]) => (
                <div className="col-md-6" key={key}>
                  <label className="form-label text-capitalize">{key} service</label>
                  <input
                    className="form-control"
                    value={value}
                    onChange={(event) => handleFieldChange("services", key, event.target.value)}
                  />
                </div>
              ))}

              <div className="col-12 d-flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-save2 me-2" />
                  Сохранить настройки
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setFormState(settings)}>
                  Вернуть сохранённые
                </button>
              </div>
            </form>
          </SectionCard>
        </div>

        <div className="col-12 col-xl-5">
          <SectionCard
            title="Сводка окружения"
            subtitle="Админка уже знает про split-backend и его топологию."
          >
            <div className="d-flex flex-column gap-3">
              <div className="soft-list-item p-3">
                <div className="fw-semibold mb-1">feature/poi-service</div>
                <div className="text-secondary small">
                  city-service, poi-service, review-service и ML worker.
                </div>
              </div>
              <div className="soft-list-item p-3">
                <div className="fw-semibold mb-1">feature/route-service</div>
                <div className="text-secondary small">
                  auth-service, route-service, graph-importer, notification-service и personalization-service.
                </div>
              </div>
              <div className="soft-list-item p-3">
                <div className="fw-semibold mb-2">Состояние route-service</div>
                {liveMetrics?.routeHealth ? (
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <StatusBadge value={liveMetrics.routeHealth.status} />
                    <span className="small text-secondary">
                      {liveMetrics.routeHealth.service} на порту {liveMetrics.routeHealth.port}
                    </span>
                  </div>
                ) : (
                  <div className="text-secondary small">Данные по route-service ещё не загружены.</div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {isApiMode ? (
        <SectionCard title="Текущая live-сессия" subtitle="Профиль администратора и счётчики из живых сервисов.">
          {liveMetrics?.currentUser ? (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex flex-wrap gap-2">
                <StatusBadge value={liveMetrics.currentUser.role} />
                <StatusBadge value={liveMetrics.currentUser.status} />
              </div>
              <div>
                <div className="section-title">Логин администратора</div>
                <div className="fw-semibold">{liveMetrics.currentUser.username}</div>
              </div>
              <div className="text-secondary">
                Непроверенных POI в очереди: <strong>{liveMetrics?.unverifiedPois ?? "-"}</strong>
              </div>
            </div>
          ) : (
            <div className="text-secondary">Сессия ещё не загружена.</div>
          )}
        </SectionCard>
      ) : (
        <div className="row g-4">
          <div className="col-12 col-xl-6">
            <SectionCard title="Последние жалобы" subtitle="Быстрый mock-срез очереди модерации.">
              <div className="d-flex flex-column gap-3">
                {snapshot.recentComplaints.map((complaint) => (
                  <div key={complaint.id} className="soft-list-item p-3">
                    <div className="d-flex justify-content-between gap-3 flex-wrap">
                      <div>
                        <div className="fw-semibold">{complaint.subjectName}</div>
                        <div className="text-secondary small">{complaint.reason}</div>
                      </div>
                      <StatusBadge value={complaint.status} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="col-12 col-xl-6">
            <SectionCard title="Очередь модерации" subtitle="Локальные draft POI и жалобы, ожидающие проверки.">
              <div className="d-flex flex-column gap-3">
                {snapshot.recentModeration.map((item) => (
                  <div key={item.id} className="soft-list-item p-3">
                    <div className="d-flex justify-content-between gap-3 flex-wrap">
                      <div>
                        <div className="fw-semibold">{item.title}</div>
                        <div className="text-secondary small">
                          {item.source} - score {item.qualityScore} - {item.assignee}
                        </div>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
