import './extras.css';

export function Select({ label, error, id, name, options = [], children, className = '', ...rest }) {
  const selectId = id ?? name;
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select id={selectId} name={name} className={`select ${className}`} {...rest}>
        {children ??
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
