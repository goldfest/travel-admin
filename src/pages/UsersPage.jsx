import { useCallback, useEffect, useMemo, useState } from "react";
import EntityPage from "./EntityPage";
import SectionCard from "../components/ui/SectionCard";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import EntityTable from "../components/ui/EntityTable";
import { entityConfigs } from "../data/entityConfigs";
import { useAppSettings } from "../services/AppSettingsContext";
import { blockUser, deleteUser, getCurrentUser, listUsers, unblockUser } from "../services/adminApi";
import { formatDateTime } from "../services/apiClient";

function mapUserRecord(user) {
  return {
    id: user.id,
    username: user.username || "—",
    email: user.email || "—",
    role: user.role || "—",
    status: user.status || "—",
    isBlocked: user.isBlocked ? "Yes" : "No",
    homeCityId: user.homeCityId ?? "—",
    lastLoginAt: formatDateTime(user.lastLoginAt),
    createdAt: formatDateTime(user.createdAt),
  };
}

function UsersPage() {
  const { settings, updateSettings } = useAppSettings();
  const [currentUser, setCurrentUser] = useState(settings.currentUser);
  const [records, setRecords] = useState([]);
  const [manualUserId, setManualUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isApiMode = settings.mode === "api";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [me, page] = await Promise.all([getCurrentUser(), listUsers({ page: 0, size: 50 })]);
      setCurrentUser(me);
      updateSettings((current) => ({
        ...current,
        currentUser: me,
      }));
      setRecords(page.items.map(mapUserRecord));

      if (page.items.length === 0) {
        setNotice(
          "Endpoint `GET /admin/users` в текущей backend-ветке возвращает пустую страницу-заглушку. Блокировка, разблокировка и удаление по ID уже подключены.",
        );
      }
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить пользователей.");
    } finally {
      setLoading(false);
    }
  }, [updateSettings]);

  useEffect(() => {
    if (isApiMode) {
      loadUsers();
    }
  }, [isApiMode, loadUsers]);

  const statCards = useMemo(
    () => [
      { label: "Текущий админ", value: currentUser?.username || "—", tone: "info", icon: "bi-person-badge-fill" },
      { label: "Загружено users", value: records.length, tone: "success", icon: "bi-people-fill" },
      {
        label: "Blocked",
        value: records.filter((record) => record.isBlocked === "Yes").length,
        tone: "warning",
        icon: "bi-shield-lock-fill",
      },
    ],
    [currentUser, records],
  );

  if (!isApiMode) {
    return <EntityPage config={entityConfigs.users} />;
  }

  const runManualAction = async (action, explicitUserId) => {
    const targetUserId = explicitUserId || manualUserId;

    if (!targetUserId) {
      setError("Укажи ID пользователя.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (action === "block") {
        await blockUser(targetUserId);
      }

      if (action === "unblock") {
        await unblockUser(targetUserId);
      }

      if (action === "delete") {
        await deleteUser(targetUserId);
      }

      setNotice(`Действие "${action}" выполнено для пользователя #${targetUserId}.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message || "Не удалось выполнить admin action.");
    } finally {
      setLoading(false);
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

      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <SectionCard title="Сессия администратора" subtitle="Профиль текущего пользователя из `GET /users/me`.">
            {currentUser ? (
              <div className="d-flex flex-column gap-3">
                <div>
                  <div className="section-title">Username</div>
                  <div className="fw-semibold">{currentUser.username}</div>
                </div>
                <div>
                  <div className="section-title">Email</div>
                  <div>{currentUser.email}</div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <StatusBadge value={currentUser.role} />
                  <StatusBadge value={currentUser.status} />
                </div>
              </div>
            ) : (
              <div className="text-secondary">Профиль пока не загружен.</div>
            )}
          </SectionCard>
        </div>

        <div className="col-12 col-xl-8">
          <SectionCard
            title="Admin actions"
            subtitle="Даже если список пользователей пока пустой в backend, критичные действия уже можно вызывать по ID."
          >
            {error && <div className="alert alert-danger">{error}</div>}
            {notice && <div className="alert alert-info">{notice}</div>}

            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label">User ID</label>
                <input
                  className="form-control"
                  value={manualUserId}
                  onChange={(event) => setManualUserId(event.target.value)}
                  placeholder="Например, 12"
                />
              </div>
              <div className="col-md-8 d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-warning" disabled={loading} onClick={() => runManualAction("block")}>
                  Заблокировать
                </button>
                <button type="button" className="btn btn-outline-success" disabled={loading} onClick={() => runManualAction("unblock")}>
                  Разблокировать
                </button>
                <button type="button" className="btn btn-outline-danger" disabled={loading} onClick={() => runManualAction("delete")}>
                  Удалить
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Список пользователей" subtitle="Пагинация уже подключена к `GET /admin/users`.">
        {loading && <div className="text-secondary mb-3">Загрузка...</div>}
        {error && <div className="alert alert-danger mb-3">{error}</div>}
        {notice && <div className="alert alert-info mb-3">{notice}</div>}

        <EntityTable
          columns={[
            { key: "username", label: "Username" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", badge: true },
            { key: "status", label: "Status", badge: true },
            { key: "isBlocked", label: "Blocked", badge: true },
            { key: "createdAt", label: "Создан" },
          ]}
          records={records}
          onEdit={() => {}}
          onDelete={() => {}}
          renderActions={(record) => (
            <div className="d-inline-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => runManualAction("block", record.id)}>
                Block
              </button>
              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runManualAction("unblock", record.id)}>
                Unblock
              </button>
            </div>
          )}
          emptyLabel="Backend пока не отдает populated user list через `/admin/users`."
        />
      </SectionCard>
    </div>
  );
}

export default UsersPage;
