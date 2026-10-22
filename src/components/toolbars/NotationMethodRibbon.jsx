/**
 * Sticky header ribbon: notation method (T/F/P) → pedagogical A–D → C hand-sign Style.
 * Cascading segments appear only when the parent mode is active.
 */
import React from 'react';
import {
  PEDAGOGICAL_DISPLAY_A,
  PEDAGOGICAL_DISPLAY_B,
  PEDAGOGICAL_DISPLAY_C,
  PEDAGOGICAL_DISPLAY_D,
  normalizePedagogicalDisplayMode,
  isHandSignLyricsDisplayMode,
} from '../../notation/handSigns/pedagogicalDisplayModes';
import {
  HAND_SIGN_SIZE_PERCENT_MIN,
  HAND_SIGN_SIZE_PERCENT_MAX,
  HAND_SIGN_SIZE_PERCENT_STEP,
  HAND_SIGN_CONTRAST_MIN,
  HAND_SIGN_CONTRAST_MAX,
  normalizeHandSignStyle,
} from '../../notation/handSigns/handSignMapping';

const METHOD_OPTIONS = [
  { id: 'traditional', labelKey: 'toolbar.traditional', titleKey: 'toolbar.methodTraditionalHint' },
  { id: 'figurenotes', labelKey: 'toolbar.figurenotes', titleKey: 'toolbar.methodFigurenotesHint' },
  { id: 'vabanotatsioon', labelKey: 'toolbar.vabanotatsioon', titleKey: 'toolbar.methodPedagogicalHint' },
];

const PED_OPTIONS = [
  { id: PEDAGOGICAL_DISPLAY_A, short: 'A', titleKey: 'settings.pedagogicalDisplayA', hintKey: 'toolbar.pedVariantAHint' },
  { id: PEDAGOGICAL_DISPLAY_B, short: 'B', titleKey: 'settings.pedagogicalDisplayB', hintKey: 'toolbar.pedVariantBHint' },
  { id: PEDAGOGICAL_DISPLAY_C, short: 'C', titleKey: 'settings.pedagogicalDisplayC', hintKey: 'toolbar.pedVariantCHint' },
  { id: PEDAGOGICAL_DISPLAY_D, short: 'D', titleKey: 'settings.pedagogicalDisplayD', hintKey: 'toolbar.pedVariantDHint' },
];

function segmentClass() {
  return 'flex flex-wrap items-center gap-1.5 border-r border-amber-400/60 pr-3 mr-1 last:border-r-0 last:pr-0 last:mr-0';
}

function chipClass(active, { disabled = false, accent = 'amber' } = {}) {
  if (disabled) {
    return 'px-2 py-1 rounded-md text-xs font-semibold border bg-amber-50/40 text-amber-400 border-amber-200/60 cursor-not-allowed';
  }
  if (active) {
    if (accent === 'violet') {
      return 'px-2 py-1 rounded-md text-xs font-semibold border bg-violet-600 text-white border-violet-700 shadow-sm';
    }
    return 'px-2 py-1 rounded-md text-xs font-semibold border bg-amber-600 text-white border-amber-700 shadow-sm';
  }
  return 'px-2 py-1 rounded-md text-xs font-semibold border bg-white/90 text-amber-950 border-amber-300 hover:bg-amber-100';
}

function pedHintKey(pedMode) {
  if (pedMode === PEDAGOGICAL_DISPLAY_A) return 'toolbar.pedVariantAHint';
  if (pedMode === PEDAGOGICAL_DISPLAY_B) return 'toolbar.pedVariantBHint';
  if (pedMode === PEDAGOGICAL_DISPLAY_C) return 'toolbar.pedVariantCHint';
  return 'toolbar.pedVariantDHint';
}

