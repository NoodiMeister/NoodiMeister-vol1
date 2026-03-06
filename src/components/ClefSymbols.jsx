import React from 'react';
import { getYFromStaffPosition } from '../notation/StaffConstants';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH } from '../notation/smufl/glyphs';

/**
 * JO-võtme sümbol (Vabanotatsioon).
 * Ehitus: Vasakul paks tulp, paremal kaks kasti, keskel tühi aken.
 *
 * API: kas (x, y, height, fill) või tagasiühilduvus (x, centerY, staffSpacing, stroke).
 * Valikuline: ledgerLinesAbove, ledgerLinesBelow, firstLineY, lastLineY.
 */
const JO_CLEF_WIDTH = 55;
const JO_CLEF_HEIGHT = 80;
const JO_CLEF_WINDOW_HEIGHT = 16; // Akna kõrgus, kuhu JO-noot "lukustub"

export function JoClefSymbol({
  x = 0,
  y: yProp,
  height: heightProp,
  fill = 'var(--note-fill, #000)',
  centerY,
  staffSpacing,
  stroke,
  ledgerLinesAbove = 0,
  ledgerLinesBelow = 0,
  firstLineY,
  lastLineY,
}) {
  const y = yProp ?? centerY;
  const height = heightProp ?? (typeof staffSpacing === 'number' ? staffSpacing * 4 : JO_CLEF_HEIGHT);
  const color = stroke ?? fill;
  const spacing = staffSpacing ?? height / 4;

  const scale = height / JO_CLEF_HEIGHT;
  const boxHeight = (JO_CLEF_HEIGHT - JO_CLEF_WINDOW_HEIGHT) / 2;

  const useStaffGrid = typeof firstLineY === 'number' && typeof lastLineY === 'number';
  const ledgerYAbove = useStaffGrid
    ? (i) => firstLineY - (i + 1) * spacing
    : (i) => y - (i + 1) * spacing;
  const ledgerYBelow = useStaffGrid
    ? (i) => lastLineY + (i + 1) * spacing
    : (i) => y + (i + 1) * spacing;

  const ledgerLength = Math.max(4, spacing * 1.4);
  const ledgerStrokeW = 1.2;
  const tulpWidth = 12;

  return (
    <g className="jo-clef">
      <g transform={`translate(${x}, ${y}) scale(${scale}) translate(0, ${-JO_CLEF_HEIGHT / 2})`}>
        {/* 1. Vasak paks tulp */}
        <rect x={0} y={0} width={tulpWidth} height={JO_CLEF_HEIGHT} fill={color} />

        {/* 2. Ülemine kast */}
        <rect x={15} y={0} width={40} height={boxHeight} fill={color} />

        {/* 3. Alumine kast (jätab keskele tühja akna) */}
        <rect x={15} y={boxHeight + JO_CLEF_WINDOW_HEIGHT} width={40} height={boxHeight} fill={color} />
      </g>
      {Array.from({ length: ledgerLinesAbove }, (_, i) => (
        <line
          key={`la-${i}`}
          x1={x + tulpWidth * scale}
          y1={ledgerYAbove(i)}
          x2={x + tulpWidth * scale + ledgerLength}
          y2={ledgerYAbove(i)}
          stroke={color}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: ledgerLinesBelow }, (_, i) => (
        <line
          key={`lb-${i}`}
          x1={x + tulpWidth * scale}
          y1={ledgerYBelow(i)}
          x2={x + tulpWidth * scale + ledgerLength}
          y2={ledgerYBelow(i)}
          stroke={color}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ——— Viiulivõti (Treble Clef) ———
// Ankurpunkt: y = G-joone asukoht (teine joon alt üles = 3*staffSpace kui ülemine joon on 0).

export function TrebleClefSymbol({
  x,
  y,
  staffSpace: staffSpaceProp,
  height,
  fill = 'black',
}) {
  const staffSpace = staffSpaceProp ?? (height != null ? height / 7 : 10);
  const fontSize = height ?? staffSpace * 7;
  // SMuFL: gClef glyph. We keep the same +0.5 staffSpace visual nudge.
  return (
    <SmuflGlyph
      x={x}
      y={y + staffSpace * 0.5}
      glyph={SMUFL_GLYPH.gClef}
      fontSize={fontSize}
      fill={fill}
    />
  );
}

/**
 * Viiulivõti joonestikul. x tagab vähemalt staffSpace veerise vasakust äärest
 * (ei puutu kokku takti algusjoonega). y peab olema G-joone asukoht (3*staffSpace kui ülemine joon = 0).
 */
export function StaffTrebleClef({ x, y, height, staffSpace, fill = '#000' }) {
  const space = staffSpace ?? (height != null ? height / 7 : 10);
  const xSafe = Math.max(x ?? 0, space);
  return (
    <TrebleClefSymbol
      x={xSafe}
      y={y}
      staffSpace={space}
      height={height}
      fill={fill}
    />
  );
}

export function BassClefSymbol({
  x,
  y,
  staffSpace: staffSpaceProp,
  height,
  fill = 'var(--note-fill, #000)',
}) {
  const staffSpace = staffSpaceProp ?? (height != null ? height / 3.5 : 10);
  const fontSize = height ?? staffSpace * 3.5;
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.fClef}
      fontSize={fontSize}
      fill={fill}
    />
  );
}

/**
 * JO-võti joonestikul (vabanotatsioon).
 * JO-võtme aken asub täpselt joonestiku joonel või vahel vastavalt joPosition.
 */
export function StaffJoClef({
  x = 0,
  centerY,
  staffSpace = 10,
  joPosition = 2,
  staffLines = 5,
  stroke = '#000',
}) {
  const joY = getYFromStaffPosition(joPosition, centerY, staffLines, staffSpace);
  const height = staffSpace * 4;
  return (
    <JoClefSymbol
      x={x}
      y={joY}
      height={height}
      fill={stroke}
    />
  );
}
