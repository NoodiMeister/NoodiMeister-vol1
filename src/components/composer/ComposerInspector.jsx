import React from 'react';

export default function ComposerInspector({ activeBlock, onPatchBlock, onDeleteBlock }) {
  if (!activeBlock) {
    return (
      <aside className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-4">
        <p className="text-sm text-amber-800/90 dark:text-white/80">Vali plokk, et muuta omadusi.</p>
      </aside>
    );
  }

  const patchNumber = (field) => (e) => {
    const num = Number(e.target.value);
    onPatchBlock({ [field]: Number.isFinite(num) ? num : 0 });
  };

  return (
    <aside className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
        Ploki seaded
      </h2>
      <label className="block text-xs text-amber-800 dark:text-white/80">
        Nimi
        <input
          value={activeBlock.name || ''}
          onChange={(e) => onPatchBlock({ name: e.target.value })}
          className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-amber-800 dark:text-white/80">X
          <input type="number" value={Math.round(activeBlock.x || 0)} onChange={patchNumber('x')} className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm" />
        </label>
        <label className="text-xs text-amber-800 dark:text-white/80">Y
          <input type="number" value={Math.round(activeBlock.y || 0)} onChange={patchNumber('y')} className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm" />
        </label>
        <label className="text-xs text-amber-800 dark:text-white/80">Laius
          <input type="number" value={Math.round(activeBlock.width || 0)} onChange={patchNumber('width')} className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm" />
        </label>
        <label className="text-xs text-amber-800 dark:text-white/80">Kõrgus
          <input type="number" value={Math.round(activeBlock.height || 0)} onChange={patchNumber('height')} className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm" />
        </label>
      </div>
      <button
        type="button"
        onClick={onDeleteBlock}
        className="w-full px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium"
      >
        Kustuta plokk
      </button>
    </aside>
  );
}
