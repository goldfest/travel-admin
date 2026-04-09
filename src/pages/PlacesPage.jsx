import { useEffect, useMemo, useState } from "react";
import EntityPage from "./EntityPage";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import EntityTable from "../components/ui/EntityTable";
import EntityModal from "../components/ui/EntityModal";
import { entityConfigs } from "../data/entityConfigs";
import { useAppSettings } from "../services/AppSettingsContext";
import {
  createPoi,
  deletePoi,
  getCityLookup,
  listAllPoiTypes,
  searchPois,
  unverifyPoi,
  updatePoi,
  verifyPoi,
} from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";

function PlacesPage() {
  const { settings } = useAppSettings();
  const isApiMode = settings.mode === "api";
  const [cities, setCities] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({
    cityId: "",
    searchQuery: "",
    verifiedOnly: "all",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const formFields = useMemo(
    () => [
      { key: "name", label: "Название", type: "text", required: true },
      { key: "slug", label: "Slug", type: "text", required: true },
      {
        key: "cityId",
        label: "Город",
        type: "select",
        options: cities.map((city) => ({ value: String(city.id), label: city.name })),
        required: true,
      },
      {
        key: "poiTypeId",
        label: "POI type",
        type: "select",
        options: poiTypes.map((type) => ({ value: String(type.id), label: `${type.name} (${type.code})` })),
        required: true,
      },
      { key: "latitude", label: "Latitude", type: "number", required: true },
      { key: "longitude", label: "Longitude", type: "number", required: true },
      { key: "address", label: "Адрес", type: "text" },
      { key: "description", label: "Описание", type: "textarea", rows: 4 },
      { key: "phone", label: "Телефон", type: "text" },
      { key: "siteUrl", label: "Сайт", type: "text" },
      { key: "priceLevel", label: "Price level", type: "number" },
      {
        key: "isVerified",
        label: "Verified",
        type: "select",
        options: ["true", "false"],
      },
      {
        key: "isClosed",
        label: "Closed",
        type: "select",
        options: ["false", "true"],
      },
    ],
    [cities, poiTypes],
  );

  const statCards = useMemo(
    () => [
      { label: "Текущий список", value: records.length, tone: "info", icon: "bi-signpost-2-fill" },
      {
        label: "Verified",
        value: records.filter((record) => record.verified === "Yes").length,
        tone: "success",
        icon: "bi-patch-check-fill",
      },
      {
        label: "Needs review",
        value: records.filter((record) => record.verified === "No").length,
        tone: "warning",
        icon: "bi-shield-exclamation",
      },
    ],
    [records],
  );

  useEffect(() => {
    if (!isApiMode) {
      return;
    }

    const bootstrap = async () => {
      setLoading(true);
      setError("");

      try {
        const [cityLookup, poiTypeList] = await Promise.all([getCityLookup(), listAllPoiTypes()]);
        setCities(cityLookup);
        setPoiTypes(poiTypeList);

        if (cityLookup.length > 0) {
          setFilters((current) => ({
            ...current,
            cityId: current.cityId || String(cityLookup[0].id),
          }));
        }
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить справочники.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [isApiMode]);

  useEffect(() => {
    if (!isApiMode || !filters.cityId) {
      return;
    }

    const loadPlaces = async () => {
      setLoading(true);
      setError("");

      try {
        const page = await searchPois({
          cityId: Number(filters.cityId),
          searchQuery: filters.searchQuery || null,
          verifiedOnly: filters.verifiedOnly === "all" ? false : filters.verifiedOnly === "true",
          excludeClosed: false,
          page: 0,
          size: 100,
          sortBy: "name",
          sortDirection: "ASC",
        });

        setRecords(
          page.items.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            cityId: String(item.cityId),
            poiTypeId: String(item.poiType?.id || ""),
            type: item.poiType?.name || item.poiType?.code || "—",
            verified: item.isVerified ? "Yes" : "No",
            closed: item.isClosed ? "Yes" : "No",
            address: item.address || "",
            description: item.description || "",
            phone: item.phone || "",
            siteUrl: item.siteUrl || "",
            latitude: item.latitude ?? "",
            longitude: item.longitude ?? "",
            priceLevel: item.priceLevel ?? "",
            updatedAt: formatDateTime(item.updatedAt),
            status: item.currentStatus || "—",
          })),
        );
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить POI.");
      } finally {
        setLoading(false);
      }
    };

    loadPlaces();
  }, [filters.cityId, filters.searchQuery, filters.verifiedOnly, isApiMode, reloadToken]);

  if (!isApiMode) {
    return <EntityPage config={entityConfigs.places} />;
  }

  const handleSave = async (payload) => {
    setSaving(true);
    setError("");

    try {
      if (payload.id) {
        await updatePoi(payload.id, {
          name: payload.name,
          slug: payload.slug,
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          address: payload.address,
          description: payload.description,
          phone: payload.phone,
          siteUrl: payload.siteUrl,
          priceLevel: payload.priceLevel === "" ? null : Number(payload.priceLevel),
          isVerified: payload.isVerified === "true",
          isClosed: payload.isClosed === "true",
          features: {},
        });
      } else {
        await createPoi({
          name: payload.name,
          slug: payload.slug,
          cityId: Number(payload.cityId),
          poiTypeId: Number(payload.poiTypeId),
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          address: payload.address,
          description: payload.description,
          phone: payload.phone,
          siteUrl: payload.siteUrl,
          priceLevel: payload.priceLevel === "" ? null : Number(payload.priceLevel),
          tags: [],
          features: {},
          hours: [],
          media: [],
          sources: [],
        });
      }

      setModalOpen(false);
      setEditingRecord(null);
      setReloadToken((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Не удалось сохранить POI.");
    } finally {
      setSaving(false);
    }
  };

  const runPoiAction = async (action, record) => {
    setError("");

    try {
      if (action === "verify") {
        await verifyPoi(record.id);
      }
      if (action === "unverify") {
        await unverifyPoi(record.id);
      }
      if (action === "delete") {
        await deletePoi(record.id);
      }

      setReloadToken((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить действие с POI.");
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        {statCards.map((card) => (
          <div className="col-12 col-md-4" key={card.label}>
            <StatCard {...card} />
          </div>
        ))}
      </div>

      <SectionCard
        title="POI catalog"
        subtitle="Для списка используется `POST /pois/search`, поэтому фильтр по городу обязателен."
        action={
          <button type="button" className="btn btn-primary" onClick={() => { setEditingRecord(null); setModalOpen(true); }}>
            Добавить POI
          </button>
        }
      >
        {error && <div className="alert alert-danger mb-3">{error}</div>}

        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label">Город</label>
            <select
              className="form-select"
              value={filters.cityId}
              onChange={(event) => setFilters((current) => ({ ...current, cityId: event.target.value }))}
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Search</label>
            <input
              className="form-control"
              value={filters.searchQuery}
              onChange={(event) => setFilters((current) => ({ ...current, searchQuery: event.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Verified filter</label>
            <select
              className="form-select"
              value={filters.verifiedOnly}
              onChange={(event) => setFilters((current) => ({ ...current, verifiedOnly: event.target.value }))}
            >
              <option value="all">Все</option>
              <option value="true">Только verified</option>
              <option value="false">Только unverified</option>
            </select>
          </div>
        </div>

        {loading && <div className="text-secondary mb-3">Загрузка...</div>}

        <EntityTable
          columns={[
            { key: "name", label: "Название" },
            { key: "type", label: "Тип" },
            { key: "verified", label: "Verified", badge: true },
            { key: "closed", label: "Closed", badge: true },
            { key: "status", label: "Status" },
            { key: "updatedAt", label: "Обновлено" },
          ]}
          records={records}
          onEdit={() => {}}
          onDelete={() => {}}
          renderActions={(record) => (
            <div className="d-inline-flex gap-2 flex-wrap justify-content-end">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setEditingRecord(record); setModalOpen(true); }}>
                Edit
              </button>
              {record.verified === "Yes" ? (
                <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => runPoiAction("unverify", record)}>
                  Unverify
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runPoiAction("verify", record)}>
                  Verify
                </button>
              )}
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => runPoiAction("delete", record)}>
                Delete
              </button>
            </div>
          )}
          emptyLabel="Список POI пуст для выбранного города и фильтра."
        />
      </SectionCard>

      <EntityModal
        isOpen={modalOpen}
        title={editingRecord ? "Изменить POI" : "Создать POI"}
        fields={formFields}
        initialRecord={
          editingRecord || {
            cityId: filters.cityId || "",
            poiTypeId: poiTypes[0]?.id ? String(poiTypes[0].id) : "",
            isVerified: "false",
            isClosed: "false",
          }
        }
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      />

      {saving && <div className="text-secondary">Сохранение...</div>}
    </div>
  );
}

export default PlacesPage;
