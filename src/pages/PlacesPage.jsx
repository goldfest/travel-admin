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
  getPoi,
  getPoiMediaUrl,
  listAllPoiTypes,
  searchPois,
  unverifyPoi,
  updatePoi,
  uploadAdminPoiMedia,
  verifyPoi,
} from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";

function stringifyJson(value, fallback = "") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function parseJson(value, fallback) {
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapPoiToRecord(item) {
  const media = Array.isArray(item.media) ? item.media : [];
  return {
    id: item.id,
    name: item.name || "",
    slug: item.slug || "",
    cityId: String(item.cityId ?? ""),
    poiTypeId: String(item.poiType?.id || ""),
    type: item.poiType?.name || item.poiType?.code || "—",
    verified: item.isVerified ? "Yes" : "No",
    closed: item.isClosed ? "Yes" : "No",
    isVerified: String(Boolean(item.isVerified)),
    isClosed: String(Boolean(item.isClosed)),
    address: item.address || "",
    description: item.description || "",
    phone: item.phone || "",
    siteUrl: item.siteUrl || "",
    latitude: item.latitude ?? "",
    longitude: item.longitude ?? "",
    priceLevel: item.priceLevel ?? "",
    updatedAt: formatDateTime(item.updatedAt),
    status: item.currentStatus || "—",
    media,
    mediaCount: media.length,
    tagsText: Array.isArray(item.tags) ? item.tags.join("\n") : stringifyJson(item.tags),
    featuresJson: stringifyJson(item.features || {}, "{}"),
    hoursJson: stringifyJson(item.hours || [], "[]"),
    sourcesJson: stringifyJson(item.sources || [], "[]"),
    mediaUrlsText: media.map((mediaItem) => mediaItem.url).filter(Boolean).join("\n"),
  };
}

function buildCreatePayload(payload) {
  return {
    name: payload.name,
    slug: payload.slug,
    cityId: Number(payload.cityId),
    poiTypeId: Number(payload.poiTypeId),
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    address: payload.address || null,
    description: payload.description || null,
    phone: payload.phone || null,
    siteUrl: payload.siteUrl || null,
    priceLevel: payload.priceLevel === "" ? null : Number(payload.priceLevel),
    tags: parseLines(payload.tagsText),
    features: parseJson(payload.featuresJson, {}),
    hours: parseJson(payload.hoursJson, []),
    media: parseLines(payload.mediaUrlsText).map((url) => ({ url, mediaType: "IMAGE" })),
    sources: parseJson(payload.sourcesJson, []),
  };
}

function buildUpdatePayload(payload) {
  return {
    name: payload.name,
    slug: payload.slug,
    poiTypeId: Number(payload.poiTypeId),
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    address: payload.address || null,
    description: payload.description || null,
    phone: payload.phone || null,
    siteUrl: payload.siteUrl || null,
    priceLevel: payload.priceLevel === "" ? null : Number(payload.priceLevel),
    isVerified: payload.isVerified === "true",
    isClosed: payload.isClosed === "true",
    tags: parseLines(payload.tagsText),
    features: parseJson(payload.featuresJson, {}),
    hours: parseJson(payload.hoursJson, []),
  };
}

function PlacesPage() {
  const { settings } = useAppSettings();
  const isApiMode = settings.mode === "api";
  const [cities, setCities] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ cityId: "", searchQuery: "", verifiedOnly: "all" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [adminFiles, setAdminFiles] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);

  const selectedRecord = records.find((record) => Number(record.id) === Number(selectedRecordId)) || records[0] || null;

  const formFields = useMemo(
    () => [
      { key: "name", label: "Название", type: "text", required: true },
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "cityId", label: "Город", type: "select", options: cities.map((city) => ({ value: String(city.id), label: city.name })), required: true },
      { key: "poiTypeId", label: "POI type", type: "select", options: poiTypes.map((type) => ({ value: String(type.id), label: `${type.name} (${type.code})` })), required: true },
      { key: "latitude", label: "Latitude", type: "number", required: true },
      { key: "longitude", label: "Longitude", type: "number", required: true },
      { key: "address", label: "Адрес", type: "text" },
      { key: "description", label: "Описание", type: "textarea", rows: 4 },
      { key: "phone", label: "Телефон", type: "text" },
      { key: "siteUrl", label: "Сайт", type: "text" },
      { key: "priceLevel", label: "Price level", type: "number" },
      { key: "isVerified", label: "Verified", type: "select", options: ["true", "false"] },
      { key: "isClosed", label: "Closed", type: "select", options: ["false", "true"] },
      { key: "tagsText", label: "Теги", type: "textarea", rows: 3 },
      { key: "featuresJson", label: "Features JSON", type: "textarea", rows: 4 },
      { key: "hoursJson", label: "Hours JSON", type: "textarea", rows: 4 },
      { key: "mediaUrlsText", label: "Внешние media URL", type: "textarea", rows: 3 },
      { key: "sourcesJson", label: "Sources JSON", type: "textarea", rows: 4 },
    ],
    [cities, poiTypes],
  );

  const statCards = useMemo(
    () => [
      { label: "Текущий список", value: records.length, tone: "info", icon: "bi-signpost-2-fill" },
      { label: "Verified", value: records.filter((record) => record.verified === "Yes").length, tone: "success", icon: "bi-patch-check-fill" },
      { label: "Needs review", value: records.filter((record) => record.verified === "No").length, tone: "warning", icon: "bi-shield-exclamation" },
    ],
    [records],
  );

  useEffect(() => {
    if (!isApiMode) return;

    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const [cityLookup, poiTypeList] = await Promise.all([getCityLookup(), listAllPoiTypes()]);
        setCities(cityLookup);
        setPoiTypes(poiTypeList);
        if (cityLookup.length > 0) {
          setFilters((current) => ({ ...current, cityId: current.cityId || String(cityLookup[0].id) }));
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
    if (!isApiMode || !filters.cityId) return;

    const loadPlaces = async () => {
      setLoading(true);
      setError("");
      try {
        const page = await searchPois({
          cityId: Number(filters.cityId),
          searchQuery: filters.searchQuery || null,
          verifiedOnly: filters.verifiedOnly === "all" ? false : filters.verifiedOnly === "true",
          excludeClosed: false,
          page: 1,
          size: 100,
          sortBy: "name",
          sortDirection: "ASC",
        });
        const mapped = page.items.map(mapPoiToRecord);
        setRecords(mapped);
        setSelectedRecordId((current) => current || mapped[0]?.id || null);
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

  const handleEdit = async (record) => {
    setError("");
    try {
      const fullPoi = await getPoi(record.id);
      setEditingRecord(mapPoiToRecord(fullPoi));
      setModalOpen(true);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить POI для редактирования.");
    }
  };

  const handleSave = async (payload) => {
    setSaving(true);
    setError("");
    try {
      if (payload.id) {
        await updatePoi(payload.id, buildUpdatePayload(payload));
      } else {
        await createPoi(buildCreatePayload(payload));
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
    setNotice("");
    try {
      if (action === "verify") await verifyPoi(record.id);
      if (action === "unverify") await unverifyPoi(record.id);
      if (action === "delete") await deletePoi(record.id);
      setReloadToken((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить действие с POI.");
    }
  };

  const handleUploadAdminMedia = async () => {
    if (!selectedRecord || adminFiles.length === 0) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await uploadAdminPoiMedia(selectedRecord.id, adminFiles);
      setNotice(`Фото администратора загружены для POI #${selectedRecord.id}.`);
      setAdminFiles([]);
      setReloadToken((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить фотографии.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        {statCards.map((card) => (
          <div className="col-12 col-md-4" key={card.label}><StatCard {...card} /></div>
        ))}
      </div>

      <SectionCard
        title="POI catalog"
        subtitle="Список, создание и редактирование POI через poi-service. Фото администратора загружаются отдельным multipart endpoint."
        action={<button type="button" className="btn btn-primary" onClick={() => { setEditingRecord(null); setModalOpen(true); }}>Добавить POI</button>}
      >
        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {notice && <div className="alert alert-success mb-3">{notice}</div>}

        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label">Город</label>
            <select className="form-select" value={filters.cityId} onChange={(event) => setFilters((current) => ({ ...current, cityId: event.target.value }))}>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Search</label>
            <input className="form-control" value={filters.searchQuery} onChange={(event) => setFilters((current) => ({ ...current, searchQuery: event.target.value }))} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Verified filter</label>
            <select className="form-select" value={filters.verifiedOnly} onChange={(event) => setFilters((current) => ({ ...current, verifiedOnly: event.target.value }))}>
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
            { key: "mediaCount", label: "Фото" },
            { key: "updatedAt", label: "Обновлено" },
          ]}
          records={records}
          onEdit={() => {}}
          onDelete={() => {}}
          renderActions={(record) => (
            <div className="d-inline-flex gap-2 flex-wrap justify-content-end">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedRecordId(record.id)}>Media</button>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(record)}>Edit</button>
              {record.verified === "Yes" ? (
                <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => runPoiAction("unverify", record)}>Unverify</button>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runPoiAction("verify", record)}>Verify</button>
              )}
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => runPoiAction("delete", record)}>Delete</button>
            </div>
          )}
          emptyLabel="Список POI пуст для выбранного города и фильтра."
        />
      </SectionCard>

      <SectionCard title="Фотографии выбранного POI" subtitle="Админские фотографии сразу получают статус APPROVED и отображаются первыми в карточке объекта.">
        {selectedRecord ? (
          <div className="row g-4">
            <div className="col-12 col-xl-5">
              <div className="fw-semibold mb-2">{selectedRecord.name}</div>
              <div className="text-secondary small mb-3">POI #{selectedRecord.id} • {selectedRecord.address || "адрес не указан"}</div>
              <input className="form-control mb-3" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => setAdminFiles(Array.from(event.target.files || []))} />
              <button type="button" className="btn btn-outline-primary" disabled={!adminFiles.length || saving} onClick={handleUploadAdminMedia}>
                Загрузить фото администратора
              </button>
            </div>
            <div className="col-12 col-xl-7">
              <div className="media-grid">
                {(selectedRecord.media || []).length > 0 ? selectedRecord.media.map((media) => (
                  <a key={media.id || media.url} href={getPoiMediaUrl(media.url)} target="_blank" rel="noreferrer" className="media-thumb">
                    <img src={getPoiMediaUrl(media.url)} alt={media.originalFilename || media.mediaType || "POI media"} />
                    <span>{media.sourceType || media.mediaType || "media"}</span>
                  </a>
                )) : <div className="text-secondary">У объекта пока нет фотографий.</div>}
              </div>
            </div>
          </div>
        ) : <div className="text-secondary">Выбери POI из таблицы.</div>}
      </SectionCard>

      <EntityModal
        isOpen={modalOpen}
        title={editingRecord ? "Изменить POI" : "Создать POI"}
        fields={formFields}
        initialRecord={editingRecord || {
          cityId: filters.cityId || "",
          poiTypeId: poiTypes[0]?.id ? String(poiTypes[0].id) : "",
          isVerified: "false",
          isClosed: "false",
          tagsText: "",
          featuresJson: "{}",
          hoursJson: "[]",
          mediaUrlsText: "",
          sourcesJson: "[]",
        }}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      />

      {saving && <div className="text-secondary">Сохранение...</div>}
    </div>
  );
}

export default PlacesPage;
