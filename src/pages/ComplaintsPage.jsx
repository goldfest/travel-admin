import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import PaginationControls from "../components/ui/PaginationControls";
import { useLocalCrud } from "../hooks/useLocalCrud";
import { useAppSettings } from "../services/AppSettingsContext";
import { getReviewMediaUrl, listReports, processReport } from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";
import { updateComplaint } from "../services/storage";

function mapReport(item) {
  return {
    id: item.id,
    subjectType: item.reviewId ? "Review" : "POI",
    subjectName: item.reviewId ? `Review #${item.reviewId}` : `POI #${item.poiId}`,
    reason: item.reportType || "—",
    reporter: item.userName || `User #${item.userId}`,
    priority: "Manual",
    status: item.status,
    comment: item.comment || "—",
    moderatorComment: item.moderatorComment || "",
    createdAt: formatDateTime(item.createdAt),
    handledAt: formatDateTime(item.handledAt),
    media: Array.isArray(item.media) ? item.media : [],
    photoUrl: item.photoUrl,
    raw: item,
  };
}

function ComplaintsPage() {
  const { settings } = useAppSettings();
  const { records: mockRecords, refresh: refreshMock } = useLocalCrud("complaints");
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({ status: "all", subjectType: "all", search: "" });
  const [pageInfo, setPageInfo] = useState({ page: 0, size: 20, totalPages: 1, totalElements: 0 });
  const [moderatorComment, setModeratorComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isApiMode = settings.mode === "api";

  useEffect(() => {
    if (!isApiMode) return;

    const loadReports = async () => {
      setLoading(true);
      setError("");
      try {
        const page = await listReports({
          page: pageInfo.page,
          size: pageInfo.size,
          status: filters.status === "all" ? undefined : filters.status,
        });
        const mapped = page.items.map(mapReport);
        setRecords(mapped);
        setPageInfo((current) => ({
          ...current,
          totalPages: page.totalPages,
          totalElements: page.totalElements,
        }));
        setSelectedId((current) => current || mapped[0]?.id || null);
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить жалобы.");
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [filters.status, isApiMode, pageInfo.page, pageInfo.size]);

  const activeRecords = isApiMode ? records : mockRecords;

  const visibleRecords = useMemo(() => {
    let nextRecords = activeRecords;
    if (filters.subjectType !== "all") {
      nextRecords = nextRecords.filter((record) => record.subjectType === filters.subjectType);
    }
    if (filters.search.trim()) {
      const normalized = filters.search.trim().toLowerCase();
      nextRecords = nextRecords.filter((record) =>
        [record.subjectName, record.reason, record.reporter, record.comment, record.status]
          .some((value) => String(value || "").toLowerCase().includes(normalized)),
      );
    }
    return nextRecords;
  }, [activeRecords, filters.subjectType, filters.search]);

  const selectedComplaint = visibleRecords.find((record) => Number(record.id) === Number(selectedId)) || visibleRecords[0] || null;

  const statCards = useMemo(() => [
    { label: "Всего по статусу", value: isApiMode ? pageInfo.totalElements : activeRecords.length, tone: "info", icon: "bi-flag-fill" },
    { label: "На странице", value: activeRecords.length, tone: "warning", icon: "bi-list-ul" },
    { label: "С фото", value: activeRecords.filter((record) => (record.media?.length || 0) > 0).length, tone: "success", icon: "bi-images" },
  ], [activeRecords, isApiMode, pageInfo.totalElements]);

  const resetToFirstPage = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPageInfo((current) => ({ ...current, page: 0 }));
  };

  const handleMockStatusChange = (status) => {
    if (!selectedComplaint) return;
    updateComplaint(selectedComplaint.id, { status, moderatorComment });
    refreshMock();
  };

  const handleProcess = async (status) => {
    if (!selectedComplaint) return;
    if (!isApiMode) {
      handleMockStatusChange(status);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await processReport(selectedComplaint.id, { status, moderatorComment });
      setRecords((current) => current.map((record) => record.id === selectedComplaint.id ? mapReport(response) : record));
    } catch (requestError) {
      setError(requestError.message || "Не удалось обработать жалобу.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        {statCards.map((card) => <div className="col-12 col-md-4" key={card.label}><StatCard {...card} /></div>)}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <SectionCard
            title="Лента жалоб"
            subtitle={isApiMode ? "Live endpoint: GET /v1/reports и GET /v1/reports/status/{status}." : "Mock moderation queue для локальной проработки сценариев."}
            action={
              <div className="d-flex gap-2 flex-wrap justify-content-end">
                <select className="form-select" style={{ maxWidth: 170 }} value={filters.status} onChange={(event) => resetToFirstPage({ status: event.target.value })}>
                  <option value="all">Все статусы</option>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
                <select className="form-select" style={{ maxWidth: 160 }} value={filters.subjectType} onChange={(event) => resetToFirstPage({ subjectType: event.target.value })}>
                  <option value="all">Все типы</option>
                  <option value="POI">POI</option>
                  <option value="Review">Review</option>
                </select>
              </div>
            }
          >
            {loading && <div className="text-secondary mb-3">Загрузка...</div>}
            {error && <div className="alert alert-danger mb-3">{error}</div>}

            <div className="input-group mb-3">
              <span className="input-group-text bg-white border-end-0"><i className="bi bi-search" /></span>
              <input
                className="form-control border-start-0"
                placeholder="Поиск по жалобам на текущей странице"
                value={filters.search}
                onChange={(event) => resetToFirstPage({ search: event.target.value })}
              />
            </div>

            <div className="d-flex flex-column gap-3">
              {visibleRecords.map((complaint) => (
                <button
                  type="button"
                  key={complaint.id}
                  className={`soft-list-item p-3 text-start ${selectedComplaint?.id === complaint.id ? "border-primary" : ""}`}
                  onClick={() => { setSelectedId(complaint.id); setModeratorComment(complaint.moderatorComment || ""); }}
                >
                  <div className="d-flex justify-content-between gap-3 flex-wrap">
                    <div>
                      <div className="fw-semibold">{complaint.subjectName}</div>
                      <div className="text-secondary small">{complaint.subjectType} • {complaint.reason} • {complaint.reporter}</div>
                      <div className="text-secondary small mt-1">Фото: {complaint.media?.length || 0} • {complaint.createdAt}</div>
                    </div>
                    <StatusBadge value={complaint.status} />
                  </div>
                </button>
              ))}
              {visibleRecords.length === 0 && <div className="text-secondary">Жалобы не найдены.</div>}
            </div>

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
        </div>

        <div className="col-12 col-xl-5">
          <SectionCard title="Карточка жалобы" subtitle="Просмотр доказательств, фото и обработка жалобы админом.">
            {selectedComplaint ? (
              <div className="d-flex flex-column gap-3">
                <div><div className="section-title">Объект</div><div className="fw-semibold">{selectedComplaint.subjectName}</div></div>
                <div><div className="section-title">Причина</div><div>{selectedComplaint.reason}</div></div>
                <div><div className="section-title">Текст жалобы</div><div>{selectedComplaint.comment}</div></div>
                <div><div className="section-title">Создана</div><div>{selectedComplaint.createdAt}</div></div>

                <div>
                  <div className="section-title mb-2">Фотографии жалобы</div>
                  <div className="media-grid media-grid--compact">
                    {(selectedComplaint.media || []).length > 0 ? selectedComplaint.media.map((media) => (
                      <a key={media.id || media.url} href={getReviewMediaUrl(media.url)} target="_blank" rel="noreferrer" className="media-thumb">
                        <img src={getReviewMediaUrl(media.url)} alt={media.originalFilename || "report media"} />
                        <span>{media.mediaType || "PHOTO"}</span>
                      </a>
                    )) : <div className="text-secondary small">Фото не прикреплены.</div>}
                  </div>
                </div>

                <div>
                  <label className="form-label">Комментарий модератора</label>
                  <textarea className="form-control" rows="4" value={moderatorComment} onChange={(event) => setModeratorComment(event.target.value)} />
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline-success" onClick={() => handleProcess(isApiMode ? "approved" : "Resolved")}>Одобрить</button>
                  <button type="button" className="btn btn-outline-danger" onClick={() => handleProcess(isApiMode ? "rejected" : "Rejected")}>Отклонить</button>
                </div>
              </div>
            ) : <div className="text-secondary">Жалоба не выбрана.</div>}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default ComplaintsPage;
