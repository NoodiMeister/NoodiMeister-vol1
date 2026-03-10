import React from 'react';
import { STAFF_SPACE } from './StaffConstants';
import { getRestFontSize } from './musescoreStyle';
import { SmuflGlyph } from './smufl/SmuflGlyph';
import { SMUFL_GLYPH } from './smufl/glyphs';

/**
 * Kasutame ühtset värvi muutujat, mis toetab teemasid.
 */
const DEFAULT_FILL = 'var(--note-fill, #1a1a1a)';

/** Rest glyph font size – MuseScore/SMuFL (4 sp). */
function restFontSize(staffSpace) {
  return getRestFontSize(staffSpace);
}

/** Täispaus (Whole Rest) – SMuFL restWhole. */
export function WholeRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.restWhole}
      fontSize={restFontSize(staffSpace)}
      fill={DEFAULT_FILL}
    />
  );
}

/** Poolpaus (Half Rest) – SMuFL restHalf. */
export function HalfRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.restHalf}
      fontSize={restFontSize(staffSpace)}
      fill={DEFAULT_FILL}
    />
  );
}

/** Veerandpaus (Quarter Rest) – SMuFL restQuarter. */
export function QuarterRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.restQuarter}
      fontSize={restFontSize(staffSpace)}
      fill={DEFAULT_FILL}
    />
  );
}

/** Kaheksandikpaus (Eighth Rest) – SMuFL rest8th. */
export function EighthRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.rest8th}
      fontSize={restFontSize(staffSpace)}
      fill={DEFAULT_FILL}
    />
  );
}

/** Kuueteistkümnendikpaus (Sixteenth Rest) – SMuFL rest16th. */
export function SixteenthRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.rest16th}
      fontSize={restFontSize(staffSpace)}
      fill={DEFAULT_FILL}
    />
  );
}

/** Kuuskümnendikpaus (32nd Rest) – SMuFL rest32nd (Leland). */
export function ThirtySecondRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.rest32nd}
      fontSize={restFontSize(staffSpace)}
      fill={DEFAULT_FILL}
    />
  );
}

const REST_SYMBOLS = {
  whole: WholeRestSymbol,
  half: HalfRestSymbol,
  quarter: QuarterRestSymbol,
  eighth: EighthRestSymbol,
  sixteenth: SixteenthRestSymbol,
  thirtySecond: ThirtySecondRestSymbol,
};

export function RestSymbol({ type, x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  const Symbol = REST_SYMBOLS[type] || QuarterRestSymbol;
  return (
    <g className="music-rest">
      <Symbol x={x} y={y} staffSpace={staffSpace} />
    </g>
  );
}

export default RestSymbol;
