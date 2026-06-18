import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import './toast.css';

const ToastContext = createContext(null);

/** Global, themed toast notifications. Wrap the app once; call useToast() anywhere. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // Two-phase dismiss: mark as leaving (plays the exit animation), then unmount.
  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => remove(id), 150);
  }, [remove]);

  const toast = useCallback(
    ({ type = 'info', message, duration = 4000 }) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, type, message }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  // Convenience helpers.
  const value = {
    toast,
    success: (message, o) => toast({ ...o, type: 'success', message }),
    error: (message, o) => toast({ ...o, type: 'error', message }),
    info: (message, o) => toast({ ...o, type: 'info', message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const Icon = { success: CheckCircle2, error: XCircle, info: Info }[toast.type] ?? Info;
  return (
    <div className={`toast toast--${toast.type}${toast.leaving ? ' toast--leaving' : ''}`}>
      <span className="toast__icon"><Icon size={18} strokeWidth={2.2} /></span>
      <span className="toast__msg">{toast.message}</span>
      <button className="toast__close" aria-label="Dismiss" onClick={onClose}><X size={16} /></button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
