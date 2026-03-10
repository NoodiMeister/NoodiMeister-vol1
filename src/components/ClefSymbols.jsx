import React from 'react';
import { getYFromStaffPosition } from '../notation/StaffConstants';
import { getGlyphFontSize } from '../notation/musescoreStyle';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH } from '../notation/smufl/glyphs';

/**
 * JO-võtme sümbol (Pedagoogiline notatsioon) – Eesti pedagoogiline meetod.
 * Ehitus: 4 musta triipu – 2 vertikaalset (vahe = noodijoonte vahe), 2 horisontaalset
 * teise vertikaali keskel (vahe = noodijoonte vahe). Do-noot asub horisontaalsete vahel.
 *
 * API: kas (x, y, height, fill) või tagasiühilduvus (x, centerY, staffSpacing, stroke).
 * Valikuline: ledgerLinesAbove, ledgerLinesBelow, firstLineY, lastLineY.
 */
const JO_CLEF_HEIGHT = 80; // full height in local units
const JO_CLEF_STRIPE_V = 6; // vertical stripe thickness (1st: 0–6, 2nd: 15–21)
const JO_CLEF_2ND_VERTICAL_X = 15; // 2nd vertical starts at x=15 (gap 6–15)
const JO_CLEF_VERTICALS_WIDTH = JO_CLEF_2ND_VERTICAL_X + JO_CLEF_STRIPE_V; // 21 – right edge of 2nd vertical
const JO_CLEF_STRIPE_H = 5; // horizontal stripe height (upper 30–35, lower 45–50)
const JO_CLEF_TOP_H_Y = 30; // top horizontal stripe y (30–35)
const JO_CLEF_BOTTOM_H_Y = 45; // bottom horizontal stripe y (45–50)
const JO_CLEF_HORIZONTAL_LENGTH = 32; // horizontal stripes extend right
const JO_CLEF_WIDTH = JO_CLEF_VERTICALS_WIDTH + JO_CLEF_HORIZONTAL_LENGTH; // 53

/** Opposite of default note fill: white on light theme, black on dark (for inverted JO-clef). */
const JO_CLEF_INVERTED_FILL = 'var(--jo-clef-inverted, #ffffff)';

/** Pixel width of JO-clef when drawn with given staffSpace (for drawing staff/Do lines on top). */
export function getJoClefPixelWidth(staffSpace) {
  return JO_CLEF_WIDTH * (staffSpace * 4 / JO_CLEF_HEIGHT);
}

/** Extra Do (C) stripe: short stripe, NOT a full staff line. In clef local coords: start x=50, length 25. */
export const JO_CLEF_DO_STRIPE_START_X = 50;
export const JO_CLEF_DO_STRIPE_LENGTH = 25;

/** Pixel start X and length for the extra Do stripe (clef left + start*scale, length*scale). */
export function getJoClefDoStripeBounds(clefX, staffSpace) {
  const scale = (staffSpace * 4) / JO_CLEF_HEIGHT;
  const startPx = clefX + JO_CLEF_DO_STRIPE_START_X * scale;
  const lengthPx = JO_CLEF_DO_STRIPE_LENGTH * scale;
  return { startX: startPx, endX: startPx + lengthPx };
}

