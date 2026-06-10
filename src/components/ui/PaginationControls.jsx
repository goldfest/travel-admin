function clampPage(page, totalPages) {
  const lastPage = Math.max(Number(totalPages || 1), 1);
  return Math.min(Math.max(Number(page || 0), 0), lastPage - 1);
}

function PaginationControls({ page = 0, size = 20, totalPages = 1, totalElements = 0, onPageChange, onSizeChange }) {
  const currentPage = clampPage(page, totalPages);
  const safeTotalPages = Math.max(Number(totalPages || 1), 1);
  const start = totalElements === 0 ? 0 : currentPage * size + 1;
  const end = Math.min((currentPage + 1) * size, totalElements);

  return (
    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mt-3">
      <div className="text-secondary small">
        Показано {start}–{end} из {totalElements}. Страница {currentPage + 1} из {safeTotalPages}.
      </div>

      <div className="d-flex align-items-center gap-2 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ width: 110 }}
          value={size}
          onChange={(event) => onSizeChange?.(Number(event.target.value))}
        >
          {[10, 20, 50, 100].map((value) => (
            <option key={value} value={value}>{value} / стр.</option>
          ))}
        </select>

        <div className="btn-group" role="group" aria-label="Pagination">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={currentPage <= 0}
            onClick={() => onPageChange?.(0)}
            title="Первая страница"
          >
            <i className="bi bi-chevron-double-left" />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={currentPage <= 0}
            onClick={() => onPageChange?.(currentPage - 1)}
            title="Предыдущая страница"
          >
            <i className="bi bi-chevron-left" />
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary disabled">
            {currentPage + 1}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={currentPage + 1 >= safeTotalPages}
            onClick={() => onPageChange?.(currentPage + 1)}
            title="Следующая страница"
          >
            <i className="bi bi-chevron-right" />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={currentPage + 1 >= safeTotalPages}
            onClick={() => onPageChange?.(safeTotalPages - 1)}
            title="Последняя страница"
          >
            <i className="bi bi-chevron-double-right" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaginationControls;
