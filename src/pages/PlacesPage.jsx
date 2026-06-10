import { useEffect, useMemo, useState } from "react";
import EntityPage from "./EntityPage";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import EntityTable from "../components/ui/EntityTable";
import PaginationControls from "../components/ui/PaginationControls";
import PoiFormModal from "../components/poi/PoiFormModal";
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

function parseJsonSafe(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractTags(item) {
  const tags = parseJsonSafe(item.tags, item.tags);
  if (Array.isArray(tags)) {
    return tags;
  }
  return [];
}

function mapPoiToRecord(item) {
  const media = Array.isArray(item.media) ? item.media : [];
  const tags = extractTags(item);
  const features = item.features || {};
  const hours = Array.isArray(item.hours) ? item.hours : [];
  const sources = Array.isArray(item.sources) ? item.sources : [];

  return {
    id: item.id,
    name: item.name || "",
    slug: item.slug || "",
    cityId: String(item.cityId ?? ""),
    poiTypeId: String(item.poiType?.id || ""),
    type: item.poiType?.name || item.poiType?.code || "—",
    typeCode: item.poiType?.code || "",
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
    tags,
    tagsText: tags.join("\n"),
    features,
    featuresObject: features,
    hours,
    sources,
    sourceLabel: sources[0]?.sourceCode || "—",
    mediaUrlsText: media
      .filter((mediaItem) => mediaItem.url && /^https?:\/\//i.test(mediaItem.url))
      .map((mediaItem) => mediaItem.url)
      .join("\n"),
  };
}

function basePayload(payload) {
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
    tags: payload.tags || [],
    features: payload.features || {},
    hours: payload.hours || [],
  };
}

function buildCreatePayload(payload) {
  return {
    ...basePayload(payload),
    cityId: Number(payload.cityId),
    media: (payload.mediaUrls || []).map((url) => ({ url, mediaType: "IMAGE" })),
    sources: payload.sources || [],
  };
}

function buildUpdatePayload(payload) {
  return {
    ...basePayload(payload),
    isVerified: payload.isVerified === "true",
    isClosed: payload.isClosed === "true",
  };
}

function buildPoiSearchPayload(filters, pagination) {
  const selectedTypeIds = filters.poiTypeId ? [Number(filters.poiTypeId)] : undefined;
  return {
    cityId: Number(filters.cityId),
    searchQuery: filters.searchQuery || null,
    poiTypeIds: selectedTypeIds,
    minPrice: filters.minPrice === "" ? null : Number(filters.minPrice),
    maxPrice: filters.maxPrice === "" ? null : Number(filters.maxPrice),
    verifiedOnly: filters.verifiedOnly === "all" ? false : filters.verifiedOnly === "true",
    excludeClosed: filters.closedFilter === "open",
    page: pagination.page + 1,
    size: pagination.size,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
  };
}

function PlacesPage() {
  const { settings } = useAppSettings();
  const isApiMode = settings.mode === "api";
  const [cities, setCities] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({
    cityId: "",
    searchQuery: "",
    poiTypeId: "",
    verifiedOnly: "all",
    closedFilter: "all",
    minPrice: "",
    maxPrice: "",
    sortBy: "name",
    sortDirection: "ASC",
  });
  const [pagination, setPagination] = useState({ page: 0, size: 20, totalPages: 1, totalElements: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const statCards = useMemo(
    () => [
      { label: "Всего по фильтру", value: pagination.totalElements, tone: "info", icon: "bi-signpost-2-fill" },
      { label: "На странице", value: records.length, tone: "success", icon: "bi-table" },
      { label: "Needs review", value: records.filter((record) => record.verified === "No").length, tone: "warning", icon: "bi-shield-exclamation" },
    ],
    [pagination.totalElements, records],
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
        const page = await searchPois(buildPoiSearchPayload(filters, pagination));
        const mapped = page.items.map(mapPoiToRecord);
        setRecords(mapped);
        setPagination((current) => ({
          ...current,
          totalPages: page.totalPages,
          totalElements: page.totalElements,
        }));
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить POI.");
      } finally {
        setLoading(false);
      }
    };

    loadPlaces();
  }, [filters, isApiMode, pagination.page, pagination.size, reloadToken]);

  if (!isApiMode) {
    return <EntityPage config={entityConfigs.places} />;
  }

  const resetToFirstPage = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPagination((current) => ({ ...current, page: 0 }));
  };

  const handleEdit = async (record) => {
    setError("");
    setNotice("");
    try {
      const fullPoi = await getPoi(record.id);
      setEditingRecord(mapPoiToRecord(fullPoi));
      setModalOpen(true);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить POI для редактирования.");
    }
  };

  const handleSave = async (payload, adminFiles = []) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      let savedPoi;
      if (payload.id) {
        savedPoi = await updatePoi(payload.id, buildUpdatePayload(payload));
      } else {
        savedPoi = await createPoi(buildCreatePayload(payload));
      }

      if (adminFiles.length > 0) {
        await uploadAdminPoiMedia(savedPoi.id || payload.id, adminFiles);
      }

      setModalOpen(false);
      setEditingRecord(null);
      setNotice("POI сохранён." + (adminFiles.length ? " Фото администратора загружены." : ""));
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
      if (action === "delete") {
        if (!window.confirm(`Удалить POI "${record.name}"?`)) return;
        await deletePoi(record.id);
      }
      setReloadToken((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить действие с POI.");
    }
  };

  const clearFilters = () => {
    resetToFirstPage({
      searchQuery: "",
      poiTypeId: "",
      verifiedOnly: "all",
      closedFilter: "all",
      minPrice: "",
      maxPrice: "",
      sortBy: "name",
      sortDirection: "ASC",
    });
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
        subtitle="Список, фильтрация, создание и редактирование POI. Features, Hours, Media и Sources вынесены в удобные поля без ручного JSON."
        action={<button type="button" className="btn btn-primary" onClick={() => { setEditingRecord(null); setModalOpen(true); }}>Добавить POI</button>}
      >
        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {notice && <div className="alert alert-success mb-3">{notice}</div>}

        <div className="surface-subcard p-3 mb-4">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Город</label>
              <select className="form-select" value={filters.cityId} onChange={(event) => resetToFirstPage({ cityId: event.target.value })}>
                {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Поиск</label>
              <input className="form-control" placeholder="Название, адрес, описание" value={filters.searchQuery} onChange={(event) => resetToFirstPage({ searchQuery: event.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Тип POI</label>
              <select className="form-select" value={filters.poiTypeId} onChange={(event) => resetToFirstPage({ poiTypeId: event.target.value })}>
                <option value="">Все типы</option>
                {poiTypes.map((type) => <option key={type.id} value={type.id}>{type.name} ({type.code})</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Верификация</label>
              <select className="form-select" value={filters.verifiedOnly} onChange={(event) => resetToFirstPage({ verifiedOnly: event.target.value })}>
                <option value="all">Все</option>
                <option value="true">Только verified</option>
                <option value="false">Только unverified</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Закрытые объекты</label>
              <select className="form-select" value={filters.closedFilter} onChange={(event) => resetToFirstPage({ closedFilter: event.target.value })}>
                <option value="all">Показывать все</option>
                <option value="open">Скрыть закрытые</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Цена от</label>
              <input className="form-control" type="number" min="0" max="4" value={filters.minPrice} onChange={(event) => resetToFirstPage({ minPrice: event.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Цена до</label>
              <input className="form-control" type="number" min="0" max="4" value={filters.maxPrice} onChange={(event) => resetToFirstPage({ maxPrice: event.target.value })} />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-outline-secondary w-100" onClick={clearFilters}>Сбросить</button>
            </div>
            <div className="col-md-4">
              <label className="form-label">Сортировка</label>
              <select className="form-select" value={filters.sortBy} onChange={(event) => resetToFirstPage({ sortBy: event.target.value })}>
                <option value="name">По названию</option>
                <option value="priceLevel">По цене</option>
                <option value="updatedAt">По обновлению</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Направление</label>
              <select className="form-select" value={filters.sortDirection} onChange={(event) => resetToFirstPage({ sortDirection: event.target.value })}>
                <option value="ASC">По возрастанию</option>
                <option value="DESC">По убыванию</option>
              </select>
            </div>
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
            { key: "sourceLabel", label: "Источник" },
            { key: "updatedAt", label: "Обновлено" },
          ]}
          records={records}
          onEdit={() => {}}
          onDelete={() => {}}
          renderActions={(record) => (
            <div className="d-inline-flex gap-2 flex-wrap justify-content-end">
              <button type="button" className="btn btn-sm btn-outline-primary btn-icon" onClick={() => handleEdit(record)} title="Редактировать">
                <i className="bi bi-pencil-square" />
              </button>
              {record.verified === "Yes" ? (
                <button type="button" className="btn btn-sm btn-outline-warning btn-icon" onClick={() => runPoiAction("unverify", record)} title="Снять верификацию">
                  <i className="bi bi-patch-minus" />
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-success btn-icon" onClick={() => runPoiAction("verify", record)} title="Верифицировать">
                  <i className="bi bi-patch-check" />
                </button>
              )}
              <button type="button" className="btn btn-sm btn-outline-danger btn-icon" onClick={() => runPoiAction("delete", record)} title="Удалить">
                <i className="bi bi-trash3" />
              </button>
            </div>
          )}
          emptyLabel="Список POI пуст для выбранного города и фильтра."
        />

        <PaginationControls
          page={pagination.page}
          size={pagination.size}
          totalPages={pagination.totalPages}
          totalElements={pagination.totalElements}
          onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
          onSizeChange={(size) => setPagination((current) => ({ ...current, page: 0, size }))}
        />
      </SectionCard>

      <PoiFormModal
        isOpen={modalOpen}
        title={editingRecord ? "Изменить POI" : "Создать POI"}
        initialRecord={editingRecord}
        initialCityId={filters.cityId || ""}
        cities={cities}
        poiTypes={poiTypes}
        saving={saving}
        getMediaUrl={getPoiMediaUrl}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      />
    </div>
  );
}

export default PlacesPage;
