import React from 'react';
import { getYFromStaffPosition } from '../notation/StaffConstants';

/** JO-võtme sümboli kõrgus (ühikutes); aken on y 32–48, keskpunkt 40. */
const JO_CLEF_HEIGHT = 80;
const JO_CLEF_WINDOW_CENTER_Y = 40;
/**
 * JO-võti (JO-LE-MI notatsioon).
 * Täpne SVG: vasak vertikaalne tulp, kaks musta ristkülikut; nende vahele jääb tühi aken (JO-noodi koht).
 * Abijooned joonestatakse sama joon/vahe reegli järgi nagu nootide puhul. Kui firstLineY/lastLineY on antud,
 * joonistatakse abijooned täpselt joonestiku pikendusena (ülemine joon − staffSpace, alumine joon + staffSpace).
 */
export function JoClefSymbol({
  x = 0,
  centerY,
  staffSpacing = 10,
  stroke = '#000',
  ledgerLinesAbove = 0,
  ledgerLinesBelow = 0,
  firstLineY,
  lastLineY,
}) {
  const scale = (staffSpacing * 4) / JO_CLEF_HEIGHT;
  const ledgerLength = Math.max(4, staffSpacing * 1.4);
  const ledgerStrokeW = 1.2;
  const useStaffGrid = typeof firstLineY === 'number' && typeof lastLineY === 'number';

  const ledgerYAbove = useStaffGrid
    ? (i) => firstLineY - (i + 1) * staffSpacing
    : (i) => centerY - staffSpacing / 2 - (i + 1) * staffSpacing;
  const ledgerYBelow = useStaffGrid
    ? (i) => lastLineY + (i + 1) * staffSpacing
    : (i) => centerY + staffSpacing / 2 + (i + 1) * staffSpacing;

  return (
    <g className="jo-clef">
      {/* Sümbol: tulp + kaks kasti, nende vahel 16px tühi aken. Aken keskpunkt = centerY. */}
      <g
        transform={`translate(${x}, ${centerY}) scale(${scale}) translate(0, -${JO_CLEF_WINDOW_CENTER_Y})`}
        fill={stroke}
      >
        {/* Vasak vertikaalne tulp */}
        <rect x={0} y={0} width={12} height={80} />
        {/* Ülemine kast */}
        <rect x={15} y={0} width={40} height={32} />
        {/* Alumine kast – nende vahele jääb 16px tühi aken */}
        <rect x={15} y={48} width={40} height={32} />
      </g>
      {/* Abijooned: sama ruudustikuga mis nootide puhul (nokk/aken jääb abijoone alla või vahele). */}
      {Array.from({ length: ledgerLinesAbove }, (_, i) => (
        <line
          key={`la-${i}`}
          x1={x + 12 * scale}
          y1={ledgerYAbove(i)}
          x2={x + 12 * scale + ledgerLength}
          y2={ledgerYAbove(i)}
          stroke={stroke}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: ledgerLinesBelow }, (_, i) => (
        <line
          key={`lb-${i}`}
          x1={x + 12 * scale}
          y1={ledgerYBelow(i)}
          x2={x + 12 * scale + ledgerLength}
          y2={ledgerYBelow(i)}
          stroke={stroke}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ——— Viiulivõti (Treble Clef) ———
// Standardne SVG path; G-joon (2. joon ülevalt) on ankurpunktis y=55. ViewBox 0 -5 40 90.
const TREBLE_VIEWBOX_HEIGHT = 90;
const TREBLE_ANCHOR_X = 15;
const TREBLE_G_LINE_Y = 55;

const TREBLE_CLEF_PATH =
  'M 15 55 C 25 55 30 45 30 35 C 30 15 15 5 15 25 C 15 45 35 45 35 25 C 35 5 20 -5 10 15 C 0 35 15 65 15 65 L 15 85';

/**
 * Viiulivõtme sümbol. x,y = G-joone (2. joon) positsioon; height = sümboli kõrgus (nt staffSpace * 6).
 * Must, terav, professionaalne.
 */
export function TrebleClefSymbol({ x, y, height, fill = '#000' }) {
  const scale = height / TREBLE_VIEWBOX_HEIGHT;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) translate(${-TREBLE_ANCHOR_X}, ${-TREBLE_G_LINE_Y})`}>
      <path fill={fill} d={TREBLE_CLEF_PATH} />
    </g>
  );
}

export function StaffTrebleClef({ x, y, height, fill = '#000' }) {
  return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
}

// ——— Bassivõti (F Clef) ———
// F-joon (4. joon) on ankurpunkt. Kaks punkti asuvad 4. joone kohal ja all vahedes (y ± halfSpace).
// F-võtme põhikuju: vertikaalsed jooned ja kurv; viewBox keskpunkt F real.
const BASS_VIEWBOX = 24;
const BASS_F_LINE_Y = 12;

// Bassivõtme põhikuju: kaks vertikaalset joont F-joone ümber (viewBox 0 0 24 24, F = 12)
const BASS_CLEF_PATH =
  'M9.8 4v16c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1zm4.4 0v16c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1z';

/**
 * Bassivõtme sümbol. x,y = F-joone (4. joon) Y-positsioon.
 * Kaks punkti joonistatakse täpselt 4. joone kohal ja all vahedes (staffSpace/2).
 * staffSpace = joonte vahe (px); vaikimisi 10.
 */
export function BassClefSymbol({ x, y, height, fill = '#000', staffSpace = 10 }) {
  const scale = height / BASS_VIEWBOX;
  const halfSpace = staffSpace / 2;
  const dotRadius = Math.max(1.2, staffSpace * 0.16);
  const dotCenterXLeft = x - 4 * scale;
  const dotCenterXRight = x + 4 * scale;
  return (
    <g fill={fill}>
      <g transform={`translate(${x}, ${y}) scale(${scale}) translate(-12, -${BASS_F_LINE_Y})`}>
        <path d={BASS_CLEF_PATH} />
      </g>
      {/* Kaks punkti: 4. joone kohal ja all vahedes */}
      <ellipse cx={dotCenterXLeft} cy={y - halfSpace} rx={dotRadius} ry={dotRadius * 1.1} />
      <ellipse cx={dotCenterXRight} cy={y - halfSpace} rx={dotRadius} ry={dotRadius * 1.1} />
      <ellipse cx={dotCenterXLeft} cy={y + halfSpace} rx={dotRadius} ry={dotRadius * 1.1} />
      <ellipse cx={dotCenterXRight} cy={y + halfSpace} rx={dotRadius} ry={dotRadius * 1.1} />
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
  ledgerLinesAbove = 0,
  ledgerLinesBelow = 0,
}) {
  const joY = getYFromStaffPosition(joPosition, centerY, staffLines, staffSpace);
  return (
    <JoClefSymbol
      x={x}
      centerY={joY}
      staffSpacing={staffSpace}
      stroke={stroke}
      ledgerLinesAbove={ledgerLinesAbove}
      ledgerLinesBelow={ledgerLinesBelow}
    />
  );
}
