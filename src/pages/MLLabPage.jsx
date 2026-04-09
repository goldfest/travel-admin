import { useEffect, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useAppSettings } from "../services/AppSettingsContext";
import {
  getCityLookup,
  getGraphImportStats,
  listImportTasks,
  startGraphImport,
  startImportTask,
} from "../services/adminApi";
import { enrichRawPoi, getMlHealth, getMlModelInfo, importFromSource } from "../services/mlService";
import { ingestMlDraft } from "../services/storage";

const initialImportForm = {
  source_code: "WIKIPEDIA",
  source_url: "https://ru.wikipedia.org/wiki/%D0%9A%D0%B0%D0%B7%D0%B0%D0%BD%D1%81%D0%BA%D0%B8%D0%B9_%D0%BA%D1%80%D0%B5%D0%BC%D0%BB%D1%8C",
  city_id: 1,
  language: "ru",
  poi_type_hint: "landmark",
};

const initialRawForm = {
  city_id: 1,
  language: "ru",
  poi_type_hint: "museum",
  name: "Дом Ушковой",
  description:
    "Историческое здание в центре города, которое можно использовать как тестовый payload для enrich raw POI.",
  address: "Кремлевская улица, 33",
  latitude: "55.7963",
  longitude: "49.1088",
  phone: "+7 843 000 00 00",
  site_url: "https://example.com/ushkova-house",
  price_level: "2",
  poi_type_code: "museum",
  source_code: "MANUAL",
  source_url: "https://example.com/ushkova-house",
};

