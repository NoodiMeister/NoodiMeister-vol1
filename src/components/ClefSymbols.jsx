import React from 'react';
import { getYFromStaffPosition } from '../notation/StaffConstants';

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
// Autentne täidetud sümbol. Ankurpunkt (G-joon) on y=0 kohal.
// ViewBox on optimeeritud nii, et sümbol ulatub joonestikust nii üles kui alla.
const TREBLE_VIEWBOX_HEIGHT = 38; // path y ≈ -25 … 12
const TREBLE_ANCHOR_X = 15;
const TREBLE_ANCHOR_Y = 0; // G-joon

const TREBLE_CLEF_PATH = [
  'M 10.5 -1.2 c -2.1 0.4 -3.8 1.9 -4.5 3.9 c -0.3 1.1 -0.3 2.8 0.1 3.9 c 0.9 2.7 3.6 4.4 6.7 4.4',
  'c 3.7 0 6.8 -2.4 7.6 -6 c 0.2 -0.9 0.2 -2.5 -0.1 -3.6 c -0.8 -3.1 -3.8 -5.5 -7.4 -6 c -0.8 -0.1 -2 -0.1 -2.4 0',
  'm 2.2 0.7 c 2.5 0.5 4.5 2.5 4.9 5 c 0.2 1.2 0 2.6 -0.6 3.7 c -1.2 2.2 -3.7 3.3 -6.3 2.8',
  'c -2 -0.4 -3.6 -2.1 -4 -4.1 c -0.2 -0.9 -0.1 -2.4 0.3 -3.4 c 0.8 -2.2 3.1 -3.9 5.7 -4 z',
  'M 12.5 12.3 c -5.4 -1.2 -9.5 -5.8 -10 -11.2 c -0.2 -1.9 0.1 -4.1 0.8 -6 c 1.8 -4.9 6.2 -8.5 11.3 -9.2',
  'c 1.1 -0.1 2.9 -0.1 3.8 0 c 4.6 0.7 8.5 3.8 10.2 8.2 c 0.8 2 1.1 3.7 1 5.7 c -0.2 6 -4.1 11 -9.9 12.5',
  'c -1.6 0.4 -5.5 0.4 -7.2 0 z m 6.2 -1.1 c 4.2 -1.2 7.1 -5.1 7.3 -9.4 c 0.1 -1.4 -0.1 -2.9 -0.6 -4.2',
  'c -1.3 -3.4 -4.4 -5.8 -8 -6.3 c -0.9 -0.1 -2.3 -0.1 -3.2 0 c -4.1 0.6 -7.5 3.6 -8.6 7.6',
  'c -0.5 1.7 -0.6 3.5 -0.2 5.2 c 1 4.3 4.8 7.6 9.3 8.1 c 1 0.1 3.1 0 4 0 z',
  'M 15.5 -25 c -1.5 0.5 -2.5 1.5 -3 3 c -0.3 0.8 -0.3 2.5 0 3.5 c 0.5 1.5 1.5 2.5 3 3 c 1 0.3 2.5 0.3 3.5 0',
  'c 1.5 -0.5 2.5 -1.5 3 -3 c 0.3 -0.8 0.3 -2.5 0 -3.5 c -0.5 -1.5 -1.5 -2.5 -3 -3 c -1 -0.3 -2.5 -0.3 -3.5 0 z',
].join(' ');

/**
 * Viiulivõtme sümbol.
 * x, y – asukoht joonestikul (y peab olema 2. joon ehk G-joon).
 * height – sümboli kogukõrgus (tavaliselt staffSpace * 7).
 */
export function TrebleClefSymbol({ x, y, height, fill = 'var(--note-fill, #000)' }) {
  const scale = height / TREBLE_VIEWBOX_HEIGHT;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) translate(${-TREBLE_ANCHOR_X}, ${-TREBLE_ANCHOR_Y})`}>
      <path fill={fill} d={TREBLE_CLEF_PATH} transform="translate(0, 2)" />
    </g>
  );
}

export function StaffTrebleClef({ x, y, height, fill = '#000' }) {
  return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
}

// ——— Bassivõti (F Clef) ———
// F-joon (4. joon ülevalt) on ankurpunkt.
// Sümboli kõht ja punktid peavad asetsema ümber F-joone.
const BASS_CLEF_PATH =
  'M 12.5 -8.5 c -5.5 0 -10 4.5 -10 10 s 4.5 10 10 10 c 2.5 0 4.8 -1 6.5 -2.5 l -1.5 -1.5 c -1.2 1.2 -3 2 -5 2 c -4.4 0 -8 -3.6 -8 -8 s 3.6 -8 8 -8 c 3.5 0 6.5 2.3 7.6 5.5 h 2.2 c -1.2 -4.4 -5.2 -7.5 -9.8 -7.5 z';

/**
 * Bassivõtme sümbol.
 * x, y – asukoht (y peab olema joonestiku 4. joon ehk F-joon).
 * height – sümboli kõrgus (tavaliselt staffSpace * 3.5).
 * staffSpace – joonte vahe (px); kui ei anta, arvutatakse height/3.5 põhjal.
 */
export function BassClefSymbol({ x, y, height, fill = 'var(--note-fill, #000)', staffSpace: staffSpaceProp }) {
  const staffSpace = staffSpaceProp ?? height / 3.5;
  const scale = height / 25; // Pathi algne kõrgus on u 25 ühikut

  const dotRadius = staffSpace * 0.15;
  const dotX = x + staffSpace * 1.4;

  return (
    <g className="bass-clef">
      {/* Bassivõtme "koma" kujund */}
      <g transform={`translate(${x}, ${y}) scale(${scale}) translate(-5, -10)`}>
        <path fill={fill} d={BASS_CLEF_PATH} />
      </g>

      {/* Kaks punkti ümber F-joone (4. joone) */}
      <circle cx={dotX} cy={y - staffSpace / 2} r={dotRadius} fill={fill} />
      <circle cx={dotX} cy={y + staffSpace / 2} r={dotRadius} fill={fill} />
    </g>
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
