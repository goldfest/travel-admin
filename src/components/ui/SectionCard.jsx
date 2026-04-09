function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`surface-card p-4 ${className}`}>
      {(title || subtitle || action) && (
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
          <div>
            {title && <h2 className="h5 mb-1">{title}</h2>}
            {subtitle && <div className="text-secondary">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export default SectionCard;
