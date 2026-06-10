import React from 'react';
import {
  COMPOSER_LAYER_BACKGROUND,
  COMPOSER_LAYER_FOREGROUND,
  COMPOSER_TEXT_PRESETS,
  getComposerBlockLayer,
  isComposerTextBlock,
} from '../../document/composerDocumentModel';

export default function ComposerInspector({ activeBlock, onPatchBlock, onDeleteBlock }) {
  if (!activeBlock) {
    return (
      <aside className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-4">
        <p className="text-sm text-amber-800/90 dark:text-white/80">
          Vali plokk, et muuta omadusi. Teksti jaoks kasuta „Kirjuta“ tööriista või topeltklõpsu.
        </p>
      </aside>
    );
  }

  const patchNumber = (field) => (e) => {
    const num = Number(e.target.value);
    onPatchBlock({ [field]: Number.isFinite(num) ? num : 0 });
  };

  const isText = isComposerTextBlock(activeBlock);

  return (
    <aside className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
        {isText ? 'Teksti seaded' : 'Ploki seaded'}
      </h2>

      {isText && (
        <>
          <label className="block text-xs text-amber-800 dark:text-white/80">
            Tekst
            <textarea
              value={activeBlock.text || ''}
              onChange={(e) => onPatchBlock({ text: e.target.value })}
              rows={4}
              className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm resize-y"
              placeholder={COMPOSER_TEXT_PRESETS[activeBlock.textStyle]?.placeholder || 'Kirjuta siia…'}
            />
          </label>
          <label className="block text-xs text-amber-800 dark:text-white/80">
            Stiil
            <select
              value={activeBlock.textStyle || 'body'}
              onChange={(e) => {
                const preset = COMPOSER_TEXT_PRESETS[e.target.value];
                if (!preset) return;
                onPatchBlock({
                  textStyle: e.target.value,
                  name: preset.label,
                  fontSize: preset.fontSize,
                  fontWeight: preset.fontWeight,
                  fontStyle: preset.fontStyle,
                  textDecoration: preset.textDecoration,
                  align: preset.align,
                  color: preset.color,
                  lineHeight: preset.lineHeight,
                });
              }}
              className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm"
            >
              {Object.entries(COMPOSER_TEXT_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {!isText && (
        <>
          <label className="block text-xs text-amber-800 dark:text-white/80">
            Nimi
            <input
              value={activeBlock.name || ''}
              onChange={(e) => onPatchBlock({ name: e.target.value })}
              className="mt-1 w-full px-2 py-1.5 rounded border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-800 text-sm"
            />
          </label>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-800 dark:text-white/80">Kiht</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPatchBlock({ layer: COMPOSER_LAYER_BACKGROUND })}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border ${getComposerBlockLayer(activeBlock) === COMPOSER_LAYER_BACKGROUND
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'border-amber-300 dark:border-white/30 hover:bg-amber-50 dark:hover:bg-white/10'
                }`}
              >
                Taust
              </button>
              <button
                type="button"
                onClick={() => onPatchBlock({ layer: COMPOSER_LAYER_FOREGROUND })}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border ${getComposerBlockLayer(activeBlock) === COMPOSER_LAYER_FOREGROUND
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'border-amber-300 dark:border-white/30 hover:bg-amber-50 dark:hover:bg-white/10'
                }`}
              >
                Esiplaan
              </button>
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-white/55">
              Taustakiht jääb teksti alla — kasulik lõigatud kujundite paigutamisel tekstilehtedele.
            </p>
          </div>
        </>
      )}

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
