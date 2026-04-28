import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useLocalCrud } from "../hooks/useLocalCrud";
import { useAppSettings } from "../services/AppSettingsContext";
import {
  approvePoiMedia,
  approveReview,
  deletePoi,
  getPoiMediaUrl,
  getReviewMediaUrl,
  listPendingPoiMedia,
  listPendingReviews,
  listReports,
  listUnverifiedPois,
  processReport,
  rejectPoiMedia,
  rejectReview,
  verifyPoi,
} from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";
import { updateModerationItem } from "../services/storage";

function mapReportItem(item) {
  return {
    id: `report-${item.id}`,
    sourceId: item.id,
    queueType: "report",
    title: item.reviewId ? `Жалоба на отзыв #${item.reviewId}` : `Жалоба на POI #${item.poiId}`,
    status: item.status,
    type: item.reviewId ? "Review report" : "POI report",
    source: "REPORT",
    note: item.comment || item.reportType || "—",
    assignee: item.handledByUserName || "Не назначен",
    qualityScore: item.reportType || "manual",
    createdAt: formatDateTime(item.createdAt),
    media: (item.media || []).map((media) => ({ ...media, url: getReviewMediaUrl(media.url), label: media.mediaType || "PHOTO" })),
  };
}

function mapPoiItem(item) {
  return {
    id: `poi-${item.id}`,
    sourceId: item.id,
    queueType: "poi",
    title: item.name,
    status: item.isVerified ? "approved" : "pending",
    type: item.poiType?.name || item.poiType?.code || "POI",
    source: "POI",
    note: item.address || item.description || "Без описания",
    assignee: "Admin review",
    qualityScore: item.currentStatus || "needs verification",
    createdAt: formatDateTime(item.updatedAt || item.createdAt),
    media: (item.media || []).map((media) => ({ ...media, url: getPoiMediaUrl(media.url), label: media.sourceType || media.mediaType || "PHOTO" })),
  };
}

function mapReviewItem(item) {
  return {
    id: `review-${item.id}`,
    sourceId: item.id,
    queueType: "review",
    title: `Отзыв #${item.id} к POI #${item.poiId}`,
    status: item.moderationStatus,
    type: "Review",
    source: "REVIEW_MEDIA",
    note: item.comment || "Без комментария",
    assignee: item.userName || `User #${item.userId}`,
    qualityScore: `rating ${item.rating}`,
    createdAt: formatDateTime(item.createdAt),
    media: (item.media || []).map((media) => ({ ...media, url: getReviewMediaUrl(media.imageUrl), label: media.moderationStatus || media.sourceType || "PHOTO" })),
  };
}

function mapPoiMediaItem(item) {
  return {
    id: `poi-media-${item.id}`,
    sourceId: item.id,
    poiId: item.poiId,
    queueType: "poiMedia",
    title: `Фото POI #${item.poiId}`,
    status: item.moderationStatus,
    type: "POI photo",
    source: item.sourceType || "USER_UPLOAD",
    note: item.originalFilename || item.contentType || "Фото без имени",
    assignee: `User #${item.userId}`,
    qualityScore: item.contentType || "media",
    createdAt: formatDateTime(item.createdAt),
    media: [{ ...item, url: getPoiMediaUrl(item.url), label: item.moderationStatus || item.sourceType || "PHOTO" }],
  };
}

