import React from 'react';
import { RestSymbol } from '../notation/RestSymbols';
import {
  STAFF_SPACE,
  getStaffLinePositions,
  getYFromStaffPosition,
} from '../notation/StaffConstants';

/**
 * Korduvkasutatav pausi komponent: joonistab pausi õigesse kohta joonestikul.
 *
 * Näide: <Rest type="quarter" x={80} centerY={100} />
 *
 * Props:
 *   type: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtySecond'
 *   x: horisontaalne positsioon (vaikimisi 0)
 *   centerY: joonestiku vertikaalne keskpunkt (pausi vertikaalne keskpunkt arvutatakse sellest)
 *   staffSpace: ühe vahe kõrgus (vaikimisi STAFF_SPACE)
 *   staffLines: joonte arv (vaikimisi 5)
 *   position: vertikaalne positsioon (vaikimisi 4 = joonestiku keskkoha lähedal). Täis- ja poolpausi puhul määrab, kus plokk asub.
 */
export function Rest({
  type = 'quarter',
  x = 0,
  centerY,
  staffSpace = STAFF_SPACE,
  staffLines = 5,
  position,
  fill = '#1a1a1a',
  stroke = '#1a1a1a',
}) {
  const lines = getStaffLinePositions(centerY, staffLines, staffSpace);
  let y;
  if (position != null) {
    y = getYFromStaffPosition(position, centerY, staffLines, staffSpace);
  } else {
    if (type === 'whole') {
      y = lines[1] + staffSpace / 2;
    } else if (type === 'half') {
      y = lines[2] - staffSpace / 2;
    } else {
      y = centerY;
    }
  }

  return (
    <RestSymbol
      type={type}
      x={x}
      y={y}
      staffSpace={staffSpace}
      fill={fill}
      stroke={stroke}
    />
  );
}

export default Rest;
