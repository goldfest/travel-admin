import StatusBadge from "./StatusBadge";

function EntityTable({
  columns,
  records,
  onEdit,
  onDelete,
  renderActions,
  canEdit = true,
  canDelete = true,
  emptyLabel = "Записей пока нет.",
}) {
  if (!records.length) {
    return <div className="text-secondary">{emptyLabel}</div>;
  }

  return (
    <div className="table-responsive table-wrap">
      <table className="table align-middle">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th className="text-end">Действия</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.badge ? (
                    <StatusBadge value={record[column.key]} />
                  ) : column.render ? (
                    column.render(record)
                  ) : (
                    record[column.key] || "—"
                  )}
                </td>
              ))}
              <td className="text-end">
                {renderActions ? (
                  renderActions(record)
                ) : (
                  <div className="d-inline-flex gap-2">
                    {canEdit && (
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEdit(record)}>
                        <i className="bi bi-pencil-square me-1" />
                        Изменить
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onDelete(record)}
                      >
                        <i className="bi bi-trash3 me-1" />
                        Удалить
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EntityTable;
