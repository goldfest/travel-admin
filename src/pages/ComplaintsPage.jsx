import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
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
  const [filter, setFilter] = useState("all");
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
        const page = await listReports({ page: 0, size: 100, status: filter === "all" ? undefined : filter });
        const mapped = page.items.map(mapReport);
        setRecords(mapped);
        setSelectedId((current) => current || mapped[0]?.id || null);
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить жалобы.");
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [filter, isApiMode]);

  const activeRecords = isApiMode ? records : mockRecords;
  const selectedComplaint = activeRecords.find((record) => Number(record.id) === Number(selectedId)) || activeRecords[0] || null;

  const statCards = useMemo(() => [
    { label: "Всего жалоб", value: activeRecords.length, tone: "info", icon: "bi-flag-fill" },
    { label: "Pending", value: activeRecords.filter((record) => String(record.status).toLowerCase() === "pending").length, tone: "warning", icon: "bi-hourglass-split" },
    { label: "Approved/Resolved", value: activeRecords.filter((record) => ["approved", "resolved"].includes(String(record.status).toLowerCase())).length, tone: "success", icon: "bi-check-circle-fill" },
  ], [activeRecords]);

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
              <select className="form-select" style={{ maxWidth: 220 }} value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">Все</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            }
          >
            {loading && <div className="text-secondary mb-3">Загрузка...</div>}
            {error && <div className="alert alert-danger mb-3">{error}</div>}

            <div className="d-flex flex-column gap-3">
              {activeRecords.map((complaint) => (
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
                      <div className="text-secondary small mt-1">Фото: {complaint.media?.length || 0}</div>
                    </div>
                    <StatusBadge value={complaint.status} />
                  </div>
                </button>
              ))}
            </div>
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