export function JoClefSymbol({
  x = 0,
  y: yProp,
  height: heightProp,
  fill = 'var(--note-fill, #000)',
  centerY,
  staffSpacing,
  stroke,
  inverted = false,
  ledgerLinesAbove = 0,
  ledgerLinesBelow = 0,
  firstLineY,
  lastLineY,
}) {
  const y = yProp ?? centerY;
  const height = heightProp ?? (typeof staffSpacing === 'number' ? staffSpacing * 4 : JO_CLEF_HEIGHT);
  const baseColor = stroke ?? fill;
  const color = inverted ? (stroke ?? JO_CLEF_INVERTED_FILL) : baseColor;
  const spacing = staffSpacing ?? height / 4;

  const scale = height / JO_CLEF_HEIGHT;

  const useStaffGrid = typeof firstLineY === 'number' && typeof lastLineY === 'number';
  const ledgerYAbove = useStaffGrid
    ? (i) => firstLineY - (i + 1) * spacing
    : (i) => y - (i + 1) * spacing;
  const ledgerYBelow = useStaffGrid
    ? (i) => lastLineY + (i + 1) * spacing
    : (i) => y + (i + 1) * spacing;

  const ledgerLength = Math.max(4, spacing * 1.4);
  const ledgerStrokeW = 1.2;

  return (
    <g className="jo-clef">
      <g transform={`translate(${x}, ${y}) scale(${scale}) translate(0, ${-JO_CLEF_HEIGHT / 2})`}>
        {/* 1. Vasak vertikaalne triip (0–6) */}
        <rect x={0} y={0} width={JO_CLEF_STRIPE_V} height={JO_CLEF_HEIGHT} fill={color} />
        {/* 2. Parem vertikaalne triip (15–21) */}
        <rect x={JO_CLEF_2ND_VERTICAL_X} y={0} width={JO_CLEF_STRIPE_V} height={JO_CLEF_HEIGHT} fill={color} />
        {/* 3. Ülemine horisontaalset triip (30–35) */}
        <rect x={JO_CLEF_VERTICALS_WIDTH} y={JO_CLEF_TOP_H_Y} width={JO_CLEF_HORIZONTAL_LENGTH} height={JO_CLEF_STRIPE_H} fill={color} />
        {/* 4. Alumine horisontaalset triip (45–50) */}
        <rect x={JO_CLEF_VERTICALS_WIDTH} y={JO_CLEF_BOTTOM_H_Y} width={JO_CLEF_HORIZONTAL_LENGTH} height={JO_CLEF_STRIPE_H} fill={color} />
      </g>
      {Array.from({ length: ledgerLinesAbove }, (_, i) => (
        <line
          key={`la-${i}`}
          x1={x + JO_CLEF_WIDTH * scale}
          y1={ledgerYAbove(i)}
          x2={x + JO_CLEF_WIDTH * scale + ledgerLength}
          y2={ledgerYAbove(i)}
          stroke={color}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: ledgerLinesBelow }, (_, i) => (
        <line
          key={`lb-${i}`}
          x1={x + JO_CLEF_WIDTH * scale}
          y1={ledgerYBelow(i)}
          x2={x + JO_CLEF_WIDTH * scale + ledgerLength}
          y2={ledgerYBelow(i)}
          stroke={color}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ——— Viiulivõti (Treble Clef) U+E050 ———
// Leland: y = G-joone asukoht (altpoolt teine noodijoon). Nihutusega viime spiraali keskpunkti täpselt selle joonega ühtima.

export function TrebleClefSymbol({
  x,
  y,
  staffSpace: staffSpaceProp,
  height,
  fill = 'black',
}) {
  const staffSpace = staffSpaceProp ?? (height != null ? height / 4 : 10);
  const fontSize = getGlyphFontSize(staffSpace); // MuseScore/SMuFL: 4 sp
  const spiralAlignDy = staffSpace * 0.35; // Leland gClef: spiraal veidi allapoole glyph keskpunktist
  return (
    <SmuflGlyph
      x={x}
      y={y + spiralAlignDy}
      glyph={SMUFL_GLYPH.gClef}
      fontSize={fontSize}
      fill={fill}
      dominantBaseline="middle"
    />
  );
}

/**
 * Viiulivõti joonestikul. x tagab vähemalt staffSpace veerise vasakust äärest.
 * y = G-joone asukoht (altpoolt teine noodijoon). Leland: fontSize = staffSpace * 4.
 */
export function StaffTrebleClef({ x, y, height, staffSpace, fill = '#000' }) {
  const space = staffSpace ?? (height != null ? height / 4 : 10);
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

// ——— Bassivõti (Bass Clef) U+E062 ———
// Leland: y = F-joone asukoht (neljas noodijoon ülevalt). Põhiosa ja punktid ümber selle joone.

export function BassClefSymbol({
  x,
  y,
  staffSpace: staffSpaceProp,
  height,
  fill = 'var(--note-fill, #000)',
}) {
  const staffSpace = staffSpaceProp ?? (height != null ? height / 4 : 10);
  const fontSize = getGlyphFontSize(staffSpace); // MuseScore/SMuFL: 4 sp
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={SMUFL_GLYPH.fClef}
      fontSize={fontSize}
      fill={fill}
      dominantBaseline="middle"
    />
  );
}

/**
 * JO-võti joonestikul (pedagoogiline notatsioon).
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
