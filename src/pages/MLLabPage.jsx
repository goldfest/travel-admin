import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useAppSettings } from "../services/AppSettingsContext";
import {
  createPoi,
  getCityLookup,
  listAllPoiTypes,
  listImportTasks,
  startImportTask,
} from "../services/adminApi";
import { enrichRawPoi, getMlHealth, getMlModelInfo, importFromSource } from "../services/mlService";

const initialImportForm = {
  source_code: "WIKIPEDIA",
  source_url: "https://ru.wikipedia.org/wiki/Ленинский_мемориал",
  city_id: 10,
  language: "ru",
  poi_type_hint: "landmark",
};

const initialRawForm = {
  city_id: 10,
  language: "ru",
  poi_type_hint: "landmark",
  name: "Тестовый объект",
  description: "Исторический объект с описанием для проверки ML-обогащения.",
  address: "Ульяновск, тестовый адрес",
  latitude: "54.3142",
  longitude: "48.4031",
  phone: "+79991112233",
  site_url: "https://example.com/test-poi",
  price_level: "0",
  poi_type_code: "landmark",
  source_code: "MANUAL",
  source_url: "https://example.com/test-poi",
};

function normalizeWikiUrl(value) {
  const text = String(value || "").trim();
  if (!text) return text;
  if (/^https?:\/\//i.test(text)) return text;
  const title = encodeURIComponent(text.replace(/\s+/g, "_"));
  return `https://ru.wikipedia.org/wiki/${title}`;
}

function toBackendMediaType(value) {
  const normalized = String(value || "IMAGE").toUpperCase();
  return ["IMAGE", "PHOTO", "COVER", "MENU", "VIDEO"].includes(normalized) ? normalized : "IMAGE";
}

function mapMlDraftToPoiPayload(result, poiTypeId) {
  const draft = result?.poi_draft;
  if (!draft) {
    throw new Error("В ответе ML нет poi_draft.");
  }
  if (!poiTypeId) {
    throw new Error(`Не найден POI type для кода "${draft.poi_type_code}". Проверь справочник типов POI.`);
  }
  if (!draft.latitude || !draft.longitude) {
    throw new Error("ML draft не содержит координаты. Такой объект нельзя создать как POI.");
  }

  return {
    name: draft.name,
    slug: draft.slug,
    cityId: Number(draft.city_id),
    poiTypeId: Number(poiTypeId),
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
    address: draft.address || null,
    description: draft.description || null,
    phone: draft.phone || null,
    siteUrl: draft.site_url || null,
    priceLevel: draft.price_level ?? 0,
    tags: draft.tags || [],
    features: draft.features || {},
    hours: (draft.hours || []).map((hour) => ({
      dayOfWeek: hour.day_of_week,
      openTime: hour.open_time,
      closeTime: hour.close_time,
      aroundTheClock: Boolean(hour.around_the_clock),
    })),
    media: (draft.media || [])
      .filter((media) => media.url)
      .map((media) => ({ url: media.url, mediaType: toBackendMediaType(media.media_type) })),
    sources: (draft.sources || []).map((source) => ({
      sourceCode: source.source_code,
      sourceUrl: source.source_url,
      externalId: source.external_id,
      confidenceScore: source.confidence_score,
    })),
  };
}

function MLLabPage() {
  const { settings } = useAppSettings();
  const [cities, setCities] = useState([]);
  const [poiTypes, setPoiTypes] = useState([]);
  const [health, setHealth] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [importTasks, setImportTasks] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importForm, setImportForm] = useState(initialImportForm);
  const [rawForm, setRawForm] = useState(initialRawForm);
  const [loadingKey, setLoadingKey] = useState("");
  const [taskForm, setTaskForm] = useState({ sourceCode: "wiki", query: "Ленинский мемориал", cityId: 10 });

  const poiTypeByCode = useMemo(() => new Map(poiTypes.map((type) => [String(type.code).toLowerCase(), type])), [poiTypes]);

  const runRequest = async (key, action) => {
    setLoadingKey(key);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (requestError) {
      setError(requestError.message || "Request failed.");
    } finally {
      setLoadingKey("");
    }
  };

  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        const [cityLookup, poiTypeList] = await Promise.all([getCityLookup(), listAllPoiTypes()]);
        setCities(cityLookup);
        setPoiTypes(poiTypeList);
        if (cityLookup[0]?.id) {
          setImportForm((current) => ({ ...current, city_id: current.city_id || cityLookup[0].id }));
          setRawForm((current) => ({ ...current, city_id: current.city_id || cityLookup[0].id }));
          setTaskForm((current) => ({ ...current, cityId: current.cityId || cityLookup[0].id }));
        }
      } catch {
        // Forms also work with manual IDs.
      }
    };

    if (settings.mode === "api") {
      loadDictionaries();
    }
  }, [settings.mode]);

  const fetchImportTasks = async () => {
    const page = await listImportTasks({ page: 0, size: 20 });
    setImportTasks(page.items);
  };

  const handleCreatePoiFromMl = async () => {
    await runRequest("create-poi", async () => {
      const draftTypeCode = String(result?.poi_draft?.poi_type_code || "").toLowerCase();
      const poiType = poiTypeByCode.get(draftTypeCode) || poiTypeByCode.get("landmark");
      const payload = mapMlDraftToPoiPayload(result, poiType?.id);
      const created = await createPoi(payload);
      setNotice(`POI создан: #${created.id} ${created.name}. Если ML рекомендовал PENDING_REVIEW, объект можно проверить в разделе Модерация.`);
    });
  };

  return (
    <div className="d-flex flex-column gap-4">
      <SectionCard title="Состояние ML worker" subtitle="Прямые проверки worker-сервиса: /health и /api/v1/model/info." action={<div className="text-secondary small text-break">Базовый URL: <strong>{settings.services.ml}</strong></div>}>
        <div className="d-flex flex-wrap gap-2 mb-4">
          <button type="button" className="btn btn-outline-primary" onClick={() => runRequest("health", async () => setHealth(await getMlHealth()))}>{loadingKey === "health" ? "Проверяю..." : "Проверить health"}</button>
          <button type="button" className="btn btn-outline-primary" onClick={() => runRequest("model", async () => setModelInfo(await getMlModelInfo()))}>{loadingKey === "model" ? "Загружаю..." : "Загрузить данные модели"}</button>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        <div className="row g-3">
          <div className="col-md-6"><div className="soft-list-item p-3 h-100"><div className="fw-semibold mb-2">Health</div>{health ? <><StatusBadge value={health.status} /><div className="text-secondary small mt-2">{health.service} • версия {health.version}</div></> : <div className="text-secondary small">Проверка ещё не выполнялась.</div>}</div></div>
          <div className="col-md-6"><div className="soft-list-item p-3 h-100"><div className="fw-semibold mb-2">Модель</div>{modelInfo ? <div className="d-flex flex-column gap-2"><div>{modelInfo.model_name}</div><div className="small text-secondary">loaded: {String(modelInfo.is_loaded)} • fallback: {String(modelInfo.fallback_enabled)}</div></div> : <div className="text-secondary small">Метаданные ещё не загружены.</div>}</div></div>
        </div>
      </SectionCard>

      <SectionCard title="Backend-импорт POI" subtitle="Рекомендуемый режим: poi-service сам вызывает 2GIS или Wikipedia и сохраняет результат в БД." action={<button type="button" className="btn btn-outline-primary" onClick={() => runRequest("tasks", fetchImportTasks)}>{loadingKey === "tasks" ? "Обновляю..." : "Обновить задачи"}</button>}>
        <form className="row g-3 mb-4" onSubmit={(event) => { event.preventDefault(); runRequest("import-task", async () => { await startImportTask({ sourceCode: taskForm.sourceCode, query: taskForm.query, cityId: Number(taskForm.cityId) }); await fetchImportTasks(); }); }}>
          <div className="col-md-4"><label className="form-label">Источник</label><select className="form-select" value={taskForm.sourceCode} onChange={(event) => setTaskForm((current) => ({ ...current, sourceCode: event.target.value }))}><option value="2gis">2GIS</option><option value="wiki">Wikipedia</option><option value="wikipedia">Wikipedia alias</option></select></div>
          <div className="col-md-4"><label className="form-label">Запрос / статья</label><input className="form-control" value={taskForm.query} onChange={(event) => setTaskForm((current) => ({ ...current, query: event.target.value }))} placeholder="Например: кафе, музеи, Ленинский мемориал" /></div>
          <div className="col-md-4"><label className="form-label">Город</label><select className="form-select" value={taskForm.cityId} onChange={(event) => setTaskForm((current) => ({ ...current, cityId: event.target.value }))}>{cities.length > 0 ? cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>) : <option value={taskForm.cityId}>{taskForm.cityId}</option>}</select></div>
          <div className="col-12"><button type="submit" className="btn btn-primary">{loadingKey === "import-task" ? "Запускаю..." : "Запустить backend-импорт"}</button></div>
        </form>
        <div className="d-flex flex-column gap-3">
          {importTasks.length > 0 ? importTasks.map((task) => <div key={task.id} className="soft-list-item p-3"><div className="d-flex justify-content-between gap-3 flex-wrap"><div><div className="fw-semibold">#{task.id} • {task.sourceCode} • {task.query}</div><div className="text-secondary small">cityId: {task.cityId} • найдено: {task.totalPoiFound ?? 0} • создано: {task.totalPoiCreated ?? 0} • обновлено: {task.totalPoiUpdated ?? 0} • отклонено: {task.totalPoiRejected ?? 0}</div>{task.errorMessage && <div className="text-danger small mt-1">{task.errorMessage}</div>}</div><StatusBadge value={task.status || "PENDING"} /></div></div>) : <div className="text-secondary">Задачи импорта ещё не загружены.</div>}
        </div>
      </SectionCard>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <SectionCard title="Прямой импорт из Wikipedia в ML" subtitle="Для 2GIS прямой import-from-source в ML не используется: 2GIS обрабатывается через backend-импорт.">
            <form className="row g-3" onSubmit={(event) => { event.preventDefault(); runRequest("import", async () => { const sourceUrl = importForm.source_code === "WIKIPEDIA" ? normalizeWikiUrl(importForm.source_url) : importForm.source_url; const response = await importFromSource({ ...importForm, source_url: sourceUrl, city_id: Number(importForm.city_id) }); setResult(response); }); }}>
              <div className="col-md-6"><label className="form-label">Источник</label><select className="form-select" value={importForm.source_code} onChange={(event) => setImportForm((current) => ({ ...current, source_code: event.target.value }))}><option value="WIKIPEDIA">WIKIPEDIA</option><option value="TWO_GIS" disabled>TWO_GIS не поддержан напрямую</option></select></div>
              <div className="col-md-6"><label className="form-label">Город</label><select className="form-select" value={importForm.city_id} onChange={(event) => setImportForm((current) => ({ ...current, city_id: event.target.value }))}>{cities.length > 0 ? cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>) : <option value={importForm.city_id}>{importForm.city_id}</option>}</select></div>
              <div className="col-12"><label className="form-label">URL или название статьи Wikipedia</label><input className="form-control" value={importForm.source_url} onChange={(event) => setImportForm((current) => ({ ...current, source_url: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Язык</label><input className="form-control" value={importForm.language} onChange={(event) => setImportForm((current) => ({ ...current, language: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Тип POI</label><input className="form-control" value={importForm.poi_type_hint} onChange={(event) => setImportForm((current) => ({ ...current, poi_type_hint: event.target.value }))} /></div>
              <div className="col-12"><button type="submit" className="btn btn-primary">{loadingKey === "import" ? "Выполняю..." : "Запустить ML import"}</button></div>
            </form>
          </SectionCard>
        </div>

        <div className="col-12 col-xl-6">
          <SectionCard title="Обогащение raw POI" subtitle="Прямой вызов /api/v1/poi/enrich-raw с ручными данными.">
            <form className="row g-3" onSubmit={(event) => { event.preventDefault(); runRequest("enrich", async () => { const response = await enrichRawPoi({ city_id: Number(rawForm.city_id), language: rawForm.language, poi_type_hint: rawForm.poi_type_hint, raw_poi: { name: rawForm.name, description: rawForm.description, address: rawForm.address, latitude: Number(rawForm.latitude), longitude: Number(rawForm.longitude), phone: rawForm.phone, site_url: rawForm.site_url, price_level: Number(rawForm.price_level), poi_type_code: rawForm.poi_type_code, features: {}, hours: [], media: [], source: { source_code: rawForm.source_code, source_url: rawForm.source_url, external_id: null } } }); setResult(response); }); }}>
              <div className="col-md-6"><label className="form-label">Название</label><input className="form-control" value={rawForm.name} onChange={(event) => setRawForm((current) => ({ ...current, name: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Код типа</label><input className="form-control" value={rawForm.poi_type_code} onChange={(event) => setRawForm((current) => ({ ...current, poi_type_code: event.target.value, poi_type_hint: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Город</label><select className="form-select" value={rawForm.city_id} onChange={(event) => setRawForm((current) => ({ ...current, city_id: event.target.value }))}>{cities.length > 0 ? cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>) : <option value={rawForm.city_id}>{rawForm.city_id}</option>}</select></div>
              <div className="col-md-6"><label className="form-label">Уровень цены</label><input className="form-control" value={rawForm.price_level} onChange={(event) => setRawForm((current) => ({ ...current, price_level: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Latitude</label><input className="form-control" value={rawForm.latitude} onChange={(event) => setRawForm((current) => ({ ...current, latitude: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Longitude</label><input className="form-control" value={rawForm.longitude} onChange={(event) => setRawForm((current) => ({ ...current, longitude: event.target.value }))} /></div>
              <div className="col-12"><label className="form-label">Адрес</label><input className="form-control" value={rawForm.address} onChange={(event) => setRawForm((current) => ({ ...current, address: event.target.value }))} /></div>
              <div className="col-12"><label className="form-label">Описание</label><textarea className="form-control" rows="4" value={rawForm.description} onChange={(event) => setRawForm((current) => ({ ...current, description: event.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Источник</label><select className="form-select" value={rawForm.source_code} onChange={(event) => setRawForm((current) => ({ ...current, source_code: event.target.value }))}><option value="MANUAL">MANUAL</option><option value="WIKIPEDIA">WIKIPEDIA</option><option value="TWO_GIS">TWO_GIS</option></select></div>
              <div className="col-md-6"><label className="form-label">URL источника</label><input className="form-control" value={rawForm.source_url} onChange={(event) => setRawForm((current) => ({ ...current, source_url: event.target.value }))} /></div>
              <div className="col-12"><button type="submit" className="btn btn-primary">{loadingKey === "enrich" ? "Обрабатываю..." : "Запустить enrich"}</button></div>
            </form>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Результат ML"
        subtitle="Черновик можно отправить в POI-service как обычный объект. При isVerified=false он появится в очереди модерации."
        action={result ? <button type="button" className="btn btn-outline-primary" onClick={handleCreatePoiFromMl}>{loadingKey === "create-poi" ? "Создаю..." : "Создать POI из ML"}</button> : null}
      >
        {result ? <div className="d-flex flex-column gap-3"><div className="d-flex flex-wrap align-items-center gap-3"><div className="fw-semibold">{result.poi_draft?.name || "Черновик POI"}</div>{result.status_recommendation && <StatusBadge value={result.status_recommendation} />}{result.quality && <div className="text-secondary small">качество {result.quality.quality_score} • уверенность {result.quality.confidence_score}</div>}</div><div className="json-preview"><pre className="mb-0">{JSON.stringify(result, null, 2)}</pre></div></div> : <div className="text-secondary">Ответ от ML ещё не получен.</div>}
      </SectionCard>
    </div>
  );
}

export default MLLabPage;
