import React from 'react';
import { STAFF_SPACE } from './StaffConstants';

/**
 * Kõik pausid on proportsioonis staff-space ühikuga.
 * x, y = pausi vertikaalne keskpunkt (või ankurpunkt, kus dokumenteeritud).
 */

/** Täispaus: täidetud ristkülik, kõrgus 1 staff-space, laius ~1,5 staff-space. Asub neljanda joone all. */
export function WholeRestSymbol({
  x = 0,
  y = 0,
  staffSpace = STAFF_SPACE,
  fill = '#1a1a1a',
}) {
  const w = staffSpace * 1.5;
  const h = staffSpace;
  return (
    <rect
      x={x}
      y={y - h / 2}
      width={w}
      height={h}
      fill={fill}
      rx={staffSpace * 0.08}
    />
  );
}

/** Poolpaus: sama kujuga kui täispaus, asub kolmanda joone peal. */
export function HalfRestSymbol({
  x = 0,
  y = 0,
  staffSpace = STAFF_SPACE,
  fill = '#1a1a1a',
}) {
  const w = staffSpace * 1.5;
  const h = staffSpace;
  return (
    <rect
      x={x}
      y={y - h / 2}
      width={w}
      height={h}
      fill={fill}
      rx={staffSpace * 0.08}
    />
  );
}

/**
 * Veerandpaus: tagurpidi Z + C-kujuline kurv, kõrgus ~3,5 staff-space.
 * Path lähendab standardse veerandpausi kuju.
 */
export function QuarterRestSymbol({
  x = 0,
  y = 0,
  staffSpace = STAFF_SPACE,
  stroke = '#1a1a1a',
  strokeWidth = null,
}) {
  const s = staffSpace;
  const w = s * 0.9;
  const h = s * 3.5;
  const sw = strokeWidth ?? s * 0.18;
  // Tagurpidi Z + alumine konks; keskpunkt y
  const x0 = x;
  const x1 = x + w;
  const y0 = y - h / 2;
  const y1 = y + h / 2;
  const d = [
    `M ${x1} ${y0}`,
    `C ${x0} ${y0} ${x0} ${y} ${x1} ${y}`,
    `C ${x0} ${y} ${x0} ${y1} ${x1} ${y1}`,
  ].join(' ');
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * Kaheksandikpaus: konks (tagurpidi 7) + punkt konksu all, kõrgus ~2,5 staff-space.
 */
export function EighthRestSymbol({
  x = 0,
  y = 0,
  staffSpace = STAFF_SPACE,
  fill = '#1a1a1a',
  stroke = '#1a1a1a',
}) {
  const s = staffSpace;
  const h = s * 2.5;
  const dotR = s * 0.2;
  const sw = s * 0.16;
  const y0 = y - h / 2;
  const y1 = y + h / 2;
  const x1 = x + s * 0.55;
  const pathD = `M ${x1} ${y0} L ${x} ${y} Q ${x1} ${y} ${x1} ${y1}`;
  return (
    <g>
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x1} cy={y1 + dotR} r={dotR} fill={fill} />
    </g>
  );
}

/**
 * Kuueteistkümnendikpaus: kaks paralleelset konksu koos punktidega, kõrgus ~2,5 staff-space.
 */
export function SixteenthRestSymbol({
  x = 0,
  y = 0,
  staffSpace = STAFF_SPACE,
  fill = '#1a1a1a',
  stroke = '#1a1a1a',
}) {
  const s = staffSpace;
  const h = s * 2.5;
  const step = s * 0.5;
  const sw = s * 0.16;
  const dotR = s * 0.18;
  const x1 = x + s * 0.55;
  const elements = [];
  for (let i = 0; i < 2; i++) {
    const y0 = y - h / 2 + i * step;
    const yEnd = y0 + step;
    const yMid = y0 + step * 0.5;
    const pathD = `M ${x1} ${y0} L ${x} ${yMid} Q ${x} ${yEnd} ${x1} ${yEnd}`;
    elements.push(
      <path
        key={i}
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
    elements.push(<circle key={`d-${i}`} cx={x1} cy={yEnd + dotR} r={dotR} fill={fill} />);
  }
  return <g>{elements}</g>;
}

const REST_SYMBOLS = {
  whole: WholeRestSymbol,
  half: HalfRestSymbol,
  quarter: QuarterRestSymbol,
  eighth: EighthRestSymbol,
  sixteenth: SixteenthRestSymbol,
};

/**
 * Ühtne pausisümbol valitud tüübiga.
 * type: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
 */
export function RestSymbol({
  type,
  x = 0,
  y = 0,
  staffSpace = STAFF_SPACE,
  fill = '#1a1a1a',
  stroke = '#1a1a1a',
}) {
  const Symbol = REST_SYMBOLS[type] || QuarterRestSymbol;
  return (
    <Symbol
      x={x}
      y={y}
      staffSpace={staffSpace}
      fill={fill}
      stroke={stroke}
    />
  );
}

export default RestSymbol;
