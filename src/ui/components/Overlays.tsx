import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { handKeyLabel } from '../../stats/stats';
import { ACTION_LABEL } from '../../strategy/explain';
import ctl from './Controls.module.css';
import styles from './Panels.module.css';

export function Toast() {
  const toast = useGame((s) => s.toast);
  const dismiss = useGame((s) => s.dismissToast);
  const undo = useGame((s) => s.undo);
  const canUndo = useGame((s) => s.undoSnapshot !== null);
  useEffect(() => {
    if (toast?.kind !== 'info') return;
    const t = setTimeout(dismiss, 3000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  return (
    <div className={styles.toastWrap} aria-live="assertive">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={clsx(styles.toast, toast.kind === 'mistake' && styles.toastMistake)}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role={toast.kind === 'mistake' ? 'alert' : 'status'}
          >
            {toast.kind === 'mistake' && <span aria-hidden>✗</span>}
            <p>{toast.text}</p>
            {toast.undoable && canUndo && (
              <button type="button" onClick={undo}>
                Undo
              </button>
            )}
            <button type="button" onClick={dismiss}>
              {toast.kind === 'mistake' ? 'Got it' : 'OK'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  actions,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={ref}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
        <div className={styles.modalActions}>
          {actions ?? (
            <button type="button" className={clsx(ctl.btn, ctl.primary)} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** End-of-shoe review in test mode. */
export function ReviewModal() {
  const review = useGame((s) => s.review);
  const close = useGame((s) => s.closeReview);
  if (!review) return null;
  return (
    <Modal
      title={`Shoe review · ${review.length} mistake${review.length === 1 ? '' : 's'}`}
      onClose={close}
    >
      <ul style={{ paddingLeft: 18, margin: '8px 0 0', display: 'grid', gap: 8 }}>
        {review.map((m, i) => (
          <li key={i}>
            <b>{handKeyLabel(m.decision.handKey)}</b>: you chose {ACTION_LABEL[m.decision.chosen]},
            best was <b>{ACTION_LABEL[m.best.action]}</b>.{' '}
            <span style={{ color: 'var(--text-muted)' }}>{m.best.explanation}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
