import { forwardRef } from 'react';
import './ui.css';

export const Input = forwardRef(function Input(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input ref={ref} id={inputId} className={`input ${className}`} {...rest} />
      {error && <span className="field__error">{error}</span>}
    </div>
  );
});