export function NotationMethodRibbon({
  t,
  notationMode = 'traditional',
  onNotationModeChange,
  pedagogicalDisplayMode,
  onPedagogicalDisplayModeChange,
  handSignStyle,
  onHandSignStyleChange,
}) {
  const isPedagogical = notationMode === 'vabanotatsioon';
  const pedMode = normalizePedagogicalDisplayMode(pedagogicalDisplayMode);
  const showStyle = isPedagogical && isHandSignLyricsDisplayMode(pedMode);
  const style = normalizeHandSignStyle(handSignStyle);

  const commitStyle = (patch) => {
    onHandSignStyleChange?.(normalizeHandSignStyle({ ...style, ...patch }));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-amber-100/95 border-t border-amber-300/80 text-amber-950"
      role="toolbar"
      aria-label={t('toolbar.methodMode')}
    >
      <div className={segmentClass()}>
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 mr-1">
          {t('toolbar.methodMode')}
        </span>
        {METHOD_OPTIONS.map((opt) => {
          const active = notationMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              title={t(opt.titleKey)}
              aria-pressed={active}
              onClick={() => onNotationModeChange?.(opt.id)}
              className={chipClass(active)}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>

      {isPedagogical && (
        <div className={segmentClass()} title={t('settings.pedagogicalDisplayModeHint')}>
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 mr-1">
            {t('toolbar.pedagogicalVariant')}
          </span>
          {PED_OPTIONS.map((opt) => {
            const active = pedMode === opt.id;
            const title = opt.disabled
              ? t('settings.comingSoon')
              : `${t(opt.titleKey)} — ${t(opt.hintKey)}`;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!!opt.disabled}
                title={title}
                aria-pressed={active}
                onClick={() => {
                  if (opt.disabled) return;
                  onPedagogicalDisplayModeChange?.(opt.id);
                }}
                className={chipClass(active, {
                  disabled: !!opt.disabled,
                  accent: opt.id === PEDAGOGICAL_DISPLAY_D ? 'violet' : 'amber',
                })}
              >
                {opt.short}
              </button>
            );
          })}
          <span
            className="hidden sm:inline text-[10px] text-amber-700/90 max-w-[14rem] truncate ml-1"
            title={t(pedHintKey(pedMode))}
          >
            {t(pedHintKey(pedMode))}
          </span>
        </div>
      )}

      {showStyle && (
        <div className={segmentClass()}>
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 mr-1">
            {t('toolbar.handSignStyle')}
          </span>

          <label className="inline-flex items-center gap-1 text-[10px] text-amber-800" title={t('toolbar.handSignSizeHint')}>
            <span>{t('toolbar.handSignSize')}</span>
            <input
              type="number"
              min={HAND_SIGN_SIZE_PERCENT_MIN}
              max={HAND_SIGN_SIZE_PERCENT_MAX}
              step={HAND_SIGN_SIZE_PERCENT_STEP}
              value={style.sizePercent}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                commitStyle({ sizePercent: n });
              }}
              className="w-14 px-1.5 py-0.5 rounded border border-amber-300 bg-white text-xs font-semibold text-amber-950"
              aria-label={t('toolbar.handSignSize')}
            />
            <span className="font-semibold">%</span>
          </label>
          <input
            type="range"
            min={HAND_SIGN_SIZE_PERCENT_MIN}
            max={HAND_SIGN_SIZE_PERCENT_MAX}
            step={HAND_SIGN_SIZE_PERCENT_STEP}
            value={style.sizePercent}
            onChange={(e) => commitStyle({ sizePercent: Number(e.target.value) })}
            className="w-24 accent-amber-700"
            title={t('toolbar.handSignSizeHint')}
            aria-label={t('toolbar.handSignSize')}
          />

          <label className="inline-flex items-center gap-1 text-[10px] text-amber-800 ml-1" title={t('toolbar.handSignContrastHint')}>
            <span>{t('toolbar.handSignContrast')}</span>
            <span className="text-amber-600">{t('toolbar.handSignContrastThin')}</span>
            <input
              type="range"
              min={HAND_SIGN_CONTRAST_MIN}
              max={HAND_SIGN_CONTRAST_MAX}
              step={0.01}
              value={style.contrast}
              onChange={(e) => commitStyle({ contrast: Number(e.target.value) })}
              className="w-28 accent-amber-700"
              aria-label={t('toolbar.handSignContrast')}
            />
            <span className="text-amber-600">{t('toolbar.handSignContrastThick')}</span>
          </label>

          <label
            className="inline-flex items-center gap-1.5 text-[10px] text-amber-800 ml-2 cursor-pointer"
            title={t('toolbar.handSignDegreeLinesHint')}
          >
            <input
              type="checkbox"
              checked={!!style.showDegreeLines}
              onChange={(e) => commitStyle({ showDegreeLines: !!e.target.checked })}
              className="rounded border-amber-400 text-amber-700"
              aria-label={t('toolbar.handSignDegreeLines')}
            />
            <span className="font-semibold">{t('toolbar.handSignDegreeLines')}</span>
          </label>
        </div>
      )}
    </div>
  );
}

export default NotationMethodRibbon;