function MLLabPage() {
  const { settings } = useAppSettings();
  const [cities, setCities] = useState([]);
  const [health, setHealth] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [importTasks, setImportTasks] = useState([]);
  const [graphStats, setGraphStats] = useState(null);
  const [error, setError] = useState("");
  const [importForm, setImportForm] = useState(initialImportForm);
  const [rawForm, setRawForm] = useState(initialRawForm);
  const [loadingKey, setLoadingKey] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [taskForm, setTaskForm] = useState({
    sourceCode: "WIKIPEDIA",
    query: "Казанский кремль",
    cityId: 1,
    importConfig: "",
  });
  const [graphForm, setGraphForm] = useState({
    cityId: 1,
    osmFilePath: "/osm-data/city.osm.pbf",
  });

  const runRequest = async (key, action) => {
    setLoadingKey(key);
    setError("");
    setSaveMessage("");

    try {
      await action();
    } catch (requestError) {
      setError(requestError.message || "Request failed.");
    } finally {
      setLoadingKey("");
    }
  };

  useEffect(() => {
    const loadCities = async () => {
      try {
        const cityLookup = await getCityLookup();
        setCities(cityLookup);

        if (cityLookup[0]?.id) {
          setImportForm((current) => ({ ...current, city_id: current.city_id || cityLookup[0].id }));
          setRawForm((current) => ({ ...current, city_id: current.city_id || cityLookup[0].id }));
          setTaskForm((current) => ({ ...current, cityId: current.cityId || cityLookup[0].id }));
          setGraphForm((current) => ({ ...current, cityId: current.cityId || cityLookup[0].id }));
        }
      } catch {
        // The page still works with manual IDs even if the city lookup is unavailable.
      }
    };

    if (settings.mode === "api") {
      loadCities();
    }
  }, [settings.mode]);

  const handleSaveDraft = () => {
    const output = ingestMlDraft(result);

    if (output.moderationItem) {
      setSaveMessage("Черновик сохранён в локальное хранилище POI и дополнительно отправлен в очередь модерации.");
      return;
    }

    if (output.createdPlace) {
      setSaveMessage("Черновик POI сохранён в локальное хранилище админки.");
    }
  };

  const fetchImportTasks = async () => {
    const page = await listImportTasks({ page: 0, size: 20 });
    setImportTasks(page.items);
  };

  const loadImportTasks = async () => {
    await runRequest("tasks", fetchImportTasks);
  };

  const loadGraphStats = async (explicitCityId) => {
    const cityId = Number(explicitCityId || graphForm.cityId);
    await runRequest("graph-stats", async () => {
      const stats = await getGraphImportStats(cityId);
      setGraphStats(stats);
    });
  };

  return (
    <div className="d-flex flex-column gap-4">
      <SectionCard
        title="Состояние ML worker"
        subtitle="Прямые вызовы worker-сервиса `travel-ml`, например `/health` и `/api/v1/model/info`."
        action={
          <div className="text-secondary small text-break">
            Базовый URL: <strong>{settings.services.ml}</strong>
          </div>
        }
      >
        <div className="d-flex flex-wrap gap-2 mb-4">
          <button type="button" className="btn btn-outline-primary" onClick={() => runRequest("health", async () => setHealth(await getMlHealth()))}>
            {loadingKey === "health" ? "Проверяю..." : "Проверить health"}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => runRequest("model", async () => setModelInfo(await getMlModelInfo()))}
          >
            {loadingKey === "model" ? "Загружаю..." : "Загрузить данные модели"}
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {saveMessage && <div className="alert alert-success">{saveMessage}</div>}

        <div className="row g-3">
          <div className="col-md-6">
            <div className="soft-list-item p-3 h-100">
              <div className="fw-semibold mb-2">Health</div>
              {health ? (
                <div className="d-flex flex-column gap-2">
                  <StatusBadge value={health.status} />
                  <div className="text-secondary small">
                    {health.service} - версия {health.version}
                  </div>
                </div>
              ) : (
                <div className="text-secondary small">Проверка health ещё не выполнялась.</div>
              )}
            </div>
          </div>
          <div className="col-md-6">
            <div className="soft-list-item p-3 h-100">
              <div className="fw-semibold mb-2">Данные модели</div>
              {modelInfo ? (
                <div className="d-flex flex-column gap-2">
                  <div>
                    <span className="section-title">Модель</span>
                    <div>{modelInfo.model_name}</div>
                  </div>
                  <div>
                    <span className="section-title">Загружена</span>
                    <div>{String(modelInfo.is_loaded)}</div>
                  </div>
                  <div className="text-secondary small">
                    fallback_enabled: {String(modelInfo.fallback_enabled)}
                  </div>
                </div>
              ) : (
                <div className="text-secondary small">Метаданные модели ещё не загружены.</div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Оркестрация импорта POI"
        subtitle="Backend-запуск импорта через `poi-service` с использованием `POST /import/start` и `GET /import/tasks`."
        action={
          <button type="button" className="btn btn-outline-primary" onClick={loadImportTasks}>
            {loadingKey === "tasks" ? "Обновляю..." : "Обновить задачи"}
          </button>
        }
      >
        <form
          className="row g-3 mb-4"
          onSubmit={(event) => {
            event.preventDefault();
            runRequest("import-task", async () => {
              await startImportTask({
                sourceCode: taskForm.sourceCode,
                query: taskForm.query,
                cityId: Number(taskForm.cityId),
                importConfig: taskForm.importConfig || null,
              });
              await fetchImportTasks();
            });
          }}
        >
          <div className="col-md-4">
            <label className="form-label">Источник</label>
            <select
              className="form-select"
              value={taskForm.sourceCode}
              onChange={(event) => setTaskForm((current) => ({ ...current, sourceCode: event.target.value }))}
            >
              <option value="wikipedia">wikipedia</option>
              <option value="2gis">2gis</option>
              <option value="MAPS">MAPS</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Запрос</label>
            <input
              className="form-control"
              value={taskForm.query}
              onChange={(event) => setTaskForm((current) => ({ ...current, query: event.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Город</label>
            <select
              className="form-select"
              value={taskForm.cityId}
              onChange={(event) => setTaskForm((current) => ({ ...current, cityId: event.target.value }))}
            >
              {cities.length > 0 ? (
                cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))
              ) : (
                <option value={taskForm.cityId}>{taskForm.cityId}</option>
              )}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Конфиг импорта</label>
            <input
              className="form-control"
              value={taskForm.importConfig}
              onChange={(event) => setTaskForm((current) => ({ ...current, importConfig: event.target.value }))}
              placeholder='Example: {"limit":10}'
            />
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-primary">
              {loadingKey === "import-task" ? "Запускаю..." : "Запустить backend-импорт"}
            </button>
          </div>
        </form>

        <div className="d-flex flex-column gap-3">
          {importTasks.length > 0 ? (
            importTasks.map((task) => (
              <div key={task.id} className="soft-list-item p-3">
                <div className="d-flex justify-content-between gap-3 flex-wrap">
                  <div>
                    <div className="fw-semibold">
                      #{task.id} - {task.sourceCode} - {task.query}
                    </div>
                    <div className="text-secondary small">
                      cityId: {task.cityId} - создано: {task.createdAt || "-"}
                    </div>
                  </div>
                  <StatusBadge value={task.status || "PENDING"} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-secondary">Задачи импорта ещё не загружены.</div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Импорт графа"
        subtitle="Операции для `graph-importer` через `/internal/graph-import` и `/cities/{cityId}/stats`."
        action={
          <div className="text-secondary small text-break">
            Базовый URL: <strong>{settings.services.graphImport}</strong>
          </div>
        }
      >
        <div className="row g-4">
          <div className="col-12 col-xl-6">
            <form
              className="row g-3"
              onSubmit={(event) => {
                event.preventDefault();
                runRequest("graph-import", async () => {
                  await startGraphImport({
                    cityId: Number(graphForm.cityId),
                    osmFilePath: graphForm.osmFilePath || null,
                  });
                  await loadGraphStats(graphForm.cityId);
                });
              }}
            >
              <div className="col-md-6">
                <label className="form-label">Город</label>
                <select
                  className="form-select"
                  value={graphForm.cityId}
                  onChange={(event) => setGraphForm((current) => ({ ...current, cityId: event.target.value }))}
                >
                  {cities.length > 0 ? (
                    cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))
                  ) : (
                    <option value={graphForm.cityId}>{graphForm.cityId}</option>
                  )}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Путь к OSM-файлу</label>
                <input
                  className="form-control"
                  value={graphForm.osmFilePath}
                  onChange={(event) => setGraphForm((current) => ({ ...current, osmFilePath: event.target.value }))}
                />
              </div>
              <div className="col-12 d-flex flex-wrap gap-2">
                <button type="submit" className="btn btn-outline-primary">
                  {loadingKey === "graph-import" ? "Запускаю..." : "Запустить импорт графа"}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => loadGraphStats()}>
                  {loadingKey === "graph-stats" ? "Загружаю..." : "Загрузить статистику графа"}
                </button>
              </div>
            </form>
          </div>

          <div className="col-12 col-xl-6">
            <div className="soft-list-item p-3 h-100">
              <div className="fw-semibold mb-3">Статистика графа</div>
              {graphStats ? (
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex flex-wrap gap-2">
                    <StatusBadge value={graphStats.activeGraphStatus || "UNKNOWN"} />
                    <span className="small text-secondary">Город #{graphStats.cityId}</span>
                  </div>
                  <div className="small text-secondary">Узлов: {graphStats.nodeCount ?? "-"}</div>
                  <div className="small text-secondary">Рёбер: {graphStats.edgeCount ?? "-"}</div>
                  <div className="small text-secondary">Связок: {graphStats.bindingCount ?? "-"}</div>
                  <div className="small text-secondary">Импортировано: {graphStats.importedAt || "-"}</div>
                  {graphStats.failureReason && (
                    <div className="alert alert-warning mt-2 mb-0">{graphStats.failureReason}</div>
                  )}
                </div>
              ) : (
                <div className="text-secondary small">Статистика графа ещё не загружена.</div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <SectionCard title="Импорт из источника" subtitle="Прямой вызов `/api/v1/poi/import-from-source`.">
            <form
              className="row g-3"
              onSubmit={(event) => {
                event.preventDefault();
                runRequest("import", async () => {
                  const response = await importFromSource({
                    ...importForm,
                    city_id: Number(importForm.city_id),
                  });
                  setResult(response);
                });
              }}
            >
              <div className="col-md-6">
                <label className="form-label">Источник</label>
                <select
                  className="form-select"
                  value={importForm.source_code}
                  onChange={(event) => setImportForm((current) => ({ ...current, source_code: event.target.value }))}
                >
                  <option value="WIKIPEDIA">WIKIPEDIA</option>
                  <option value="TWO_GIS">TWO_GIS</option>
                  <option value="MAPS">MAPS</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Город</label>
                <select
                  className="form-select"
                  value={importForm.city_id}
                  onChange={(event) => setImportForm((current) => ({ ...current, city_id: event.target.value }))}
                >
                  {cities.length > 0 ? (
                    cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))
                  ) : (
                    <option value={importForm.city_id}>{importForm.city_id}</option>
                  )}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">URL источника</label>
                <input
                  className="form-control"
                  value={importForm.source_url}
                  onChange={(event) => setImportForm((current) => ({ ...current, source_url: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Язык</label>
                <input
                  className="form-control"
                  value={importForm.language}
                  onChange={(event) => setImportForm((current) => ({ ...current, language: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Подсказка по типу POI</label>
                <input
                  className="form-control"
                  value={importForm.poi_type_hint}
                  onChange={(event) => setImportForm((current) => ({ ...current, poi_type_hint: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-primary">
                  {loadingKey === "import" ? "Выполняю..." : "Запустить импорт"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>

        <div className="col-12 col-xl-6">
          <SectionCard title="Обогащение raw POI" subtitle="Прямой вызов `/api/v1/poi/enrich-raw` с ручным payload.">
            <form
              className="row g-3"
              onSubmit={(event) => {
                event.preventDefault();
                runRequest("enrich", async () => {
                  const response = await enrichRawPoi({
                    city_id: Number(rawForm.city_id),
                    language: rawForm.language,
                    poi_type_hint: rawForm.poi_type_hint,
                    raw_poi: {
                      name: rawForm.name,
                      description: rawForm.description,
                      address: rawForm.address,
                      latitude: Number(rawForm.latitude),
                      longitude: Number(rawForm.longitude),
                      phone: rawForm.phone,
                      site_url: rawForm.site_url,
                      price_level: Number(rawForm.price_level),
                      poi_type_code: rawForm.poi_type_code,
                      features: {},
                      hours: [],
                      media: [],
                      source: {
                        source_code: rawForm.source_code,
                        source_url: rawForm.source_url,
                        external_id: null,
                      },
                    },
                  });
                  setResult(response);
                });
              }}
            >
              <div className="col-md-6">
                <label className="form-label">Название</label>
                <input
                  className="form-control"
                  value={rawForm.name}
                  onChange={(event) => setRawForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Код типа</label>
                <input
                  className="form-control"
                  value={rawForm.poi_type_code}
                  onChange={(event) => setRawForm((current) => ({ ...current, poi_type_code: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Город</label>
                <select
                  className="form-select"
                  value={rawForm.city_id}
                  onChange={(event) => setRawForm((current) => ({ ...current, city_id: event.target.value }))}
                >
                  {cities.length > 0 ? (
                    cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))
                  ) : (
                    <option value={rawForm.city_id}>{rawForm.city_id}</option>
                  )}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Уровень цены</label>
                <input
                  className="form-control"
                  value={rawForm.price_level}
                  onChange={(event) => setRawForm((current) => ({ ...current, price_level: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Latitude</label>
                <input
                  className="form-control"
                  value={rawForm.latitude}
                  onChange={(event) => setRawForm((current) => ({ ...current, latitude: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Longitude</label>
                <input
                  className="form-control"
                  value={rawForm.longitude}
                  onChange={(event) => setRawForm((current) => ({ ...current, longitude: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Адрес</label>
                <input
                  className="form-control"
                  value={rawForm.address}
                  onChange={(event) => setRawForm((current) => ({ ...current, address: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Описание</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={rawForm.description}
                  onChange={(event) => setRawForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Источник</label>
                <select
                  className="form-select"
                  value={rawForm.source_code}
                  onChange={(event) => setRawForm((current) => ({ ...current, source_code: event.target.value }))}
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="WIKIPEDIA">WIKIPEDIA</option>
                  <option value="TWO_GIS">TWO_GIS</option>
                  <option value="MAPS">MAPS</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">URL источника</label>
                <input
                  className="form-control"
                  value={rawForm.source_url}
                  onChange={(event) => setRawForm((current) => ({ ...current, source_url: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-primary">
                  {loadingKey === "enrich" ? "Обрабатываю..." : "Запустить enrich"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Результат ML"
        subtitle="После ответа worker-сервиса черновик можно сохранить локально и отправить в moderation flow."
        action={
          result ? (
            <button type="button" className="btn btn-outline-primary" onClick={handleSaveDraft}>
              Сохранить в админку
            </button>
          ) : null
        }
      >
        {result ? (
          <div className="d-flex flex-column gap-3">
            <div className="d-flex flex-wrap align-items-center gap-3">
              <div className="fw-semibold">{result.poi_draft?.name || result.name || "Черновик POI"}</div>
              {result.status_recommendation && <StatusBadge value={result.status_recommendation} />}
              {result.quality && (
                <div className="text-secondary small">
                  качество {result.quality.quality_score} - уверенность {result.quality.confidence_score}
                </div>
              )}
            </div>

            <div className="json-preview">
              <pre className="mb-0">{JSON.stringify(result, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className="text-secondary">Ответ от ML ещё не получен.</div>
        )}
      </SectionCard>
    </div>
  );
}

export default MLLabPage;
