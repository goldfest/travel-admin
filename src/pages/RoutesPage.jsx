import { useCallback, useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import EntityTable from "../components/ui/EntityTable";
import { useAppSettings } from "../services/AppSettingsContext";
import {
  addRoutePoint,
  archiveRoute,
  createRoute,
  deleteRoute,
  duplicateRoute,
  generateRoute,
  getCityLookup,
  getRoute,
  getRouteHealth,
  getRouteReadiness,
  getRouteVersion,
  listRoutes,
  optimizeRoute,
  removeRoutePoint,
  reorderRouteDayPoints,
  unarchiveRoute,
  updateRoute,
} from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";

const routeModes = [
  { value: "active", label: "Активные маршруты" },
  { value: "archived", label: "Архивные маршруты" },
];

const transportModes = ["WALK", "PUBLIC_TRANSPORT", "CAR", "MIXED"];
const optimizationModes = ["TIME", "DISTANCE"];
const routeStatuses = ["DRAFT", "GRAPH_PREPARING", "READY", "ARCHIVED"];

function normalizeDateTimeLocal(value) {
  if (!value) {
    return null;
  }

  return value.length === 16 ? `${value}:00` : value;
}

function toDatetimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (item) => String(item).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function parseCsvIds(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter((item) => Number.isFinite(item));
}

function mapRouteRecord(route) {
  return {
    id: route.id,
    name: route.name,
    cityName: route.cityName || `Город #${route.cityId}`,
    status: route.status,
    transportMode: route.transportMode,
    daysCount: route.daysCount ?? route.routeDays?.length ?? 0,
    totalPoints: route.totalPoints ?? 0,
    updatedAt: formatDateTime(route.updatedAt),
    isArchived: Boolean(route.isArchived) || route.status === "ARCHIVED",
  };
}

function buildEditForm(route) {
  return {
    name: route?.name || "",
    description: route?.description || "",
    transportMode: route?.transportMode || "WALK",
    status: route?.status || "DRAFT",
    optimizationMode: route?.optimizationMode || "TIME",
    startPoint: route?.startPoint || "",
    endPoint: route?.endPoint || "",
    dayPlanningDate: toDatetimeLocal(route?.updatedAt),
  };
}

function RoutesPage() {
  const { settings } = useAppSettings();
  const [cities, setCities] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [mode, setMode] = useState("active");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generateForm, setGenerateForm] = useState({
    cityId: "",
    daysCount: "3",
    interests: "history,culture,food",
    budgetLevel: "2",
    transportMode: "WALK",
    optimize: "true",
  });
  const [manualForm, setManualForm] = useState({
    name: "",
    description: "",
    cityId: "",
    startDate: "",
    transportMode: "WALK",
    status: "DRAFT",
    poiIds: "",
    estimatedVisitMinutes: "90",
    autoOptimize: "false",
    optimizationMode: "TIME",
  });
  const [editForm, setEditForm] = useState(buildEditForm(null));
  const [pointForm, setPointForm] = useState({
    poiId: "",
    dayNumber: "1",
    orderIndex: "",
  });
  const [reorderForm, setReorderForm] = useState({
    dayId: "",
    routePointIds: "",
  });

  const isApiMode = settings.mode === "api";

  const loadServiceInfo = useCallback(async () => {
    setServiceLoading(true);

    try {
      const [healthResult, readinessResult, versionResult] = await Promise.allSettled([
        getRouteHealth(),
        getRouteReadiness(),
        getRouteVersion(),
      ]);

      setServiceInfo({
        health: healthResult.status === "fulfilled" ? healthResult.value : null,
        readiness: readinessResult.status === "fulfilled" ? readinessResult.value : null,
        version: versionResult.status === "fulfilled" ? versionResult.value : null,
      });
    } finally {
      setServiceLoading(false);
    }
  }, []);

  const loadSelectedRoute = useCallback(async (routeId) => {
    const details = await getRoute(routeId);
    setSelectedRouteId(details.id);
    setSelectedRoute(details);
    setEditForm(buildEditForm(details));

    const firstDay = details.routeDays?.[0];
    setPointForm((current) => ({
      ...current,
      dayNumber: firstDay ? String(firstDay.dayNumber) : "1",
    }));
    setReorderForm({
      dayId: firstDay?.id ? String(firstDay.id) : "",
      routePointIds: "",
    });

    return details;
  }, []);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const page = await listRoutes({
        page: 0,
        size: 50,
        archived: mode === "archived",
      });

      setRecords(page.items.map(mapRouteRecord));

      if (selectedRouteId) {
        await loadSelectedRoute(selectedRouteId);
      }
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить маршруты.");
    } finally {
      setLoading(false);
    }
  }, [loadSelectedRoute, mode, selectedRouteId]);

  useEffect(() => {
    if (!isApiMode) {
      return;
    }

    const bootstrap = async () => {
      setLoading(true);
      setError("");

      try {
        const [cityLookup] = await Promise.all([getCityLookup(), loadServiceInfo()]);
        setCities(cityLookup);

        if (cityLookup[0]?.id) {
          setGenerateForm((current) => ({
            ...current,
            cityId: current.cityId || String(cityLookup[0].id),
          }));
          setManualForm((current) => ({
            ...current,
            cityId: current.cityId || String(cityLookup[0].id),
          }));
        }
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить данные route-service.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [isApiMode, loadServiceInfo]);

  useEffect(() => {
    if (!isApiMode) {
      return;
    }

    loadRoutes();
  }, [isApiMode, loadRoutes]);

  const statCards = useMemo(
    () => [
      { label: "Загружено маршрутов", value: records.length, tone: "info", icon: "bi-map-fill" },
      {
        label: "Готовы",
        value: records.filter((record) => record.status === "READY").length,
        tone: "success",
        icon: "bi-check2-circle",
      },
      {
        label: "Готовятся",
        value: records.filter((record) => record.status === "GRAPH_PREPARING").length,
        tone: "warning",
        icon: "bi-arrow-repeat",
      },
      {
        label: "Точек в выбранном",
        value: selectedRoute?.totalPoints ?? 0,
        tone: "secondary",
        icon: "bi-geo-alt-fill",
      },
    ],
    [records, selectedRoute],
  );

  if (!isApiMode) {
    return (
      <SectionCard
        title="Маршруты доступны только в API-режиме"
        subtitle="Route-service работает в пользовательском контексте, поэтому этот раздел нужен только с живым JWT."
      >
        <div className="text-secondary">
          Переключи панель в API-режим на дашборде и укажи корректный JWT, после этого здесь станут доступны живые операции с маршрутами.
        </div>
      </SectionCard>
    );
  }

  const handleGenerate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const route = await generateRoute({
        cityId: Number(generateForm.cityId),
        daysCount: Number(generateForm.daysCount),
        interests: generateForm.interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        budgetLevel: Number(generateForm.budgetLevel),
        transportMode: generateForm.transportMode,
        optimize: generateForm.optimize === "true",
      });

      await loadSelectedRoute(route.id);
      setNotice(`Маршрут #${route.id} успешно сгенерирован.`);
      await loadRoutes();
    } catch (requestError) {
      setError(requestError.message || "Не удалось сгенерировать маршрут.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const poiIds = parseCsvIds(manualForm.poiIds);

      if (!manualForm.name.trim()) {
        throw new Error("Укажи название маршрута.");
      }

      if (!manualForm.cityId) {
        throw new Error("Выбери город.");
      }

      if (poiIds.length === 0) {
        throw new Error("Нужно указать хотя бы один POI ID для ручного создания маршрута.");
      }

      const route = await createRoute({
        name: manualForm.name.trim(),
        description: manualForm.description.trim() || null,
        cityId: Number(manualForm.cityId),
        transportMode: manualForm.transportMode,
        startDate: normalizeDateTimeLocal(manualForm.startDate),
        days: [
          {
            dayNumber: 1,
            description: "День 1",
            points: poiIds.map((poiId, index) => ({
              poiId,
              orderIndex: index + 1,
              estimatedVisitMinutes: Number(manualForm.estimatedVisitMinutes),
            })),
          },
        ],
        status: manualForm.status,
        autoOptimize: manualForm.autoOptimize === "true",
        optimizationMode: manualForm.optimizationMode,
      });

      await loadSelectedRoute(route.id);
      setNotice(`Маршрут #${route.id} успешно создан.`);
      setManualForm((current) => ({
        ...current,
        name: "",
        description: "",
        poiIds: "",
      }));
      await loadRoutes();
    } catch (requestError) {
      setError(requestError.message || "Не удалось создать маршрут.");
    } finally {
      setSaving(false);
    }
  };

  const handleRouteAction = async (action, route) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (action === "view") {
        await loadSelectedRoute(route.id);
        return;
      }

      if (action === "archive") {
        await archiveRoute(route.id);
        setNotice(`Маршрут #${route.id} отправлен в архив.`);
      }

      if (action === "unarchive") {
        await unarchiveRoute(route.id);
        setNotice(`Маршрут #${route.id} восстановлен из архива.`);
      }

      if (action === "optimize") {
        const optimized = await optimizeRoute(route.id, "TIME");
        await loadSelectedRoute(optimized.id);
        setNotice(`Маршрут #${route.id} оптимизирован.`);
      }

      if (action === "duplicate") {
        const newName = window.prompt("Название для копии маршрута", `${route.name} (копия)`);
        const duplicate = await duplicateRoute(route.id, newName || undefined);
        await loadSelectedRoute(duplicate.id);
        setNotice(`Маршрут #${route.id} скопирован в маршрут #${duplicate.id}.`);
      }

      if (action === "delete") {
        if (!window.confirm(`Удалить маршрут #${route.id}?`)) {
          return;
        }

        await deleteRoute(route.id);

        if (selectedRouteId === route.id) {
          setSelectedRouteId(null);
          setSelectedRoute(null);
          setEditForm(buildEditForm(null));
        }

        setNotice(`Маршрут #${route.id} удалён.`);
      }

      await loadRoutes();
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить действие с маршрутом.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoute = async (event) => {
    event.preventDefault();

    if (!selectedRouteId) {
      setError("Сначала выбери маршрут.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateRoute(selectedRouteId, {
        name: editForm.name || null,
        description: editForm.description || null,
        transportMode: editForm.transportMode,
        status: editForm.status,
        optimizationMode: editForm.optimizationMode || null,
        startPoint: editForm.startPoint || null,
        endPoint: editForm.endPoint || null,
        dayPlanningDate: normalizeDateTimeLocal(editForm.dayPlanningDate),
      });

      await loadSelectedRoute(selectedRouteId);
      await loadRoutes();
      setNotice(`Маршрут #${selectedRouteId} обновлён.`);
    } catch (requestError) {
      setError(requestError.message || "Не удалось обновить маршрут.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPoint = async (event) => {
    event.preventDefault();

    if (!selectedRouteId) {
      setError("Сначала выбери маршрут.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await addRoutePoint(selectedRouteId, {
        poiId: Number(pointForm.poiId),
        dayNumber: pointForm.dayNumber ? Number(pointForm.dayNumber) : null,
        orderIndex: pointForm.orderIndex ? Number(pointForm.orderIndex) : null,
      });

      await loadSelectedRoute(selectedRouteId);
      await loadRoutes();
      setPointForm((current) => ({
        ...current,
        poiId: "",
        orderIndex: "",
      }));
      setNotice(`Точка добавлена в маршрут #${selectedRouteId}.`);
    } catch (requestError) {
      setError(requestError.message || "Не удалось добавить точку.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePoint = async (routePointId) => {
    if (!selectedRouteId) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await removeRoutePoint(selectedRouteId, routePointId);
      await loadSelectedRoute(selectedRouteId);
      await loadRoutes();
      setNotice(`Точка #${routePointId} удалена.`);
    } catch (requestError) {
      setError(requestError.message || "Не удалось удалить точку.");
    } finally {
      setSaving(false);
    }
  };

  const handleReorderPoints = async (event) => {
    event.preventDefault();

    if (!selectedRouteId || !reorderForm.dayId) {
      setError("Нужно выбрать маршрут и день.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const routePointIdsInOrder = parseCsvIds(reorderForm.routePointIds);

      if (routePointIdsInOrder.length === 0) {
        throw new Error("Укажи ID точек маршрута через запятую.");
      }

      await reorderRouteDayPoints(selectedRouteId, Number(reorderForm.dayId), routePointIdsInOrder);
      await loadSelectedRoute(selectedRouteId);
      await loadRoutes();
      setNotice(`Порядок точек обновлён для дня #${reorderForm.dayId}.`);
    } catch (requestError) {
      setError(requestError.message || "Не удалось изменить порядок точек.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        {statCards.map((card) => (
          <div className="col-12 col-md-6 col-xl-3" key={card.label}>
            <StatCard {...card} />
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <SectionCard
            title="Состояние route-service"
            subtitle="Операционный статус сервиса маршрутов из ветки `feature/route-service`."
            action={
              <button type="button" className="btn btn-outline-primary" onClick={loadServiceInfo}>
                {serviceLoading ? "Обновляю..." : "Обновить статус"}
              </button>
            }
          >
            <div className="row g-3">
              <div className="col-md-4">
                <div className="soft-list-item p-3 h-100">
                  <div className="fw-semibold mb-2">Health</div>
                  {serviceInfo?.health ? (
                    <div className="d-flex flex-column gap-2">
                      <StatusBadge value={serviceInfo.health.status} />
                      <div className="small text-secondary">{serviceInfo.health.service}</div>
                    </div>
                  ) : (
                    <div className="text-secondary small">Данные ещё не загружены.</div>
                  )}
                </div>
              </div>
              <div className="col-md-4">
                <div className="soft-list-item p-3 h-100">
                  <div className="fw-semibold mb-2">Readiness</div>
                  {serviceInfo?.readiness ? (
                    <div className="d-flex flex-column gap-2">
                      <StatusBadge value={serviceInfo.readiness.status} />
                      <div className="small text-secondary">{serviceInfo.readiness.database}</div>
                    </div>
                  ) : (
                    <div className="text-secondary small">Данные ещё не загружены.</div>
                  )}
                </div>
              </div>
              <div className="col-md-4">
                <div className="soft-list-item p-3 h-100">
                  <div className="fw-semibold mb-2">Версия</div>
                  {serviceInfo?.version ? (
                    <div className="d-flex flex-column gap-2">
                      <div className="fw-semibold">{serviceInfo.version.version}</div>
                      <div className="small text-secondary">{serviceInfo.version.environment}</div>
                    </div>
                  ) : (
                    <div className="text-secondary small">Данные ещё не загружены.</div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="col-12 col-xl-5">
          <SectionCard
            title="Режим списка маршрутов"
            subtitle="Переключение между активными и архивными маршрутами текущей JWT-сессии."
          >
            <div className="row g-3 align-items-end">
              <div className="col-md-8">
                <label className="form-label">Показывать</label>
                <select className="form-select" value={mode} onChange={(event) => setMode(event.target.value)}>
                  {routeModes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <button type="button" className="btn btn-primary w-100" onClick={loadRoutes}>
                  {loading ? "Загрузка..." : "Обновить"}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}
      {notice && <div className="alert alert-info mb-0">{notice}</div>}

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <SectionCard title="Автогенерация маршрута" subtitle="Использует `POST /v1/routes/generate`.">
            <form className="row g-3" onSubmit={handleGenerate}>
              <div className="col-md-6">
                <label className="form-label">Город</label>
                <select
                  className="form-select"
                  value={generateForm.cityId}
                  onChange={(event) => setGenerateForm((current) => ({ ...current, cityId: event.target.value }))}
                >
                  <option value="">Выбери город</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Количество дней</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  max="14"
                  value={generateForm.daysCount}
                  onChange={(event) => setGenerateForm((current) => ({ ...current, daysCount: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Интересы</label>
                <input
                  className="form-control"
                  value={generateForm.interests}
                  onChange={(event) => setGenerateForm((current) => ({ ...current, interests: event.target.value }))}
                  placeholder="history,culture,food"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Уровень бюджета</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  max="4"
                  value={generateForm.budgetLevel}
                  onChange={(event) => setGenerateForm((current) => ({ ...current, budgetLevel: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Транспорт</label>
                <select
                  className="form-select"
                  value={generateForm.transportMode}
                  onChange={(event) => setGenerateForm((current) => ({ ...current, transportMode: event.target.value }))}
                >
                  {transportModes.map((modeOption) => (
                    <option key={modeOption} value={modeOption}>
                      {modeOption}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Оптимизировать</label>
                <select
                  className="form-select"
                  value={generateForm.optimize}
                  onChange={(event) => setGenerateForm((current) => ({ ...current, optimize: event.target.value }))}
                >
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Выполняю..." : "Сгенерировать маршрут"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>

        <div className="col-12 col-xl-6">
          <SectionCard
            title="Ручное создание маршрута"
            subtitle="Создаёт маршрут на 1 день с заданными POI ID через `POST /v1/routes`."
          >
            <form className="row g-3" onSubmit={handleCreate}>
              <div className="col-md-6">
                <label className="form-label">Название маршрута</label>
                <input
                  className="form-control"
                  value={manualForm.name}
                  onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Город</label>
                <select
                  className="form-select"
                  value={manualForm.cityId}
                  onChange={(event) => setManualForm((current) => ({ ...current, cityId: event.target.value }))}
                >
                  <option value="">Выбери город</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Описание</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={manualForm.description}
                  onChange={(event) => setManualForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Дата старта</label>
                <input
                  className="form-control"
                  type="datetime-local"
                  value={manualForm.startDate}
                  onChange={(event) => setManualForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Транспорт</label>
                <select
                  className="form-select"
                  value={manualForm.transportMode}
                  onChange={(event) => setManualForm((current) => ({ ...current, transportMode: event.target.value }))}
                >
                  {transportModes.map((modeOption) => (
                    <option key={modeOption} value={modeOption}>
                      {modeOption}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Статус</label>
                <select
                  className="form-select"
                  value={manualForm.status}
                  onChange={(event) => setManualForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="READY">READY</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Минут на одну точку</label>
                <input
                  className="form-control"
                  type="number"
                  min="5"
                  max="1440"
                  value={manualForm.estimatedVisitMinutes}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, estimatedVisitMinutes: event.target.value }))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Автооптимизация</label>
                <select
                  className="form-select"
                  value={manualForm.autoOptimize}
                  onChange={(event) => setManualForm((current) => ({ ...current, autoOptimize: event.target.value }))}
                >
                  <option value="false">Нет</option>
                  <option value="true">Да</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Режим оптимизации</label>
                <select
                  className="form-select"
                  value={manualForm.optimizationMode}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, optimizationMode: event.target.value }))
                  }
                >
                  {optimizationModes.map((modeOption) => (
                    <option key={modeOption} value={modeOption}>
                      {modeOption}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">POI ID через запятую</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={manualForm.poiIds}
                  onChange={(event) => setManualForm((current) => ({ ...current, poiIds: event.target.value }))}
                  placeholder="12, 18, 44"
                />
                <div className="form-text">
                  Backend требует минимум одну точку маршрута, поэтому сюда передаются ID существующих POI.
                </div>
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-outline-primary" disabled={saving}>
                  {saving ? "Создаю..." : "Создать маршрут"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Список маршрутов" subtitle="Живой список из route-service для текущей сессии.">
        {loading && <div className="text-secondary mb-3">Загружаю маршруты...</div>}

        <EntityTable
          columns={[
            { key: "name", label: "Название" },
            { key: "cityName", label: "Город" },
            { key: "status", label: "Статус", badge: true },
            { key: "transportMode", label: "Транспорт", badge: true },
            { key: "daysCount", label: "Дней" },
            { key: "totalPoints", label: "Точек" },
            { key: "updatedAt", label: "Обновлён" },
          ]}
          records={records}
          onEdit={() => {}}
          onDelete={() => {}}
          emptyLabel="Текущая сессия не вернула ни одного маршрута."
          renderActions={(record) => (
            <div className="d-inline-flex gap-2 flex-wrap justify-content-end">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleRouteAction("view", record)}>
                Открыть
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handleRouteAction("duplicate", record)}
              >
                Копировать
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={() => handleRouteAction("optimize", record)}
              >
                Оптимизировать
              </button>
              {record.isArchived ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => handleRouteAction("unarchive", record)}
                >
                  Из архива
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info"
                  onClick={() => handleRouteAction("archive", record)}
                >
                  В архив
                </button>
              )}
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleRouteAction("delete", record)}>
                Удалить
              </button>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard
        title="Выбранный маршрут"
        subtitle="Детали маршрута, редактирование метаданных и операции с точками маршрута."
      >
        {selectedRoute ? (
          <div className="d-flex flex-column gap-4">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <div className="fw-semibold fs-5">{selectedRoute.name}</div>
              <StatusBadge value={selectedRoute.status} />
              <StatusBadge value={selectedRoute.transportMode} />
            </div>

            <div className="row g-3">
              <div className="col-md-3">
                <div className="soft-list-item p-3 h-100">
                  <div className="section-title">Город</div>
                  <div>{selectedRoute.cityName || `#${selectedRoute.cityId}`}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="soft-list-item p-3 h-100">
                  <div className="section-title">Дистанция</div>
                  <div>{selectedRoute.distanceKm ?? "-"}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="soft-list-item p-3 h-100">
                  <div className="section-title">Длительность</div>
                  <div>{selectedRoute.durationMin ?? "-"}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="soft-list-item p-3 h-100">
                  <div className="section-title">Обновлён</div>
                  <div>{formatDateTime(selectedRoute.updatedAt)}</div>
                </div>
              </div>
            </div>

            {selectedRoute.description && (
              <div className="soft-list-item p-3">
                <div className="section-title">Описание</div>
                <div>{selectedRoute.description}</div>
              </div>
            )}

            <div className="row g-4">
              <div className="col-12 col-xl-6">
                <SectionCard title="Редактирование маршрута" subtitle="Базовые поля через `PUT /v1/routes/{id}`.">
                  <form className="row g-3" onSubmit={handleUpdateRoute}>
                    <div className="col-md-6">
                      <label className="form-label">Название</label>
                      <input
                        className="form-control"
                        value={editForm.name}
                        onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Транспорт</label>
                      <select
                        className="form-select"
                        value={editForm.transportMode}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, transportMode: event.target.value }))
                        }
                      >
                        {transportModes.map((modeOption) => (
                          <option key={modeOption} value={modeOption}>
                            {modeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Статус</label>
                      <select
                        className="form-select"
                        value={editForm.status}
                        onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                      >
                        {routeStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Режим оптимизации</label>
                      <select
                        className="form-select"
                        value={editForm.optimizationMode}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, optimizationMode: event.target.value }))
                        }
                      >
                        {optimizationModes.map((modeOption) => (
                          <option key={modeOption} value={modeOption}>
                            {modeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Начальная точка</label>
                      <input
                        className="form-control"
                        value={editForm.startPoint}
                        onChange={(event) => setEditForm((current) => ({ ...current, startPoint: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Конечная точка</label>
                      <input
                        className="form-control"
                        value={editForm.endPoint}
                        onChange={(event) => setEditForm((current) => ({ ...current, endPoint: event.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Описание</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        value={editForm.description}
                        onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Дата планирования</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={editForm.dayPlanningDate}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, dayPlanningDate: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "Сохраняю..." : "Сохранить маршрут"}
                      </button>
                    </div>
                  </form>
                </SectionCard>
              </div>

              <div className="col-12 col-xl-6">
                <SectionCard title="Управление точками" subtitle="Добавление, удаление и перестановка точек маршрута.">
                  <form className="row g-3 mb-4" onSubmit={handleAddPoint}>
                    <div className="col-md-4">
                      <label className="form-label">POI ID</label>
                      <input
                        className="form-control"
                        value={pointForm.poiId}
                        onChange={(event) => setPointForm((current) => ({ ...current, poiId: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Номер дня</label>
                      <input
                        className="form-control"
                        value={pointForm.dayNumber}
                        onChange={(event) => setPointForm((current) => ({ ...current, dayNumber: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Позиция</label>
                      <input
                        className="form-control"
                        value={pointForm.orderIndex}
                        onChange={(event) => setPointForm((current) => ({ ...current, orderIndex: event.target.value }))}
                        placeholder="опционально"
                      />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn btn-outline-primary" disabled={saving}>
                        {saving ? "Добавляю..." : "Добавить точку"}
                      </button>
                    </div>
                  </form>

                  <form className="row g-3" onSubmit={handleReorderPoints}>
                    <div className="col-md-4">
                      <label className="form-label">День маршрута</label>
                      <select
                        className="form-select"
                        value={reorderForm.dayId}
                        onChange={(event) => setReorderForm((current) => ({ ...current, dayId: event.target.value }))}
                      >
                        <option value="">Выбери день</option>
                        {(selectedRoute.routeDays || []).map((day) => (
                          <option key={day.id} value={day.id}>
                            День {day.dayNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-8">
                      <label className="form-label">Новый порядок ID точек маршрута</label>
                      <input
                        className="form-control"
                        value={reorderForm.routePointIds}
                        onChange={(event) =>
                          setReorderForm((current) => ({ ...current, routePointIds: event.target.value }))
                        }
                        placeholder="31, 28, 30"
                      />
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn btn-outline-secondary" disabled={saving}>
                        {saving ? "Сохраняю..." : "Сменить порядок точек"}
                      </button>
                    </div>
                  </form>
                </SectionCard>
              </div>
            </div>

            <div className="d-flex flex-column gap-3">
              {(selectedRoute.routeDays || []).map((day) => (
                <div key={day.id || day.dayNumber} className="soft-list-item p-3">
                  <div className="d-flex justify-content-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="fw-semibold">День {day.dayNumber}</div>
                      <div className="small text-secondary">{day.description || "Без описания"}</div>
                    </div>
                    <div className="small text-secondary">
                      {day.pointsCount ?? day.routePoints?.length ?? 0} точек
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {(day.routePoints || []).map((point) => (
                      <div key={point.id} className="border rounded-3 p-3 bg-white">
                        <div className="d-flex justify-content-between gap-3 flex-wrap">
                          <div>
                            <div className="fw-semibold">
                              {point.orderIndex}. {point.poiName || `POI #${point.poiId}`}
                            </div>
                            <div className="small text-secondary">
                              {point.poiType || "Тип не указан"} - {point.poiAddress || "Адрес не указан"}
                            </div>
                            <div className="small text-secondary">
                              Посещение: {point.estimatedVisitMinutes ?? "-"} мин
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemovePoint(point.id)}
                          >
                            Удалить точку
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-secondary">Выбери маршрут из таблицы, чтобы посмотреть детали и управлять его точками.</div>
        )}
      </SectionCard>
    </div>
  );
}

export default RoutesPage;
