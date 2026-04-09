function StatCard({ label, value, tone = "info", icon = "bi-bar-chart-fill" }) {
  const toneMap = {
    info: "primary",
    success: "success",
    warning: "warning",
    danger: "danger",
  };

  return (
    <div className="metric-card p-4">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="section-title mb-2">{label}</div>
          <div className="display-6 fw-semibold mb-0">{value}</div>
        </div>
        <div className={`metric-icon text-${toneMap[tone] || "primary"}`}>
          <i className={`bi ${icon}`} />
        </div>
      </div>
    </div>
  );
}

export default StatCard;
