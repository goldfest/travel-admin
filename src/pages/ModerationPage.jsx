import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useLocalCrud } from "../hooks/useLocalCrud";
import { useAppSettings } from "../services/AppSettingsContext";
import { deletePoi, listReports, listUnverifiedPois, processReport, verifyPoi } from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";
import { updateModerationItem } from "../services/storage";

function ModerationPage() {
  const { settings } = useAppSettings();
  const { records: mockRecords, refresh: refreshMock } = useLocalCrud("moderationItems");
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isApiMode = settings.mode === "api";

  useEffect(() => {
    if (!isApiMode) {
      return;
    }

    const loadQueue = async () => {
      setLoading(true);
      setError("");

      try {
        const [pendingReportsPage, unverifiedPoisPage] = await Promise.all([
          listReports({ status: "pending", page: 0, size: 100 }),
          listUnverifiedPois({ page: 0, size: 100 }),
        ]);

        const reportItems = pendingReportsPage.items.map((item) => ({
          id: `report-${item.id}`,
          sourceId: item.id,
          queueType: "report",
          title: item.reviewId ? `Review report #${item.id}` : `POI report #${item.id}`,
          status: item.status,
          type: item.reviewId ? "Review" : "POI",
          source: "REPORT",
          note: item.comment || item.reportType || "—",
          assignee: item.handledByUserName || "Не назначен",
          qualityScore: "manual",
          createdAt: formatDateTime(item.createdAt),
        }));

        const poiItems = unverifiedPoisPage.items.map((item) => ({
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
        }));

        setQueue([...reportItems, ...poiItems]);
      } catch (requestError) {
        setError(requestError.message || "Не удалось загрузить moderation queue.");
      } finally {
        setLoading(false);
      }
    };

    loadQueue();
  }, [isApiMode]);

  const visibleRecords = useMemo(() => {
    const records = isApiMode ? queue : mockRecords;

    if (filter === "open") {
      return records.filter((record) =>
        ["Pending", "Queued", "Needs Revision", "pending"].includes(record.status),
      );
    }

    if (filter === "closed") {
      return records.filter((record) =>
        ["Approved", "Rejected", "approved", "rejected"].includes(record.status),
      );
    }

    return records;
  }, [filter, isApiMode, mockRecords, queue]);

  const statCards = [
    {
      label: "Всего в очереди",
      value: visibleRecords.length,
      tone: "warning",
      icon: "bi-shield-exclamation",
    },
    {
      label: "Pending reports",
      value: (isApiMode ? queue : mockRecords).filter((record) => String(record.status).toLowerCase() === "pending").length,
      tone: "danger",
      icon: "bi-flag-fill",
    },
    {
      label: "POI на верификации",
      value: (isApiMode ? queue : mockRecords).filter((record) => record.queueType === "poi" || record.source === "ML").length,
      tone: "info",
      icon: "bi-signpost-2-fill",
    },
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
        await processReport(item.sourceId, { status: action, moderatorComment: "" });
      }

      if (item.queueType === "poi" && action === "approved") {
        await verifyPoi(item.sourceId);
      }

      if (item.queueType === "poi" && action === "rejected") {
        await deletePoi(item.sourceId);
      }

      setQueue((current) => current.filter((record) => record.id !== item.id));
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
        {statCards.map((card) => (
          <div className="col-12 col-md-4" key={card.label}>
            <StatCard {...card} />
          </div>
        ))}
      </div>

      <SectionCard
        title="Очередь модерации"
        subtitle={
          isApiMode
            ? "Live queue объединяет pending reports и unverified POIs."
            : "Mock queue для локальной проработки moderation сценариев."
        }
        action={
          <select className="form-select" style={{ maxWidth: 220 }} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="open">Открытые</option>
            <option value="closed">Закрытые</option>
            <option value="all">Все</option>
          </select>
        }
      >
        {loading && <div className="text-secondary mb-3">Загрузка...</div>}
        {error && <div className="alert alert-danger mb-3">{error}</div>}

        <div className="row g-3">
          {visibleRecords.map((item) => (
            <div className="col-12 col-lg-6" key={item.id}>
              <div className="soft-list-item p-4 h-100">
                <div className="d-flex justify-content-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="fw-semibold">{item.title}</div>
                    <div className="text-secondary small">
                      {item.type} • {item.source} • {item.assignee}
                    </div>
                  </div>
                  <StatusBadge value={item.status} />
                </div>

                <div className="mb-3 text-secondary small">{item.note}</div>
                <div className="mb-4">
                  <span className="section-title">Queue meta</span>
                  <div className="fw-semibold">{item.qualityScore}</div>
                  <div className="text-secondary small">{item.createdAt}</div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline-success btn-sm" onClick={() => handleAction(item, "approved")}>
                    Одобрить
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleAction(item, "rejected")}>
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default ModerationPage;
