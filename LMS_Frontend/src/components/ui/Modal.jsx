import { useEffect } from 'react';
import './extras.css';

export function Modal({ open, title, onClose, children, footer, headerAction, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal__overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <span className="modal__title">{title}</span>
          <div className="modal__header-actions">
            {headerAction}
            <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
