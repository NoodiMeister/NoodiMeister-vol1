/**
 * ClefToolbox – noodivõtme valija (eraldi komponent; põhirakenduses on samad valikud tööriistakastis „Noodivõtmed“).
 * Viiulivõti ja bassivõti on vaikimisi nähtavad; JO on pedagoogilises režiimis.
 */
import React from 'react';
import { useNotationOptional } from '../store/NotationContext';
import { JoClefSymbol, TrebleClefSymbol, BassClefSymbol } from '../components/ClefSymbols';

const boxSize = 56;
const center = boxSize / 2;

export function ClefToolbox({
  notationMode = 'traditional',
  currentClef: currentClefProp,
  setCurrentClef: setCurrentClefProp,
  className = '',
  ...rest
}) {
  const ctx = useNotationOptional();
  const fromContext = ctx?.clefType != null && ctx?.setClefType != null;
  const currentClef = currentClefProp ?? ctx?.clefType ?? 'treble';
  const setCurrentClef = setCurrentClefProp ?? ctx?.setClefType ?? (() => {});

  const handleClef = (clef) => {
    setCurrentClef(clef);
  };

  const isActive = (clef) => currentClef === clef;

  return (
    <div
      className={`clef-selector grid grid-cols-2 gap-2 ${className}`}
      role="group"
      aria-label="Noodivõtmed"
      {...rest}
    >
      <button
        type="button"
        onClick={() => handleClef('treble')}
        aria-pressed={isActive('treble')}
        aria-label="Viiulivõti"
        className={`min-w-[56px] min-h-[56px] rounded-lg flex flex-col items-center justify-center gap-0.5 p-2 transition-all border-2 ${isActive('treble') ? 'border-[var(--primary-color)] bg-amber-100 shadow-md active' : 'border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300'}`}
      >
        <svg viewBox={`0 0 ${boxSize} ${boxSize}`} className="w-12 h-12 shrink-0 text-amber-900" aria-hidden="true">
          <TrebleClefSymbol x={center} y={center} height={36} fill="currentColor" />
        </svg>
        <span className="text-xs font-medium text-amber-900 truncate max-w-full">Viiulivõti</span>
      </button>

      <button
        type="button"
        onClick={() => handleClef('bass')}
        aria-pressed={isActive('bass')}
        aria-label="Bassivõti"
        className={`min-w-[56px] min-h-[56px] rounded-lg flex flex-col items-center justify-center gap-0.5 p-2 transition-all border-2 ${isActive('bass') ? 'border-[var(--primary-color)] bg-amber-100 shadow-md active' : 'border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300'}`}
      >
        <svg viewBox={`0 0 ${boxSize} ${boxSize}`} className="w-12 h-12 shrink-0 text-amber-900" aria-hidden="true">
          <BassClefSymbol x={center} y={center} height={28} fill="currentColor" staffSpace={6} />
        </svg>
        <span className="text-xs font-medium text-amber-900 truncate max-w-full">Bassivõti</span>
      </button>

      {notationMode === 'pedagogical' && (
        <button
          type="button"
          onClick={() => handleClef('jo')}
          aria-pressed={isActive('jo')}
          aria-label="JO-võti"
          className={`min-w-[56px] min-h-[56px] rounded-lg flex flex-col items-center justify-center gap-0.5 p-2 transition-all border-2 col-span-2 ${isActive('jo') ? 'border-[var(--primary-color)] bg-amber-100 shadow-md active' : 'border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300'}`}
        >
          <svg viewBox={`0 0 ${boxSize} ${boxSize}`} className="w-12 h-12 shrink-0 text-amber-900" aria-hidden="true">
            <JoClefSymbol x={8} centerY={center} staffSpacing={6} stroke="currentColor" />
          </svg>
          <span className="text-xs font-medium text-amber-900 truncate max-w-full">JO-võti</span>
        </button>
      )}
    </div>
  );
}
