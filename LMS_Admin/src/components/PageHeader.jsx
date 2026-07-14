export function PageHeader({ title, subtitle, actions = null }) {
  return (
    <div className={`page-header${actions ? ' page-header--with-actions' : ''}`}>
      <div className="page-header__main">
        <h1>{title}</h1>
        {subtitle && <div className="page-header__sub">{subtitle}</div>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, accent = false, icon = null }) {
  return (
    <div className="card card--pad stat">
      {icon && <span className="stat__icon" aria-hidden>{icon}</span>}
      <span className="stat__label">{label}</span>
      <span className={`stat__value${accent ? ' stat__accent' : ''}`}>{value}</span>
    </div>
  );
}
