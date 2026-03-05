import React from 'react';

/**
 * SVG noodipea (ovaal), kergelt kaldu nagu päris noodikirjas.
 * Mõõdud tuletatakse staff-space'ist; noot asub täpselt joone peal või vahes.
 *
 * Props: cx, cy, staffSpace, filled, stemUp, stroke, selected
 */
const DEFAULT_STAFF_SPACE = 10;

export function NoteHead({
  cx = 0,
  cy = 0,
  staffSpace = DEFAULT_STAFF_SPACE,
  filled = true,
  stemUp = true,
  stroke = 'none',
  strokeWidth = 0,
  fill = '#1a1a1a',
  selected = false,
}) {
  const rx = staffSpace * 0.7;  // sama suhe nagu getNoteheadRx
  const ry = staffSpace * 0.5;  // sama suhe nagu getNoteheadRy
  const tiltDeg = stemUp ? -24 : 24;
  const transform = `rotate(${tiltDeg} ${cx} ${cy})`;
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill={filled ? fill : 'none'}
      stroke={selected ? '#2563eb' : stroke}
      strokeWidth={selected ? 2 : strokeWidth}
      transform={transform}
    />
  );
}

export default NoteHead;
