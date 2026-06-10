import React from 'react';
import { COMPOSER_TEXT_PRESETS } from '../../document/composerDocumentModel';

const PRESET_KEYS = Object.keys(COMPOSER_TEXT_PRESETS);

function ToggleBtn({ active, onClick, title, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-semibold border transition-colors ${active
        ? 'bg-amber-600 text-white border-amber-700'
        : 'bg-white dark:bg-zinc-800 text-amber-900 dark:text-white border-amber-200 dark:border-white/20 hover:bg-amber-50 dark:hover:bg-white/10'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function ComposerWritingToolbar({
  activeBlock,
  pendingTextStyle,
  onPendingTextStyleChange,
  onPatchBlock,
  disabled,
}) {
  const isText = activeBlock?.type === 'text';
  const styleKey = isText ? (activeBlock.textStyle || 'body') : (pendingTextStyle || 'body');

  const patchOrPending = (patch) => {
    if (isText && onPatchBlock) onPatchBlock(patch);
  };

  const setPreset = (key) => {
    if (isText && onPatchBlock) {
      const preset = COMPOSER_TEXT_PRESETS[key];
      if (!preset) return;
      onPatchBlock({
        textStyle: key,
        name: preset.label,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        fontStyle: preset.fontStyle,
        textDecoration: preset.textDecoration,
        align: preset.align,
        color: preset.color,
        lineHeight: preset.lineHeight,
        width: Math.max(activeBlock.width || 0, preset.defaultWidth),
      });
    } else if (onPendingTextStyleChange) {
      onPendingTextStyleChange(key);
    }
  };

  const toggleBold = () => {
    if (!isText) return;
    const next = activeBlock.fontWeight >= 600 ? 400 : 700;
    patchOrPending({ fontWeight: next });
  };

  const toggleItalic = () => {
    if (!isText) return;
    const next = activeBlock.fontStyle === 'italic' ? 'normal' : 'italic';
    patchOrPending({ fontStyle: next });
  };

  const toggleUnderline = () => {
    if (!isText) return;
    const next = activeBlock.textDecoration === 'underline' ? 'none' : 'underline';
    patchOrPending({ textDecoration: next });
  };

  const setAlign = (align) => {
    if (isText) patchOrPending({ align });
  };

  const setFontSize = (e) => {
    if (!isText) return;
    const num = Number(e.target.value);
    if (Number.isFinite(num) && num >= 8 && num <= 96) {
      patchOrPending({ fontSize: num });
    }
  };

  const setColor = (e) => {
    if (!isText) return;
    patchOrPending({ color: e.target.value });
  };

  if (disabled) return null;

  return (
    <div className="rounded-xl border border-amber-200/70 dark:border-white/20 bg-white/90 dark:bg-zinc-900 px-3 py-2 flex flex-wrap items-center gap-2 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200 mr-1">
        Tekst
      </span>

      <select
        value={styleKey}
        onChange={(e) => setPreset(e.target.value)}
        className="px-2 py-1 rounded border border-amber-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-sm text-amber-900 dark:text-white min-w-[140px]"
        title="Teksti stiil (nagu Google Docs)"
      >
        {PRESET_KEYS.map((key) => (
          <option key={key} value={key}>{COMPOSER_TEXT_PRESETS[key].label}</option>
        ))}
      </select>

      <div className="w-px h-6 bg-amber-200 dark:bg-white/20" aria-hidden="true" />

      <ToggleBtn
        active={isText && activeBlock.fontWeight >= 600}
        onClick={toggleBold}
        title="Paks (Bold)"
        className="w-8"
      >
        B
      </ToggleBtn>
      <ToggleBtn
        active={isText && activeBlock.fontStyle === 'italic'}
        onClick={toggleItalic}
        title="Kaldkiri (Italic)"
        className="w-8 italic"
      >
        I
      </ToggleBtn>
      <ToggleBtn
        active={isText && activeBlock.textDecoration === 'underline'}
        onClick={toggleUnderline}
        title="Allajoonitud"
        className="w-8 underline"
      >
        U
      </ToggleBtn>

      <div className="w-px h-6 bg-amber-200 dark:bg-white/20" aria-hidden="true" />

      <label className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-white/80" title="Fondi suurus">
        <span className="sr-only">Fondi suurus</span>
        <input
          type="number"
          min={8}
          max={96}
          step={1}
          value={isText ? (activeBlock.fontSize || 14) : (COMPOSER_TEXT_PRESETS[styleKey]?.fontSize || 14)}
          onChange={setFontSize}
          disabled={!isText}
          className="w-14 px-1.5 py-1 rounded border border-amber-200 dark:border-white/20 bg-white dark:bg-zinc-800 text-sm disabled:opacity-50"
        />
        <span>pt</span>
      </label>

      <input
        type="color"
        value={isText ? (activeBlock.color || '#111827') : (COMPOSER_TEXT_PRESETS[styleKey]?.color || '#111827')}
        onChange={setColor}
        disabled={!isText}
        title="Teksti värv"
        className="w-8 h-8 rounded border border-amber-200 dark:border-white/20 p-0.5 cursor-pointer disabled:opacity-50"
      />

      <div className="w-px h-6 bg-amber-200 dark:bg-white/20" aria-hidden="true" />

      <ToggleBtn
        active={isText && activeBlock.align === 'left'}
        onClick={() => setAlign('left')}
        title="Joonda vasakule"
      >
        ≡
      </ToggleBtn>
      <ToggleBtn
        active={isText && activeBlock.align === 'center'}
        onClick={() => setAlign('center')}
        title="Joonda keskele"
      >
        ≡
      </ToggleBtn>
      <ToggleBtn
        active={isText && activeBlock.align === 'right'}
        onClick={() => setAlign('right')}
        title="Joonda paremale"
      >
        ≡
      </ToggleBtn>

      {!isText && (
        <span className="text-xs text-amber-700/80 dark:text-white/60 ml-1">
          Vali tekstiplokk või lülitu „Kirjuta“ tööriistale
        </span>
      )}
    </div>
  );
}
