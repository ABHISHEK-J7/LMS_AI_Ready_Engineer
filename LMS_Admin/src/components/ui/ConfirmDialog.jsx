import { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const ConfirmContext = createContext(null);

/**
 * Themed replacement for native window.confirm / window.prompt.
 * Mount <ConfirmProvider> once near the app root, then:
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, confirmLabel, tone:'danger' })) { ... }
 *   const reason = await confirm({ prompt:true, title, placeholder });  // string | null
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { opts, resolve }
  const [value, setValue] = useState('');

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setValue(opts.defaultValue ?? '');
        setState({ opts, resolve });
      }),
    [],
  );

  const opts = state?.opts ?? {};
  const isPrompt = Boolean(opts.prompt);
  const cancelResult = isPrompt ? null : false;

  const settle = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        title={opts.title ?? 'Are you sure?'}
        onClose={() => settle(cancelResult)}
        footer={
          <>
            <Button variant="outline" onClick={() => settle(cancelResult)}>{opts.cancelLabel ?? 'Cancel'}</Button>
            <Button
              variant={opts.tone === 'danger' ? 'danger' : 'primary'}
              disabled={isPrompt && opts.required && !value.trim()}
              onClick={() => settle(isPrompt ? (value.trim() || null) : true)}
            >
              {opts.confirmLabel ?? (opts.tone === 'danger' ? 'Delete' : 'Confirm')}
            </Button>
          </>
        }
      >
        {opts.message && <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{opts.message}</p>}
        {isPrompt && (
          <textarea
            className="textarea"
            style={{ marginTop: 'var(--space-3)', width: '100%' }}
            placeholder={opts.placeholder ?? ''}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
