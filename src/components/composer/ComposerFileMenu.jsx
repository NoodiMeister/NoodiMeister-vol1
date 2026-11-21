import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Save, User } from 'lucide-react';

/**
 * Kujundaja Fail-menüü (noodigraafika File-menüü analoog):
 * Uus fail, Salvesta (pilv, sama fileId või create new), Mine minu kontole.
 */
export default function ComposerFileMenu({
  labels,
  saveLabel,
  onNewFile,
  onSave,
  onSaveLocal,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-slate-600 text-white shadow-md hover:bg-slate-500 border border-slate-700/50"
        title={labels.menuTitle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Save className="w-4 h-4" />
        {labels.menu}
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 min-w-[220px] py-1 rounded-lg bg-slate-700 border border-slate-600 shadow-xl z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onNewFile?.();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
            title={labels.newTitle}
          >
            <Plus className="w-4 h-4" /> {labels.newFile}
          </button>
          <div className="my-1 border-t border-slate-600" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onSave?.();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
            title={labels.saveTitle}
          >
            <Save className="w-4 h-4" /> {saveLabel || labels.save}
          </button>
          {typeof onSaveLocal === 'function' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onSaveLocal();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
            >
              <Save className="w-4 h-4" /> {labels.saveLocal}
            </button>
          )}
          <div className="my-1 border-t border-slate-600" />
          <Link
            to="/konto"
            role="menuitem"
            onClick={close}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-50 hover:bg-slate-600"
          >
            <User className="w-4 h-4" /> {labels.goToAccount}
          </Link>
        </div>
      )}
    </div>
  );
}
