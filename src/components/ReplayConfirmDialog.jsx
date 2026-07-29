import { useEffect, useRef } from 'react';

export default function ReplayConfirmDialog({
  open,
  title,
  onConfirm,
  onCancel,
  fallbackFocusRef,
}) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const fallbackFocus = fallbackFocusRef?.current;
    confirmRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll('button:not(:disabled)') || [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const previous = returnFocusRef.current;
      if (previous && document.contains(previous)) previous.focus();
      else fallbackFocus?.focus();
    };
  }, [fallbackFocusRef, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="level-replay-dialog-backdrop"
      data-testid="level-replay-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="level-replay-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-replay-dialog-title"
        data-testid="level-replay-dialog"
      >
        <h2 id="level-replay-dialog-title">{title}</h2>
        <p>进入重玩模式后，可自由选择任意已完成关卡。通关记录不会清除。</p>
        <div className="level-replay-dialog-actions">
          <button
            ref={confirmRef}
            type="button"
            className="level-replay-confirm"
            data-testid="level-replay-confirm"
            onClick={onConfirm}
          >
            进入重玩
          </button>
          <button
            type="button"
            className="level-replay-cancel"
            data-testid="level-replay-cancel"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
