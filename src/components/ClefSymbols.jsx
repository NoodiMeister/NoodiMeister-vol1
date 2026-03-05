import React from 'react';
import { getYFromStaffPosition } from '../notation/StaffConstants';

/**
 * JO-võti (JO-LE-MI notatsioon).
 * Geomeetriliselt täpne: vertikaalne tüvi + kaks horisontaalset haara.
 * Aken (haarade vahe) = täpselt ÜKS staff-space. centerY on selle vahe keskpunkt;
 * JO asub selle vahe sees, ülejäänud noodid (RE, MI, ...) asetsevad getVerticalPosition() järgi.
 * Kasuta StaffJoClef, et keskmine tühi osa ümbritseks alati seda joonestiku vahet, kus on JO-noot.
 *
 * Props: x, centerY, staffSpacing, stroke, strokeWidth, barLength, verticalWidth,
 *        showLedgerLine, ledgerLinesAbove, ledgerLinesBelow
 */
export function JoClefSymbol({
  x = 0,
  centerY,
  staffSpacing = 10,
  stroke = '#000',
  strokeWidth = 2,
  barLength = 14,
  verticalWidth = 4,
  showLedgerLine = true,
  ledgerLinesAbove = 0,
  ledgerLinesBelow = 0,
}) {
  const halfSpace = staffSpacing / 2;
  const topBarY = centerY - halfSpace;
  const bottomBarY = centerY + halfSpace;
  const vertTop = centerY - staffSpacing * 1.5;
  const vertBottom = centerY + staffSpacing * 1.5;
  const t = strokeWidth;
  const ledgerLength = Math.max(4, barLength - verticalWidth - 2);
  const ledgerStrokeW = 1.2;

  return (
    <g>
      <rect x={x} y={vertTop} width={verticalWidth} height={vertBottom - vertTop} fill={stroke} />
      <rect x={x} y={topBarY - t / 2} width={barLength} height={t} fill={stroke} />
      <rect x={x} y={bottomBarY - t / 2} width={barLength} height={t} fill={stroke} />
      {showLedgerLine && (
        <line
          x1={x + verticalWidth}
          y1={centerY}
          x2={x + verticalWidth + ledgerLength}
          y2={centerY}
          stroke={stroke}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      )}
      {Array.from({ length: ledgerLinesAbove }, (_, i) => (
        <line
          key={`la-${i}`}
          x1={x + verticalWidth}
          y1={topBarY - (i + 1) * staffSpacing}
          x2={x + verticalWidth + ledgerLength}
          y2={topBarY - (i + 1) * staffSpacing}
          stroke={stroke}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: ledgerLinesBelow }, (_, i) => (
        <line
          key={`lb-${i}`}
          x1={x + verticalWidth}
          y1={bottomBarY + (i + 1) * staffSpacing}
          x2={x + verticalWidth + ledgerLength}
          y2={bottomBarY + (i + 1) * staffSpacing}
          stroke={stroke}
          strokeWidth={ledgerStrokeW}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// Viiulivõtme viewBox: 0 0 24 24. G-joon (teine joon) = y=12 (keskpunkt).
// Path on koostatud nii, et alumine paun keerdub G-joone (y≈12) ümber; ankurdatud joonestiku suhtes.
const TREBLE_VIEWBOX = 24;
const TREBLE_G_LINE_Y = 12;

// Viiulivõtme path (fill). Referents: musictheoryacademy treble clef; alumine silmus G-joone ümber.
// 24×24 viewBox, G-joon y=12.
const TREBLE_CLEF_PATH =
  'M14 2.2c-.2 0-.4 0-.6.1-.5.2-.9.6-1.1 1.1-.2.5-.1 1 .2 1.4.3.4.8.6 1.3.6.4 0 .8-.2 1.1-.5.3-.3.4-.7.4-1.1 0-.1 0-.2-.1-.3V5.2c0-.4.2-.7.5-.9.3-.2.7-.2 1 0 .3.2.5.5.5.9v12.2c0 .5.4.9.9.9.5 0 .9-.4.9-.9V3.8c0-.5-.4-.9-.9-.9-.3 0-.6.1-.8.3-.2.2-.3.5-.3.8v1.2c0 .3.2.6.5.7.3.1.6 0 .8-.3.2-.3.2-.6 0-.9l.1-10.5c0-.2-.1-.4-.2-.5-.2-.2-.4-.3-.7-.3z';

/**
 * Viiulivõtme sümbol noodijoonestikul. Ankurdatud G-jooni (teine joon ülevalt) suhtes.
 * Kõht (belly) ümbritseb täpselt teist joont. x, y = G-jooni Y-positsioon;
 * height tuleb staff-space'ist (nt staffSpace * 6), et sümbol skaleeruks joonestikuga.
 */
export function TrebleClefSymbol({ x, y, height, fill = '#333' }) {
  const scale = height / TREBLE_VIEWBOX;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) translate(-12, -${TREBLE_G_LINE_Y})`}>
      <path fill={fill} d={TREBLE_CLEF_PATH} />
    </g>
  );
}

/**
 * Ühine noodijoonestiku viiulivõti – kasutab TrebleClefSymbolit (G-joon ankurdatud).
 */
export function StaffTrebleClef({ x, y, height, fill = '#333' }) {
  return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
}

/**
 * JO-võti joonestikul: dünaamiline – keskmine tühi osa ümbritseb alati seda vahet, kus on JO-noot.
 * joPosition = noodi positsioon (0=alumine joon, 1=esimene vahe, 2=teine joon, ... 8=ülemine joon).
 * centerY = joonestiku vertikaalne keskpunkt; staffSpace = ühe vahe kõrgus.
 */
export function StaffJoClef({
  x = 0,
  centerY,
  staffSpace = 10,
  joPosition = 2,
  staffLines = 5,
  stroke = '#000',
  strokeWidth,
  barLength,
  verticalWidth,
  showLedgerLine = true,
  ledgerLinesAbove = 0,
  ledgerLinesBelow = 0,
}) {
  const joY = getYFromStaffPosition(joPosition, centerY, staffLines, staffSpace);
  const defaultStrokeW = Math.max(1.2, staffSpace * 0.2);
  const defaultBarLength = staffSpace * 1.4;
  const defaultVertWidth = staffSpace * 0.4;
  return (
    <JoClefSymbol
      x={x}
      centerY={joY}
      staffSpacing={staffSpace}
      stroke={stroke}
      strokeWidth={strokeWidth ?? defaultStrokeW}
      barLength={barLength ?? defaultBarLength}
      verticalWidth={verticalWidth ?? defaultVertWidth}
      showLedgerLine={showLedgerLine}
      ledgerLinesAbove={ledgerLinesAbove}
      ledgerLinesBelow={ledgerLinesBelow}
    />
  );
}
