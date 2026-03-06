/**
 * Rütmi tööriistakast: visuaalsed sümbolid (noodid, pausid, rütmipatternid).
 * Figurenotes režiimis: rütmi pikkust näidatakse hallide klotsidena (1× = 1/4, 2× = 1/2 jne).
 */
import React from 'react';

const FIGURE_BLOCK_GRAY = '#9ca3af';

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

/** Rütmi pildid (noodid ja pausid) – SMuFL stiilis ikoonid. */
export function RhythmIcon({ duration, isDotted, isRest }) {
  const d = duration && (duration === 'rest' || duration === 'dotted' ? '1/4' : duration);
  if (isRest) {
    const restIcons = {
      '1/1': <rect x="5" y="11" width="14" height="4" fill="currentColor" rx="0.5"/>,
      '1/2': <rect x="5" y="8" width="14" height="4" fill="currentColor" rx="0.5"/>,
      '1/4': <path d="M7 2.5 L7 6 C7 8.5 11 8.5 12 11 C13 13.5 9 14.5 7 15 C7 17.5 11 17.5 12 20 L8 22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
      '1/8': <g fill="currentColor" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="6" r="2.2" stroke="none"/><path d="M12 8.5 L12 20 L14.5 18.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>,
      '1/16': <g fill="currentColor" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="4.8" r="2" stroke="none"/><circle cx="12" cy="10" r="2" stroke="none"/><path d="M12 12 L12 13 L14 12.5 M12 13 L12 21 L14.5 19.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>,
      '1/32': <g fill="currentColor" stroke="currentColor" strokeWidth="1.3"><circle cx="12" cy="3.5" r="1.8" stroke="none"/><circle cx="12" cy="8.2" r="1.8" stroke="none"/><circle cx="12" cy="12.8" r="1.8" stroke="none"/><path d="M12 14.5 L12 15.8 L13.5 15.3 M12 15.8 L12 17 L13.5 16.5 M12 17 L12 22 L14 20.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>,
    };
    return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">{restIcons[d] || restIcons['1/4']}</svg>;
  }
  const dot = isDotted ? <circle cx="18" cy="14" r="1.3" fill="currentColor"/> : null;
  const noteIcons = {
    '1/1': <><g transform="rotate(-24 12 12.5)"><ellipse cx="12" cy="12.5" rx="5" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.3"/></g>{dot}</>,
    '1/2': <><g transform="rotate(-22 10 13)"><ellipse cx="10" cy="13" rx="4" ry="3" fill="none" stroke="currentColor" strokeWidth="1.3"/></g><line x1="14" y1="13" x2="14" y2="2" stroke="currentColor" strokeWidth="1.3"/>{dot}</>,
    '1/4': <><ellipse cx="10" cy="13" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="13" x2="14" y2="2" stroke="currentColor" strokeWidth="1.3"/>{dot}</>,
    '1/8': <><ellipse cx="10" cy="13" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="13" x2="14" y2="2" stroke="currentColor" strokeWidth="1.3"/><path d="M14 2 L17 3 L15.5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>{dot}</>,
    '1/16': <><ellipse cx="10" cy="13" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="13" x2="14" y2="2" stroke="currentColor" strokeWidth="1.3"/><path d="M14 2 L17 2.8 L15.5 4.5 M14 3.5 L17 4.2 L15.5 5.8" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>{dot}</>,
    '1/32': <><ellipse cx="10" cy="13" rx="4" ry="3" fill="currentColor"/><line x1="14" y1="13" x2="14" y2="2" stroke="currentColor" strokeWidth="1.3"/><path d="M14 2 L16.5 2.6 L15 4 M14 3.2 L16.5 3.8 L15 5.2 M14 4.2 L16.5 4.8 L15 6.2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>{dot}</>,
  };
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">{noteIcons[d] || noteIcons['1/4']}</svg>;
}

export function RhythmPatternIcon({ pattern }) {
  return <span className="inline-flex items-center text-amber-900">{RHYTHM_PATTERN_ICONS[pattern] || null}</span>;
}
