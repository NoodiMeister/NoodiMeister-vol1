/**
 * Rütmi tööriistakast: visuaalsed sümbolid (noodid, pausid, rütmipatternid).
 * Figurenotes režiimis: rütmi pikkust näidatakse hallide klotsidena (1× = 1/4, 2× = 1/2 jne).
 * Traditional: uses the same NoteSymbols and RestSymbols as the symbol gallery.
 */
import React from 'react';
import {
  WholeNoteSymbol,
  HalfNoteSymbol,
  QuarterNoteSymbol,
  EighthNoteSymbol,
  SixteenthNoteSymbol,
  ThirtySecondNoteSymbol,
} from '../notation/NoteSymbols';
import {
  WholeRestSymbol,
  HalfRestSymbol,
  QuarterRestSymbol,
  EighthRestSymbol,
  SixteenthRestSymbol,
  ThirtySecondRestSymbol,
} from '../notation/RestSymbols';

const FIGURE_BLOCK_GRAY = '#9ca3af';

/** Staff space for rhythm toolbox icons – small so they fit in the button. */
const ICON_STAFF_SPACE = 5;
const ICON_VIEW = 24;

/** Vältuse kordaja võrreldes veerandnoodiga (1/4 = 1, 1/2 = 2, 1/1 = 4). */
const DURATION_TO_MULTIPLIER = {
  '1/32': 0.25, '1/16': 0.5, '1/8': 0.5, '1/4': 1, '1/2': 2, '1/1': 4,
};

/**
 * Figurenotes rütmi klots: hall neutraalne kujund (ruudu kuju), laius vastavalt vältusele.
 * Kasutada rütmi tööriistakastis, kui notationStyle === 'FIGURENOTES'.
 */
export function FigurenotesBlockIcon({ duration, className = 'w-8 h-5' }) {
  const d = duration && (duration === 'rest' || duration === 'dotted' ? '1/4' : duration);
  const mult = DURATION_TO_MULTIPLIER[d] ?? 1;
  const boxW = 24;
  const boxH = 20;
  const blockW = Math.max(8, Math.min(20, (boxW * mult) / Math.ceil(mult)));
  const count = Math.ceil(mult);
  return (
    <svg viewBox={`0 0 ${boxW} ${boxH}`} className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={2 + i * (blockW + 2)}
          y={2}
          width={blockW}
          height={boxH - 4}
          rx={1}
          fill={FIGURE_BLOCK_GRAY}
          stroke="#6b7280"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}

export const RHYTHM_SYLLABLE_IMAGES = {
  '1/4': '/ta.svg',
  '1/8': '/ti-ti.svg',
  '1/2': '/ta-a.svg',
  rest: '/sh-sh.svg',
  '1/16': '/ti-ri-ti-ri.svg',
  '1/1': '/ta-a-a-a.svg',
  '1/32': '/ri.svg',
};

const RHYTHM_PATTERN_ICONS = {
  '2/8': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <ellipse cx="6" cy="17" rx="2.2" ry="1.8" fill="currentColor"/><ellipse cx="18" cy="17" rx="2.2" ry="1.8" fill="currentColor"/>
      <line x1="7.5" y1="17" x2="7.5" y2="5" strokeWidth="1.2"/><line x1="16.5" y1="17" x2="16.5" y2="5" strokeWidth="1.2"/>
      <line x1="5" y1="5" x2="19" y2="5" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  '4/16': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      {[4, 8, 14, 20].map((cx, i) => <ellipse key={i} cx={cx} cy="17" rx="1.8" ry="1.5" fill="currentColor"/>)}
      {[5, 11, 17, 23].map((x, i) => <line key={i} x1={x} y1="17" x2={x} y2="3" strokeWidth="1.1"/>)}
      <line x1="3" y1="3" x2="21" y2="3" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="3" y1="4.5" x2="21" y2="4.5" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  '8/16': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1">
      {[2.5, 5.5, 8.5, 11.5, 14.5, 17.5, 20.5, 23.5].map((cx, i) => <ellipse key={i} cx={cx} cy="17" rx="1.4" ry="1.2" fill="currentColor"/>)}
      {[3.5, 6.5, 9.5, 12.5, 15.5, 18.5, 21.5].map((x, i) => <line key={i} x1={x} y1="17" x2={x} y2="2" strokeWidth="1"/>)}
      <line x1="1" y1="2" x2="23" y2="2" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="1" y1="3.5" x2="23" y2="3.5" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  ),
  '1/8+2/16': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="2.2" ry="1.8" fill="currentColor"/><ellipse cx="12" cy="17" rx="1.8" ry="1.5" fill="currentColor"/><ellipse cx="19" cy="17" rx="1.8" ry="1.5" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="5" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="3" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="3" strokeWidth="1.1"/>
      <line x1="4" y1="5" x2="20" y2="5" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="10" y1="3" x2="19" y2="3" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  '2/16+1/8': (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="1.8" ry="1.5" fill="currentColor"/><ellipse cx="12" cy="17" rx="1.8" ry="1.5" fill="currentColor"/><ellipse cx="19" cy="17" rx="2.2" ry="1.8" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="3" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="3" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="5" strokeWidth="1.1"/>
      <line x1="4" y1="3" x2="20" y2="3" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="5" y1="5" x2="19" y2="5" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  triplet: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="5" cy="17" rx="2" ry="1.6" fill="currentColor"/><ellipse cx="12" cy="17" rx="2" ry="1.6" fill="currentColor"/><ellipse cx="19" cy="17" rx="2" ry="1.6" fill="currentColor"/>
      <line x1="6.5" y1="17" x2="6.5" y2="5" strokeWidth="1.1"/><line x1="12" y1="17" x2="12" y2="5" strokeWidth="1.1"/><line x1="17.5" y1="17" x2="17.5" y2="5" strokeWidth="1.1"/>
      <line x1="4" y1="5" x2="20" y2="5" strokeWidth="1.3" strokeLinecap="round"/>
      <text x="12" y="2" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor">3</text>
    </svg>
  ),
};

