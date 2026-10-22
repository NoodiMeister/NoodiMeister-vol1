import React, { useEffect, useRef } from 'react';

/**
 * MuseScore-stiilis takti kontekstimenüü (paremklikk).
 */
export function MeasureContextMenu({
  x,
  y,
  open,
  onClose,
  labels = {},
  canCopy = false,
  canPaste = false,
  onMeasureProperties,
  onInsertBefore,
  onInsertAfter,
  onDelete,
  onCopy,
  onPaste,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const item = (key, label, onClick, disabled = false) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      className={`w-full text-left px-3 py-2 text-sm ${
        disabled
          ? 'text-amber-400/50 cursor-not-allowed'
          : 'text-amber-950 hover:bg-amber-100'
      }`}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        onClose?.();
      }}
    >
      {label}
    </button>
  );

  const sep = (key) => <div key={key} className="border-t border-amber-200 my-1" />;

  const left = Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 220));
  const top = Math.max(8, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 280));

  return (
    <div
      ref={rootRef}
      className="fixed z-[200] min-w-[200px] rounded-lg border-2 border-amber-300 bg-white shadow-xl py-1"
      style={{ left, top }}
      role="menu"
    >
      {item('props', labels.properties || 'Taktiomadused…', onMeasureProperties)}
      {sep('s1')}
      {item('before', labels.insertBefore || 'Lisa takt enne', onInsertBefore)}
      {item('after', labels.insertAfter || 'Lisa takt pärast', onInsertAfter)}
      {item('del', labels.delete || 'Kustuta takt(id)', onDelete)}
      {sep('s2')}
      {item('copy', labels.copy || 'Kopeeri', onCopy, !canCopy)}
      {item('paste', labels.paste || 'Kleebi', onPaste, !canPaste)}
    </div>
  );
}

export default MeasureContextMenu;
