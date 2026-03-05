import React from 'react';
import { STAFF_SPACE } from './StaffConstants';

/**
 * Kasutame ühtset värvi muutujat, mis toetab teemasid.
 */
const DEFAULT_FILL = 'var(--note-fill, #1a1a1a)';

/** Täispaus (Whole Rest): Rippuv ristkülik 4. joone all. */
export function WholeRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  const w = staffSpace * 1.2;
  const h = staffSpace * 0.5; // Täispaus on tegelikult pool staff-space'i paks
  return (
    <rect
      x={x - w / 2}
      y={y}
      width={w}
      height={h}
      fill={DEFAULT_FILL}
    />
  );
}

/** Poolpaus (Half Rest): Seisev ristkülik 3. joone peal. */
export function HalfRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  const w = staffSpace * 1.2;
  const h = staffSpace * 0.5;
  return (
    <rect
      x={x - w / 2}
      y={y - h}
      width={w}
      height={h}
      fill={DEFAULT_FILL}
    />
  );
}

/** Veerandpaus (Quarter Rest): MuseScore'i stiilis "siksak" sabaga. */
export function QuarterRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  const s = staffSpace;
  // Keeruline path, mis imiteerib klassikalist veerandpausi kuju
  const d = `
    M ${x - s * 0.4} ${y - s * 1.5}
    L ${x + s * 0.3} ${y - s * 0.5}
    L ${x - s * 0.2} ${y + s * 0.3}
    C ${x - s * 0.5} ${y + s * 0.6} ${x - s * 0.2} ${y + s * 1.2} ${x + s * 0.2} ${y + s * 1.4}
    C ${x + s * 0.1} ${y + s * 1.1} ${x - s * 0.1} ${y + s * 0.9} ${x - s * 0.1} ${y + s * 0.6}
    L ${x + s * 0.4} ${y - s * 0.3}
    L ${x - s * 0.1} ${y - s * 1.3}
    Z
  `;
  return <path d={d} fill={DEFAULT_FILL} />;
}

/** Kaheksandikpaus (Eighth Rest): Klassikaline "nupp" ja kaldjalg. */
export function EighthRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  const s = staffSpace;
  // Nupp (pea) ja kumer vars
  const d = `
    M ${x - s * 0.3} ${y - s * 0.5}
    a ${s * 0.2} ${s * 0.2} 0 1 1 ${s * 0.1} ${s * 0.3}
    c ${s * 0.3} 0 ${s * 0.5} ${s * 0.5} ${s * 0.7} ${s * 1.5}
    l ${s * 0.1} ${-s * 0.1}
    c ${-s * 0.3} ${-s * 1.2} ${-s * 0.7} ${-s * 1.5} ${-s * 1.2} ${-s * 1.7}
    Z
  `;
  return <path d={d} fill={DEFAULT_FILL} />;
}

/** Kuueteistkümnendikpaus (Sixteenth Rest): Kahe nupuga versioon. */
export function SixteenthRestSymbol({ x = 0, y = 0, staffSpace = STAFF_SPACE }) {
  const s = staffSpace;
  return (
    <g>
      {/* Ülemine nupp ja osa varrest */}
      <EighthRestSymbol x={x} y={y - s * 0.5} staffSpace={staffSpace} />
      {/* Alumine nupp */}
      <path
        d={`
        M ${x - s * 0.5} ${y + s * 0.2}
        a ${s * 0.18} ${s * 0.18} 0 1 1 ${s * 0.1} ${s * 0.3}
        L ${x + s * 0.3} ${y + s * 0.8}
        Z
      `}
        fill={DEFAULT_FILL}
      />
    </g>
  );
}

const REST_SYMBOLS = {
  whole: WholeRestSymbol,
  half: HalfRestSymbol,
  quarter: QuarterRestSymbol,
  eighth: EighthRestSymbol,
  sixteenth: SixteenthRestSymbol,
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