/** Same symbols as symbol gallery – notes (stem up for toolbox), rests. */
const NOTE_ICONS = {
  '1/1': <WholeNoteSymbol cx={0} cy={0} staffSpace={ICON_STAFF_SPACE} />,
  '1/2': <HalfNoteSymbol cx={0} cy={0} staffSpace={ICON_STAFF_SPACE} stemUp />,
  '1/4': <QuarterNoteSymbol cx={0} cy={0} staffSpace={ICON_STAFF_SPACE} stemUp />,
  '1/8': <EighthNoteSymbol cx={0} cy={0} staffSpace={ICON_STAFF_SPACE} stemUp />,
  '1/16': <SixteenthNoteSymbol cx={0} cy={0} staffSpace={ICON_STAFF_SPACE} stemUp />,
  '1/32': <ThirtySecondNoteSymbol cx={0} cy={0} staffSpace={ICON_STAFF_SPACE} stemUp />,
};

const REST_ICONS = {
  '1/1': <WholeRestSymbol x={0} y={0} staffSpace={ICON_STAFF_SPACE} />,
  '1/2': <HalfRestSymbol x={0} y={0} staffSpace={ICON_STAFF_SPACE} />,
  '1/4': <QuarterRestSymbol x={0} y={0} staffSpace={ICON_STAFF_SPACE} />,
  '1/8': <EighthRestSymbol x={0} y={0} staffSpace={ICON_STAFF_SPACE} />,
  '1/16': <SixteenthRestSymbol x={0} y={0} staffSpace={ICON_STAFF_SPACE} />,
  '1/32': <ThirtySecondRestSymbol x={0} y={0} staffSpace={ICON_STAFF_SPACE} />,
};

/** Rütmi pildid (noodid ja pausid) – same symbols as symbol gallery (NoteSymbols, RestSymbols). */
export function RhythmIcon({ duration, isDotted, isRest }) {
  const d = duration && (duration === 'rest' || duration === 'dotted' ? '1/4' : duration);
  const half = ICON_VIEW / 2;
  const viewBox = `${-half} ${-half} ${ICON_VIEW} ${ICON_VIEW}`;

  if (isRest) {
    const Rest = REST_ICONS[d] || REST_ICONS['1/4'];
    return (
      <svg viewBox={viewBox} className="w-5 h-5" fill="currentColor" style={{ overflow: 'visible' }} aria-hidden="true">
        <g>{Rest}</g>
      </svg>
    );
  }

  const Note = NOTE_ICONS[d] || NOTE_ICONS['1/4'];
  const dot = isDotted ? (
    <circle cx={half - 1.5} cy={0} r={1} fill="currentColor" aria-hidden="true" />
  ) : null;
  return (
    <svg viewBox={viewBox} className="w-5 h-5" fill="currentColor" style={{ overflow: 'visible' }} aria-hidden="true">
      <g>{Note}</g>
      {dot}
    </svg>
  );
}

export function RhythmPatternIcon({ pattern }) {
  return <span className="inline-flex items-center text-amber-900">{RHYTHM_PATTERN_ICONS[pattern] || null}</span>;
}
