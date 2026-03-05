import React from 'react';
import {
  STAFF_SPACE,
  getNoteheadRx,
  getNoteheadRy,
  getStemLength,
  getFlagHeight,
  getFlagWidth,
} from './StaffConstants';

const TILT_DEG = 24; // Noodipea kaldenurk (kraadi)

/**
 * Üksik noodipea (ovaal) – kasutatakse kõigil nooditüüpidel.
 * Kõrgus = 1 staff-space (2*ry), laius ≈ 1.4 staff-space (2*rx).
 */
function NoteHeadShape({ cx, cy, staffSpace, filled, stemUp }) {
  const rx = getNoteheadRx(staffSpace);
  const ry = getNoteheadRy(staffSpace);
  const tiltDeg = stemUp ? -TILT_DEG : TILT_DEG;
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill={filled ? '#1a1a1a' : 'none'}
      stroke="#1a1a1a"
      strokeWidth={filled ? 0 : Math.max(0.8, staffSpace * 0.12)}
      transform={`rotate(${tiltDeg} ${cx} ${cy})`}
    />
  );
}

/**
 * Vars: vertikaalne joon noodipea küljest kuni varre otsani.
 * stemUp = true → vars ülespoole; false → allapoole.
 */
function Stem({ cx, cy, staffSpace, stemUp }) {
  const rx = getNoteheadRx(staffSpace);
  const stemLen = getStemLength(staffSpace);
  const x = stemUp ? cx + rx : cx - rx;
  const y2 = stemUp ? cy - stemLen : cy + stemLen;
  return (
    <line
      x1={x}
      y1={cy}
      x2={x}
      y2={y2}
      stroke="#1a1a1a"
      strokeWidth={staffSpace * 0.12}
      strokeLinecap="round"
    />
  );
}

/**
 * Üks lipp (kaheksandiknoot): varre otsast paremale kumer kurv.
 * Kaks lippu (kuueteistkümnendik): kaks paralleelset kurvi.
 */
function Flags({ cx, cy, staffSpace, stemUp, count = 1 }) {
  const rx = getNoteheadRx(staffSpace);
  const stemLen = getStemLength(staffSpace);
  const fh = getFlagHeight(staffSpace);
  const fw = getFlagWidth(staffSpace);
  const strokeW = staffSpace * 0.14;
  const stemX = stemUp ? cx + rx : cx - rx;
  const stemEndY = stemUp ? cy - stemLen : cy + stemLen;
  const direction = stemUp ? 1 : -1;
  const elements = [];
  const step = staffSpace * 0.5;
  for (let i = 0; i < count; i++) {
    const y0 = stemEndY + i * step * direction;
    const x1 = stemX + fw * (stemUp ? 1 : -1);
    const y1 = y0 + fh * direction;
    // Lipp: varre otsast kumer kurv välja (paremale ülespoole / vasakule allapoole)
    const d = `M ${stemX} ${y0} Q ${x1} ${y0} ${x1} ${y1}`;
    elements.push(
      <path
        key={i}
        d={d}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
    );
  }
  return <g>{elements}</g>;
}

/**
 * Täisnoot: seest tühi ovaal, ilma varreta.
 */
export function WholeNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE }) {
  return (
    <g>
      <NoteHeadShape cx={cx} cy={cy} staffSpace={staffSpace} filled={false} stemUp={true} />
    </g>
  );
}

/**
 * Poolnoot: seest tühi ovaal + vars.
 */
export function HalfNoteSymbol({
  cx = 0,
  cy = 0,
  staffSpace = STAFF_SPACE,
  stemUp = true,
}) {
  return (
    <g>
      <NoteHeadShape cx={cx} cy={cy} staffSpace={staffSpace} filled={false} stemUp={stemUp} />
      <Stem cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} />
    </g>
  );
}

/**
 * Veerandnoot: täidetud ovaal + vars.
 */
export function QuarterNoteSymbol({
  cx = 0,
  cy = 0,
  staffSpace = STAFF_SPACE,
  stemUp = true,
}) {
  return (
    <g>
      <NoteHeadShape cx={cx} cy={cy} staffSpace={staffSpace} filled={true} stemUp={stemUp} />
      <Stem cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} />
    </g>
  );
}

/**
 * Kaheksandiknoot: täidetud ovaal + vars + üks lipp.
 */
export function EighthNoteSymbol({
  cx = 0,
  cy = 0,
  staffSpace = STAFF_SPACE,
  stemUp = true,
}) {
  return (
    <g>
      <NoteHeadShape cx={cx} cy={cy} staffSpace={staffSpace} filled={true} stemUp={stemUp} />
      <Stem cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} />
      <Flags cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} count={1} />
    </g>
  );
}

/**
 * Kuueteistkümnendiknoot: täidetud ovaal + vars + kaks lippu.
 */
export function SixteenthNoteSymbol({
  cx = 0,
  cy = 0,
  staffSpace = STAFF_SPACE,
  stemUp = true,
}) {
  return (
    <g>
      <NoteHeadShape cx={cx} cy={cy} staffSpace={staffSpace} filled={true} stemUp={stemUp} />
      <Stem cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} />
      <Flags cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} count={2} />
    </g>
  );
}

const NOTE_SYMBOLS = {
  whole: WholeNoteSymbol,
  half: HalfNoteSymbol,
  quarter: QuarterNoteSymbol,
  eighth: EighthNoteSymbol,
  sixteenth: SixteenthNoteSymbol,
};

/**
 * Ühtne nootisümbol valitud tüübiga.
 * type: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
 */
export function NoteSymbol({ type, cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true }) {
  const Symbol = NOTE_SYMBOLS[type] || QuarterNoteSymbol;
  return (
    <Symbol
      cx={cx}
      cy={cy}
      staffSpace={staffSpace}
      stemUp={type === 'whole' ? true : stemUp}
    />
  );
}

export default NoteSymbol;
