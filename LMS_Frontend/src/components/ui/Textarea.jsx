import './extras.css';

export function Textarea({ label, error, id, name, className = '', ...rest }) {
  const taId = id ?? name;
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={taId}>
          {label}
        </label>
      )}
      <textarea id={taId} name={name} className={`textarea ${className}`} {...rest} />
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
