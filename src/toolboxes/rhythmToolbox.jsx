/**
 * Rütmi tööriistakast: visuaalsed sümbolid (noodid, pausid, rütmipatternid).
 * Figurenotes režiimis: rütmi pikkust näidatakse hallide klotsidena (1× = 1/4, 2× = 1/2 jne).
 * Traditional: SMuFL (sama font ja beam-loogika mis scorepage / PDF).
 */
import React from 'react';
import { RHYTHM_PATTERN_SEGMENTS } from '../notation/rhythmPatternSpecs';
import { BeamedRhythmPatternIcon } from './BeamedRhythmPatternIcon';
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
import { getAugmentationDotXFromNoteCenter } from '../notation/augmentationDotLayout';
import { getGlyphFontSize } from '../notation/musescoreStyle';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH } from '../notation/smufl/glyphs';

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
          stroke="#C7BAB7"
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

/** Tala-override nupud (abstraktne skeem, mitte eraldi SMuFL muster). */
const BEAM_MODE_ICONS = {
  'beam:auto': (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <line x1="3" y1="16" x2="21" y2="16" />
      <line x1="3" y1="8" x2="21" y2="8" />
      <text x="12" y="13" textAnchor="middle" fontSize="5" fill="currentColor">A</text>
    </svg>
  ),
  'beam:2/8': (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <line x1="2" y1="8" x2="10" y2="8" />
      <line x1="14" y1="8" x2="22" y2="8" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <text x="12" y="13" textAnchor="middle" fontSize="5" fill="currentColor">2</text>
    </svg>
  ),
  'beam:3/8': (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <line x1="2" y1="8" x2="22" y2="8" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <text x="12" y="13" textAnchor="middle" fontSize="5" fill="currentColor">3</text>
    </svg>
  ),
  'beam:4/8': (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <line x1="2" y1="8" x2="22" y2="8" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <text x="12" y="13" textAnchor="middle" fontSize="5" fill="currentColor">4</text>
    </svg>
  ),
  'beam:3/16': (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.2">
      <line x1="2" y1="7" x2="22" y2="7" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <text x="12" y="13" textAnchor="middle" fontSize="4.3" fill="currentColor">3/16</text>
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
  const dotX = getAugmentationDotXFromNoteCenter(0, ICON_STAFF_SPACE);
  const dotFs = getGlyphFontSize(ICON_STAFF_SPACE);
  const dot = isDotted ? (
    <SmuflGlyph
      x={dotX}
      y={0}
      glyph={SMUFL_GLYPH.augmentationDot}
      fontSize={dotFs}
      fill="currentColor"
      textAnchor="middle"
      dominantBaseline="central"
    />
  ) : null;
  return (
    <svg viewBox={viewBox} className="w-5 h-5" fill="currentColor" style={{ overflow: 'visible' }} aria-hidden="true">
      <g>{Note}</g>
      {dot}
    </svg>
  );
}

export function RhythmPatternIcon({ pattern }) {
  if (RHYTHM_PATTERN_SEGMENTS[pattern]) {
    return <BeamedRhythmPatternIcon pattern={pattern} />;
  }
  const beamIcon = BEAM_MODE_ICONS[pattern];
  return beamIcon ? <span className="inline-flex items-center text-amber-900">{beamIcon}</span> : null;
}
