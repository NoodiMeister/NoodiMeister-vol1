import React from 'react';
import { NoteSymbol } from '../notation/NoteSymbols';
import {
  STAFF_SPACE,
  getStaffLinePositions,
  getYFromStaffPosition,
  getLedgerLineCountExact,
  getLedgerHalfWidth,
} from '../notation/StaffConstants';

/**
 * Korduvkasutatav noodi komponent: joonistab noodi automaatselt õigesse kohta joonestikul.
 *
 * Näide: <Note type="quarter" position={2} centerY={100} x={50} />
 *
 * Props:
 *   type: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
 *   position: vertikaalne positsioon (0 = alumine joon, 1 = esimene vahe, 2 = teine joon = G viiulivõtmes, ... 8 = ülemine joon)
 *   x: noodi horisontaalne positsioon (vaikimisi 0)
 *   centerY: joonestiku vertikaalne keskpunkt
 *   staffSpace: ühe vahe kõrgus (vaikimisi STAFF_SPACE)
 *   staffLines: joonte arv (vaikimisi 5)
 *   stemUp: varre suund (vaikimisi automaatne: alla keskmisest joonest, üles keskmisest joonest)
 *   showLedgerLines: kas joonistada abijooned (vaikimisi true)
 */
export function Note({
  type = 'quarter',
  position = 0,
  x = 0,
  centerY,
  staffSpace = STAFF_SPACE,
  staffLines = 5,
  stemUp: stemUpProp,
  showLedgerLines = true,
}) {
  const cy = getYFromStaffPosition(position, centerY, staffLines, staffSpace);
  const lines = getStaffLinePositions(centerY, staffLines, staffSpace);
  const firstLineY = lines[0];
  const lastLineY = lines[lines.length - 1];
  // Stem direction is view-specific; default to up unless explicitly provided.
  const stemUp = stemUpProp ?? true;

  const ledgerHalfWidth = getLedgerHalfWidth(staffSpace);
  const { above: nLedgerAbove, below: nLedgerBelow } = showLedgerLines
    ? getLedgerLineCountExact(cy, firstLineY, lastLineY, staffSpace)
    : { above: 0, below: 0 };

  return (
    <g>
      {nLedgerAbove > 0 &&
        Array.from({ length: nLedgerAbove }, (_, i) => (
          <line
            key={`la-${i}`}
            x1={x - ledgerHalfWidth}
            y1={firstLineY - (i + 1) * staffSpace}
            x2={x + ledgerHalfWidth}
            y2={firstLineY - (i + 1) * staffSpace}
            stroke="#1a1a1a"
            strokeWidth={staffSpace * 0.12}
          />
        ))}
      {nLedgerBelow > 0 &&
        Array.from({ length: nLedgerBelow }, (_, i) => (
          <line
            key={`lb-${i}`}
            x1={x - ledgerHalfWidth}
            y1={lastLineY + (i + 1) * staffSpace}
            x2={x + ledgerHalfWidth}
            y2={lastLineY + (i + 1) * staffSpace}
            stroke="#1a1a1a"
            strokeWidth={staffSpace * 0.12}
          />
        ))}
      <NoteSymbol
        type={type}
        cx={x}
        cy={cy}
        staffSpace={staffSpace}
        stemUp={stemUp}
      />
    </g>
  );
}

export default Note;
