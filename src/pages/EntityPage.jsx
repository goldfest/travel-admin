import { useCallback, useEffect, useMemo, useState } from "react";
import StatCard from "../components/ui/StatCard";
import SectionCard from "../components/ui/SectionCard";
import EntityTable from "../components/ui/EntityTable";
import EntityModal from "../components/ui/EntityModal";
import PaginationControls from "../components/ui/PaginationControls";
import { useLocalCrud } from "../hooks/useLocalCrud";
import { useAppSettings } from "../services/AppSettingsContext";

function EntityPage({ config }) {
  const { settings } = useAppSettings();
  const localCrud = useLocalCrud(config.key);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [apiRecords, setApiRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pageInfo, setPageInfo] = useState({ page: 0, size: 20, totalPages: 1, totalElements: 0 });
  const [extraFilters, setExtraFilters] = useState({ popular: "all" });

  const isApiMode = settings.mode === "api" && Boolean(config.live);

  const loadApiRecords = useCallback(async () => {
    if (!config.live?.fetchList) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await config.live.fetchList({ page: pageInfo.page, size: pageInfo.size });
      const records = Array.isArray(result) ? result : result.items;
      setApiRecords(records || []);
      if (!Array.isArray(result)) {
        setPageInfo((current) => ({
          ...current,
          totalPages: result.totalPages || 1,
          totalElements: result.totalElements ?? records.length,
        }));
      }
      setNotice(config.live.notice || "");
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }, [config.live, pageInfo.page, pageInfo.size]);

  useEffect(() => {
    if (isApiMode) {
      loadApiRecords();
    }
  }, [isApiMode, loadApiRecords]);

  const records = isApiMode ? apiRecords : localCrud.records;

  const filteredRecords = useMemo(() => {
    let nextRecords = records;

    if (config.key === "cities" && extraFilters.popular !== "all") {
      nextRecords = nextRecords.filter((record) => record.isPopular === extraFilters.popular);
    }

    if (!query.trim()) {
      return nextRecords;
    }

    const normalizedQuery = query.trim().toLowerCase();

    return nextRecords.filter((record) =>
      Object.values(record).some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [records, query, extraFilters, config.key]);

  const summary = config.summary(records);

  const handleCreate = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleSubmit = async (payload) => {
    try {
      if (isApiMode) {
        await config.live.save(payload);
        await loadApiRecords();
      } else {
        localCrud.saveRecord(payload);
      }

      setModalOpen(false);
      setEditingRecord(null);
    } catch (requestError) {
      setError(requestError.message || "Не удалось сохранить запись.");
    }
  };

  const handleDeleteRequest = async (record) => {
    if (!window.confirm(`Удалить ${config.singular} "${record.name || record.fullName}"?`)) {
      return;
    }

    try {
      if (isApiMode) {
        await config.live.delete(record);
        await loadApiRecords();
      } else {
        localCrud.removeRecord(record.id);
      }
    } catch (requestError) {
      setError(requestError.message || "Не удалось удалить запись.");
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <section className="page-hero surface-card p-4 p-lg-5">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-4">
          <div className="position-relative" style={{ zIndex: 1 }}>
            <div className="section-title text-white-50">CRUD Workspace</div>
            <h2 className="display-6 fw-semibold mb-2 d-flex align-items-center gap-3">
              <i className={`bi ${config.heroIcon}`} />
              {config.title}
            </h2>
            <p className="mb-0 text-white-50">{config.description}</p>
          </div>
          {(config.capabilities?.canCreate ?? true) && (
            <button type="button" className="btn btn-light btn-lg" onClick={handleCreate}>
              <i className="bi bi-plus-circle me-2" />
              Добавить
            </button>
          )}
        </div>
      </section>

      <div className="row g-3">
        {summary.map((item) => (
          <div className="col-12 col-md-4" key={item.label}>
            <StatCard {...item} />
          </div>
        ))}
      </div>

      <SectionCard
        title={`Таблица: ${config.title}`}
        subtitle="Поиск работает по всем видимым полям. В mock-режиме данные сохраняются в localStorage, в api-режиме идут напрямую в backend."
        action={
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            {config.key === "cities" && (
              <select
                className="form-select"
                style={{ maxWidth: 190 }}
                value={extraFilters.popular}
                onChange={(event) => setExtraFilters((current) => ({ ...current, popular: event.target.value }))}
              >
                <option value="all">Все города</option>
                <option value="Yes">Только popular</option>
                <option value="No">Не popular</option>
              </select>
            )}
            <div className="input-group" style={{ maxWidth: 360 }}>
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search" />
              </span>
              <input
                className="form-control border-start-0"
                placeholder="Поиск по таблице"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        }
      >
        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {notice && <div className="alert alert-info mb-3">{notice}</div>}
        {loading && <div className="text-secondary mb-3">Загрузка...</div>}
        <EntityTable
          columns={config.columns}
          records={filteredRecords}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          canEdit={config.capabilities?.canEdit ?? true}
          canDelete={config.capabilities?.canDelete ?? true}
          emptyLabel="Ничего не найдено по текущему фильтру."
        />
        {isApiMode && (
          <PaginationControls
            page={pageInfo.page}
            size={pageInfo.size}
            totalPages={pageInfo.totalPages}
            totalElements={pageInfo.totalElements}
            onPageChange={(page) => setPageInfo((current) => ({ ...current, page }))}
            onSizeChange={(size) => setPageInfo((current) => ({ ...current, page: 0, size }))}
          />
        )}
      </SectionCard>

      <EntityModal
        isOpen={modalOpen}
        title={editingRecord ? `Изменить ${config.singular}` : `Создать ${config.singular}`}
        fields={config.fields}
        initialRecord={editingRecord}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default EntityPage;
