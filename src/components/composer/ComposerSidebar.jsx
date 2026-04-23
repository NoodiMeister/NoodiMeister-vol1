import React from 'react';

export default function ComposerSidebar({
  blocks,
  onUploadProject,
  onUploadComposer,
  onAddText,
  onAddPage,
  onSelectBlock,
  activeBlockId,
  toolMode,
  onToolModeChange,
}) {
  return (
    <aside className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-4 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
        Lehekoostaja
      </h2>
      <div className="grid gap-2">
        <button type="button" onClick={onUploadProject} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500">
          Lisa .nm / .json projekt
        </button>
        <button type="button" onClick={onUploadComposer} className="px-3 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-amber-900 dark:text-white text-sm font-medium hover:bg-amber-100 dark:hover:bg-white/10">
          Ava .nmc projekt
        </button>
        <button type="button" onClick={onAddText} className="px-3 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-amber-900 dark:text-white text-sm font-medium hover:bg-amber-100 dark:hover:bg-white/10">
          Lisa tekstikast
        </button>
        <button type="button" onClick={onAddPage} className="px-3 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-amber-900 dark:text-white text-sm font-medium hover:bg-amber-100 dark:hover:bg-white/10">
          Lisa uus leht
        </button>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">Tööriistad</h3>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onToolModeChange('move')}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${toolMode === 'move' ? 'bg-amber-600 text-white border-amber-700' : 'border-amber-300 dark:border-white/30 text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
          >
            Liiguta / vali
          </button>
          <button
            type="button"
            onClick={() => onToolModeChange('scissor-v')}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${toolMode === 'scissor-v' ? 'bg-amber-600 text-white border-amber-700' : 'border-amber-300 dark:border-white/30 text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
          >
            Käärid vertikaal
          </button>
          <button
            type="button"
            onClick={() => onToolModeChange('scissor-h')}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${toolMode === 'scissor-h' ? 'bg-amber-600 text-white border-amber-700' : 'border-amber-300 dark:border-white/30 text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
          >
            Käärid horisontaal
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200 mb-2">Plokid lehel</h3>
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {blocks.length === 0 && (
            <p className="text-xs text-amber-700/80 dark:text-white/70">Plokke veel pole.</p>
          )}
          {blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelectBlock(block.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${activeBlockId === block.id
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-white/70 dark:bg-zinc-800 border-amber-200/70 dark:border-white/20 text-amber-800 dark:text-white/90'
              }`}
            >
              {block.name || 'Untitled block'}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