function ModerationPage() {
  const { settings } = useAppSettings();
  const { records: mockRecords, refresh: refreshMock } = useLocalCrud("moderationItems");
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [moderationComment, setModerationComment] = useState("");

  const isApiMode = settings.mode === "api";

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const [pendingReportsPage, unverifiedPoisPage, pendingReviewsPage, pendingPoiMediaPage] = await Promise.all([
        listReports({ status: "pending", page: 0, size: 100 }),
        listUnverifiedPois({ page: 0, size: 100 }),
        listPendingReviews({ page: 0, size: 100 }),
        listPendingPoiMedia({ page: 0, size: 100 }),
      ]);

      setQueue([
        ...pendingReportsPage.items.map(mapReportItem),
        ...unverifiedPoisPage.items.map(mapPoiItem),
        ...pendingReviewsPage.items.map(mapReviewItem),
        ...pendingPoiMediaPage.items.map(mapPoiMediaItem),
      ]);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить moderation queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isApiMode) {
      loadQueue();
    }
  }, [isApiMode]);

  const visibleRecords = useMemo(() => {
    const records = isApiMode ? queue : mockRecords;
    if (filter === "open") {
      return records.filter((record) => ["pending", "PENDING", "Queued", "Needs Revision"].includes(String(record.status)));
    }
    if (filter === "closed") {
      return records.filter((record) => ["approved", "rejected", "APPROVED", "REJECTED", "Approved", "Rejected"].includes(String(record.status)));
    }
    return records;
  }, [filter, isApiMode, mockRecords, queue]);

  const statCards = [
    { label: "Всего в очереди", value: visibleRecords.length, tone: "warning", icon: "bi-shield-exclamation" },
    { label: "Жалобы", value: (isApiMode ? queue : mockRecords).filter((record) => record.queueType === "report").length, tone: "danger", icon: "bi-flag-fill" },
    { label: "Отзывы/фото", value: (isApiMode ? queue : mockRecords).filter((record) => ["review", "poiMedia"].includes(record.queueType)).length, tone: "info", icon: "bi-images" },
  ];

  const handleMockAction = (item, status) => {
    updateModerationItem(item.id, { status });
    refreshMock();
  };

  const handleLiveAction = async (item, action) => {
    setLoading(true);
    setError("");
    try {
      if (item.queueType === "report") {
        await processReport(item.sourceId, { status: action, moderatorComment: moderationComment || "" });
      }
      if (item.queueType === "poi" && action === "approved") {
        await verifyPoi(item.sourceId);
      }
      if (item.queueType === "poi" && action === "rejected") {
        await deletePoi(item.sourceId);
      }
      if (item.queueType === "review" && action === "approved") {
        await approveReview(item.sourceId, moderationComment || "");
      }
      if (item.queueType === "review" && action === "rejected") {
        await rejectReview(item.sourceId, moderationComment || "");
      }
      if (item.queueType === "poiMedia" && action === "approved") {
        await approvePoiMedia(item.poiId, item.sourceId);
      }
      if (item.queueType === "poiMedia" && action === "rejected") {
        await rejectPoiMedia(item.poiId, item.sourceId, moderationComment || "Отклонено модератором");
      }

      setQueue((current) => current.filter((record) => record.id !== item.id));
      setModerationComment("");
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить moderation action.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (item, action) => {
    if (!isApiMode) {
      handleMockAction(item, action === "approved" ? "Approved" : "Rejected");
      return;
    }
    await handleLiveAction(item, action);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        {statCards.map((card) => <div className="col-12 col-md-4" key={card.label}><StatCard {...card} /></div>)}
      </div>

      <SectionCard
        title="Очередь модерации"
        subtitle={isApiMode ? "Live queue: pending reports, unverified POI, pending reviews and pending POI photos." : "Mock queue для локальной проработки moderation сценариев."}
        action={
          <div className="d-flex flex-wrap gap-2">
            <select className="form-select" style={{ maxWidth: 220 }} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="open">Открытые</option>
              <option value="closed">Закрытые</option>
              <option value="all">Все</option>
            </select>
            {isApiMode && <button type="button" className="btn btn-outline-primary" onClick={loadQueue}>Обновить</button>}
          </div>
        }
      >
        {loading && <div className="text-secondary mb-3">Загрузка...</div>}
        {error && <div className="alert alert-danger mb-3">{error}</div>}

        <div className="mb-4">
          <label className="form-label">Комментарий модератора / причина отклонения</label>
          <textarea className="form-control" rows="2" value={moderationComment} onChange={(event) => setModerationComment(event.target.value)} />
        </div>

        <div className="row g-3">
          {visibleRecords.map((item) => (
            <div className="col-12 col-lg-6" key={item.id}>
              <div className="soft-list-item p-4 h-100">
                <div className="d-flex justify-content-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="fw-semibold">{item.title}</div>
                    <div className="text-secondary small">{item.type} • {item.source} • {item.assignee}</div>
                  </div>
                  <StatusBadge value={item.status} />
                </div>

                <div className="mb-3 text-secondary small">{item.note}</div>
                <div className="mb-3">
                  <span className="section-title">Queue meta</span>
                  <div className="fw-semibold">{item.qualityScore}</div>
                  <div className="text-secondary small">{item.createdAt}</div>
                </div>

                {(item.media || []).length > 0 && (
                  <div className="media-grid media-grid--compact mb-4">
                    {item.media.map((media) => (
                      <a key={media.id || media.url} href={media.url} target="_blank" rel="noreferrer" className="media-thumb">
                        <img src={media.url} alt={media.originalFilename || media.label || "media"} />
                        <span>{media.label || "PHOTO"}</span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline-success btn-sm" onClick={() => handleAction(item, "approved")}>Одобрить</button>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleAction(item, "rejected")}>Отклонить</button>
                </div>
              </div>
            </div>
          ))}
          {visibleRecords.length === 0 && <div className="text-secondary">Очередь пуста.</div>}
        </div>
      </SectionCard>
    </div>
  );
}

export default ModerationPage;
