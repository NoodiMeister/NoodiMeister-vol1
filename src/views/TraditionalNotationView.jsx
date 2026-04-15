/**
 * Pedagoogiline notatsioon / traditsiooniline vaade – TÄIELIKULT ERALDI figuurnotatsioonist.
 * JO-võti on peamine tööriist: liigutatav, dünaamiline; kordub iga uue rea alguses (System Break).
 * Abijooned genereeritakse, kui JO-võti või nootid väljuvad 5-liini süsteemist.
 * Paigutuse tööriistad (Staff Spacer, taktide laiendamine { }) rakenduvad siin.
 */
import React, { useState, useEffect, useRef } from 'react';
import { JoClefSymbol, TrebleClefSymbol, BassClefSymbol, getJoClefPixelWidth, getJoClefJoStripeBounds } from '../components/ClefSymbols';
import { RhythmSyllableLabel } from '../components/RhythmSyllableLabel';
import { getJoName } from '../notation/joNames';
import { getRhythmSyllableForNote } from '../notation/rhythmSyllables';
import { shouldDrawRestGlyph } from '../notation/restGlyphDedupe';
import { expandEmojiShortcuts } from '../utils/emojiShortcuts';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SmuflStemFlags } from '../notation/smufl/SmuflStemFlags';
import {
  SMUFL_GLYPH,
  NOTEHEAD_SHAPE_GLYPH,
  smuflRestForDurationLabel,
  smuflTimeSigDigitsForNumber,
  smuflPrecomposedNote,
  smuflPrecomposedTypeForDurationLabel,
  SMUFL_MUSIC_FONT_FAMILY,
} from '../notation/smufl/glyphs';
import {
  TIME_SIG_LAYOUT,
  TIME_SIG_SPACING,
  getTraditionalTimeSignatureX,
  estimateKeySignatureWidthPx,
  getPedagogicalTimeSignatureX,
  getPedagogicalRelativeKeySignatureWidthPx,
  getKeySignatureStepPx,
} from '../notation/TimeSignatureLayout';
import { ensureGlyphHorizontalGapPx, ensureMinGlyphHorizontalGapPx } from '../notation/glyphSpacing';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';
import {
  getStaffLinePositions,
  getMiddleStaffLineY,
  getYFromStaffPosition,
  getLedgerLineCountExact,
  getNoteheadRx,
  getLedgerHalfWidth,
  getVerticalPosition,
  getStemLength,
  getStaffLineThickness,
  getLegerLineThickness,
  getStemThickness,
  getStemCenterXFromNoteCenter,
  getThinBarlineThickness,
} from '../notation/StaffConstants';
import {
  getGlyphFontSize,
  getRestFontSize,
  TEXT_FONT_FAMILY,
} from '../notation/musescoreStyle';
import {
  computeBeamGroups,
  beamLineYAtX,
  computeBeamGeometry,
  getBeamThickness,
  getBeamGap,
} from '../notation/BeamCalculation';
import {
  getAugmentationDotCenterPitchY,
  getAugmentationDotXFromNoteCenter,
  getAugmentationDotXFromRestCenter,
  getRestAugmentationDotPitchY,
} from '../notation/augmentationDotLayout';
import { renderFiguredBassFigurations } from '../notation/figuredBassFigurations';
import { hasBundledOptionalFont } from '../export/exportFontAssets';
import { getAccidentalForPitchInKey } from '../utils/notationConstants';
import { getSchoolHandbellColor } from '../notation/PedagogicalLogic';
import { HandbellIcon } from '../components/icons/HandbellIcon';
import {
  KEY_SIGNATURE_COUNT_BY_KEY,
  KEY_SIGNATURE_STAFF_POSITIONS,
  KEY_SIGNATURE_VERTICAL_DY_PX_AT_10,
} from '../notation/keySignatureStandard';
import {
  resolveInstrumentRangeMidi,
  toNoteMidi,
  isMidiOutOfInstrumentRange,
} from '../notation/instrumentRangeRules';
import { getRepeatMarkPlacement } from '../notation/repeatMarksEngine';
import {
  getLeftBarlineRepeatRender,
  shouldDrawRepeatEndGlyphOnRight,
} from '../notation/repeatBarlineResolve';
import {
  getFinalDoubleBarlineCentersX,
  getRepeatBarlineSmuflPlacement,
} from '../notation/repeatBarlineLayout';

const LAYOUT = { MARGIN_LEFT: 60, CLEF_WIDTH: 45, MEASURE_MIN_WIDTH: 28 };

const PAGE_BREAK_GAP = 80;
const STAFF_SPACE = 10;
/** Left edge of staff lines: after system bracket + instrument brace (piano). Clef is 1px to the right. */
const STAFF_LEFT_WITH_BRACE = 44;
const STAFF_LEFT_WITHOUT_BRACE = 10;
const GAP_BEFORE_CLEF_PX = 6;
/** Treble clef anchor moved one staff line upward for current score alignment. */
const TREBLE_CLEF_LINE_INDEX = 2; // 0=top line ... 4=bottom line
const OUT_OF_RANGE_COLOR = '#dc2626';

function getKeySignatureInfo(keySignature) {
  if (!keySignature || keySignature === 'C') return { count: 0, kind: null };
  const sharpCount = KEY_SIGNATURE_COUNT_BY_KEY.sharps[keySignature] || 0;
  if (sharpCount > 0) return { count: sharpCount, kind: 'sharp' };
  const flatCount = KEY_SIGNATURE_COUNT_BY_KEY.flats[keySignature] || 0;
  if (flatCount > 0) return { count: flatCount, kind: 'flat' };
  return { count: 0, kind: null };
}

function getKeySignatureStaffPosition(clef, kind, idx) {
  const safeClef = clef === 'bass' || clef === 'alto' || clef === 'tenor' ? clef : 'treble';
  if (kind === 'sharp') {
    const byClef = KEY_SIGNATURE_STAFF_POSITIONS.sharps[safeClef] || KEY_SIGNATURE_STAFF_POSITIONS.sharps.treble;
    return byClef[idx] ?? 0;
  }
  const byClef = KEY_SIGNATURE_STAFF_POSITIONS.flats[safeClef] || KEY_SIGNATURE_STAFF_POSITIONS.flats.treble;
  return byClef[idx] ?? 0;
}

function getKeySignatureVerticalDyPx(clef, kind, idx, staffSpace) {
  const safeClef = clef === 'bass' || clef === 'alto' || clef === 'tenor' ? clef : 'treble';
  const byKind = KEY_SIGNATURE_VERTICAL_DY_PX_AT_10[kind] || KEY_SIGNATURE_VERTICAL_DY_PX_AT_10.sharps;
  const byClef = byKind[safeClef] || byKind.treble || [];
  const base = byClef[idx] ?? 0;
  const scale = (Number(staffSpace) || 10) / 10;
  return base * scale;
}


// SMuFL noteheads (Leland)
const SMUFL = {
  noteheadWhole: '\uE0A2',
  noteheadHalf: '\uE0A3',
  noteheadBlack: '\uE0A4',
};

function StaffClefSymbol({ x, y, height, clefType, fill = '#000', staffSpace = 10 }) {
  if (clefType === 'treble') return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
  if (clefType === 'bass') return <BassClefSymbol x={x} y={y} height={height} fill={fill} staffSpace={staffSpace} />;
  // Aldivõti (C-clef): symbol = clef-c.png, placement on staff = c-clef-on-staff.png (clef center = middle C line).
  if (clefType === 'alto' || clefType === 'tenor') {
    return (
      <SmuflGlyph
        x={x}
        y={y}
        glyph={SMUFL_GLYPH.cClef}
        fontSize={height ?? getGlyphFontSize(staffSpace)}
        fill={fill}
      />
    );
  }
  return <TrebleClefSymbol x={x} y={y} height={height} fill={fill} />;
}


/** Returns Leland glyph for notehead, or null when shape is 'emoji' (caller draws noteheadEmoji as text). */
function getNoteheadGlyph(durationLabel, noteheadShape = 'oval', noteheadEmoji = '♪') {
  if (noteheadShape === 'emoji') return null;
  const dur = durationLabel || '1/4';
  if (dur === '1/1') return SMUFL.noteheadWhole;
  if (dur === '1/2') return SMUFL.noteheadHalf;
  const shapeGlyph = NOTEHEAD_SHAPE_GLYPH[noteheadShape];
  return shapeGlyph || SMUFL.noteheadBlack;
}

function getFlagCount(durationLabel) {
  const dur = durationLabel || '1/4';
  if (dur === '1/8') return 1;
  if (dur === '1/16') return 2;
  if (dur === '1/32') return 3;
  return 0;
}

/** Tin whistle (D) fingering pattern; true=covered hole, false=open hole. */
/** Map a 6-char code (bottom hole first → top / mouthpiece last; 1=covered) to holes top→bottom for drawing (index 0 = top / cy smallest). */
function tinWhistleCodeBottomFirstToHolesTopFirst(code) {
  const s = String(code || '').replace(/\s/g, '');
  if (s.length !== 6) return null;
  const holes = [];
  for (let topIdx = 0; topIdx < 6; topIdx += 1) {
    const ch = s[5 - topIdx];
    if (ch !== '0' && ch !== '1') return null;
    holes.push(ch === '1');
  }
  return holes;
}

/** D tin whistle: written pitch D4 = bottom note; C5/C#5 close low octave; D5+ overblow register (hole codes bottom→top). */
function getTinWhistleFingeringPattern(pitch, octave) {
  if (!pitch || typeof octave !== 'number') return null;
  const sharpFromFlat = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const normalized = sharpFromFlat[pitch] || pitch;
  const codeNaturalC = '000110';
  const codeCSharp = '000000';
  const lowDEFGAB = { D: '111111', E: '011111', 'F#': '001111', G: '000111', A: '000011', B: '000001' };
  const highD = '111110';

  if (normalized === 'C' && !String(pitch).includes('#')) {
    if (octave < 5) return null;
    if (octave === 5) {
      const holes = tinWhistleCodeBottomFirstToHolesTopFirst(codeNaturalC);
      return holes ? { holes, overblow: false } : null;
    }
    const holes = tinWhistleCodeBottomFirstToHolesTopFirst(codeNaturalC);
    return holes ? { holes, overblow: true } : null;
  }
  if (normalized === 'C#') {
    if (octave < 5) return null;
    if (octave === 5) {
      const holes = tinWhistleCodeBottomFirstToHolesTopFirst(codeCSharp);
      return holes ? { holes, overblow: false } : null;
    }
    const holes = tinWhistleCodeBottomFirstToHolesTopFirst(codeCSharp);
    return holes ? { holes, overblow: true } : null;
  }

  const lowCode = lowDEFGAB[normalized];
  if (!lowCode) return null;
  if (octave === 4) {
    const holes = tinWhistleCodeBottomFirstToHolesTopFirst(lowCode);
    return holes ? { holes, overblow: false } : null;
  }
  if (octave >= 5) {
    const codeStr = normalized === 'D' ? highD : lowCode;
    const holes = tinWhistleCodeBottomFirstToHolesTopFirst(codeStr);
    return holes ? { holes, overblow: true } : null;
  }
  return null;
}

function pitchWithAccidental(pitch, accidental) {
  if (!pitch) return '';
  const letter = String(pitch).replace(/[#b]/g, '');
  if (accidental === 1) return `${letter}#`;
  if (accidental === -1) return `${letter}b`;
  return letter;
}

/** Vars alla + tala: min vahe (px) tala alumise serva ja ülemise sõrmestusringi ülemise serva vahel (nt 3. joon + beam). */
const TIN_WHISTLE_BEAM_TO_RING_GAP_MIN_PX = 5;

/** Top hole center Y: ülemise ringi ülemine serv jääb structuralBottomY + gap kohale (noodipea / vars alla / tala / lipud). */
function getTinWhistleTopHoleCenterYMinFromStructuralBottom(structuralBottomY, staffSpace, scale = 1, minGapAboveStructurePx) {
  const s = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
  const ss = staffSpace * s;
  const radius = Math.max(1.6, ss * 0.22);
  const baseGap = Math.max(2, staffSpace * 0.22);
  const gap =
    typeof minGapAboveStructurePx === 'number' && Number.isFinite(minGapAboveStructurePx)
      ? Math.max(baseGap, minGapAboveStructurePx)
      : baseGap;
  return structuralBottomY + gap + radius;
}

/**
 * Madalaim globaalne Y (SVG), kuhu ulatuvad noodipea alumine serv või vars-alla graafika (tala alumine serv, lipud).
 * Tin whistle sõrmestuse ülemine auk peab algama sellest allpool, et tala ei kattuks ringiga.
 */
function getTinWhistleStructuralBottomGlobalY({
  noteY,
  staffY,
  spacing,
  stemUp,
  stemY2,
  durationLabel,
  beamGroup,
  noteIdx,
}) {
  const nh = getGlyphFontSize(spacing) * 0.48;
  let bottom = noteY + nh;
  if (stemUp || durationLabel === '1/1') return bottom;
  bottom = Math.max(bottom, stemY2);
  if (beamGroup && noteIdx >= beamGroup.start && noteIdx <= beamGroup.end && !beamGroup.stemUp) {
    const thick = getBeamThickness(spacing);
    const gap = getBeamGap(spacing);
    const offset = thick + gap;
    const dir = 1;
    const swap = beamGroup.mixedBeamStackSwap;
    const slope = beamGroup.beamSlope ?? 0;
    const stemIdx = noteIdx - beamGroup.start;
    const xStem = beamGroup.stemXsInGroup[stemIdx];
    for (let b = beamGroup.numBeams - 1; b >= 0; b -= 1) {
      const dy = (swap ? beamGroup.numBeams - 1 - b : b) * offset * dir;
      const yCenter = staffY + beamLineYAtX(beamGroup.beamY1, slope, beamGroup.xLeft, xStem, dy);
      bottom = Math.max(bottom, yCenter + thick / 2);
    }
  } else {
    const fc = getFlagCount(durationLabel);
    if (fc > 0) {
      bottom = Math.max(bottom, stemY2 + spacing * 0.5 * fc);
    }
  }
  return bottom;
}

function TinWhistleFingeringSvg({ x, y, staffSpace, pattern, scale = 1 }) {
  if (!pattern?.holes || pattern.holes.length !== 6) return null;
  const s = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
  const ss = staffSpace * s;
  const radius = Math.max(1.6, ss * 0.22);
  const gap = Math.max(3, ss * 0.75);
  const fontSize = Math.max(7, ss * 0.9);
  /** Lokaalne Y gruppis (0 = ülemise augu keskpunkt): viimane auk on i=5, alumine äär ≈ 5*gap+radius. Ära lisa välise `y` — grupp on juba translate(x,y). */
  const bottomOfLastHole = 5 * gap + radius;
  /** Vahe tulba ja "+" vahel: veidi skaleerub, aga ülempiir, et suure skaalaga ei läheks märk kaugele. */
  const gapBelowColumn = Math.min(0.35 * gap, 10 + ss * 0.06);
  const plusLocalY = bottomOfLastHole + gapBelowColumn + fontSize * 0.35;
  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true">
      {pattern.holes.map((covered, i) => (
        <circle
          key={i}
          cx={0}
          cy={i * gap}
          r={radius}
          fill={covered ? '#111' : '#fff'}
          stroke="#111"
          strokeWidth={Math.max(0.8, radius * 0.3)}
        />
      ))}
      {pattern.overblow && (
        <text
          x={0}
          y={plusLocalY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="sans-serif"
          fontWeight="700"
          fontSize={fontSize}
          fill="#111"
        >
          +
        </text>
      )}
    </g>
  );
}

/** Recorder (soprano C) fingering: note name for RecorderFont finger table (C, D, E, F, G, A, B, C#, etc.). */
function getRecorderFingeringChar(pitch, octave) {
  if (!pitch || typeof octave !== 'number') return '';
  const letter = pitch.replace(/[#b]/, '');
  const base = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' }[letter] || 'C';
  return pitch.includes('#') ? base + '#' : pitch.includes('b') ? base + 'b' : base;
}

/** Leland SMuFL time signature digits centered at (x, y). Multi-digit (e.g. 12) laid out horizontally. */
function TimeSigDigits({ x, y, fontSize, number, fill }) {
  const digits = smuflTimeSigDigitsForNumber(number);
  if (digits.length === 0) return null;
  const spacing = fontSize * 0.5;
  const startX = x - (digits.length - 1) * spacing / 2;
  return (
    <g>
      {digits.map((glyph, i) => (
        <SmuflGlyph key={i} x={startX + i * spacing} y={y} glyph={glyph} fontSize={fontSize} fill={fill} />
      ))}
    </g>
  );
}

function renderTimeSignature(timeSignature, timeSignatureMode, centerY, textColor = '#333', noteFill = '#333', x = 45, pedagogicalOptions = {}) {
  const L = TIME_SIG_LAYOUT;
  // Sama ankur mis FigurenotesView: keskjoon = staff keskjoon (ilma y = centerY - 2 / -10 hack’ita).
  const y = centerY;
  const yLine = y + L.Y_LINE;
  const fNum = 52;
  const fDen = 52;
  const fDenFallback = 50;
  const numeratorDigits = <TimeSigDigits x={x} y={y + L.Y_NUM} fontSize={fNum} number={timeSignature.beats} fill={textColor} />;
  const denType = pedagogicalOptions.denominatorType || 'rhythm';
  const denColor = pedagogicalOptions.denominatorColor || noteFill || textColor;
  const denInstrument = pedagogicalOptions.denominatorInstrument || 'handbell';
  const denEmoji = pedagogicalOptions.denominatorEmoji || '🥁';

  if (timeSignatureMode === 'pedagogical') {
    const stemX = x + L.STEM_X_OFFSET;
    const noteX = x + L.NOTE_X_OFFSET;
    const noteY = y + L.NOTE_Y;
    const stemY1 = y + L.STEM_Y1;
    const stemY2 = y + L.STEM_Y2;

    const getRhythmSymbolForDenominator = () => {
      switch (timeSignature.beatUnit) {
        case 1: return <ellipse cx={noteX} cy={noteY} rx={L.WHOLE_RX} ry={L.WHOLE_RY} fill="none" stroke={textColor} strokeWidth="1.5" />;
        case 2: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill="none" stroke={textColor} strokeWidth="1.5" /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /></>);
        case 4: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill={denColor} /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /></>);
        case 8: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill={denColor} /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /><path d={`M ${stemX} ${stemY2} Q ${stemX - 6} ${stemY2 - 2} ${stemX} ${stemY2 - 5}`} fill={denColor} /></>);
        case 16: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill={denColor} /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /><path d={`M ${stemX} ${stemY2} Q ${stemX - 6} ${stemY2 - 2} ${stemX} ${stemY2 - 5} M ${stemX} ${stemY2 - 3} Q ${stemX - 6} ${stemY2 - 5} ${stemX} ${stemY2 - 8}`} fill={denColor} /></>);
        default: return <TimeSigDigits x={noteX} y={stemY2} fontSize={fDenFallback} number={timeSignature.beatUnit} fill={textColor} />;
      }
    };

    const getDenominatorVisual = () => {
      if (denType === 'number') return <TimeSigDigits x={noteX} y={stemY2} fontSize={fDenFallback} number={timeSignature.beatUnit} fill={denColor} />;
      if (denType === 'emoji') return <text x={noteX} y={stemY2 + 2} textAnchor="middle" fontSize={Math.max(18, fDenFallback)}>{denEmoji}</text>;
      if (denType === 'instrument') {
        if (denInstrument === 'boomwhacker') return <rect x={noteX - 8} y={noteY - 6} width={16} height={12} rx={6} fill={denColor} stroke={textColor} strokeWidth="1.2" />;
        if (denInstrument === 'triangle') return <path d={`M ${noteX} ${noteY - 7} L ${noteX - 7} ${noteY + 6} L ${noteX + 7} ${noteY + 6} Z`} fill="none" stroke={denColor} strokeWidth="1.8" />;
        return (<><circle cx={noteX} cy={noteY - 1} r={6} fill={denColor} /><rect x={noteX - 1.2} y={noteY + 5} width={2.4} height={10} rx={1.2} fill={denColor} /></>);
      }
      return getRhythmSymbolForDenominator();
    };

    return (<g><g stroke="none">{numeratorDigits}</g><line x1={x - L.LINE_HALF} y1={yLine} x2={x + L.LINE_HALF} y2={yLine} stroke={textColor} strokeWidth="1.5" />{getDenominatorVisual()}</g>);
  }

  return (
    <g>
      {numeratorDigits}
      <line x1={x - L.LINE_HALF} y1={yLine} x2={x + L.LINE_HALF} y2={yLine} stroke={textColor} strokeWidth="1.5" />
      <TimeSigDigits x={x} y={y + L.Y_DEN} fontSize={fDen} number={timeSignature.beatUnit} fill={textColor} />
    </g>
  );
}


function renderStandardRest(note, x, y, staffSpace) {
  const glyph = smuflRestForDurationLabel(note.durationLabel || '1/4');
  return (
    <SmuflGlyph
      x={x}
      y={y}
      glyph={glyph}
      fontSize={getRestFontSize(staffSpace)}
      fill="var(--note-fill, #1a1a1a)"
      dominantBaseline="central"
    />
  );
}

export function TraditionalNotationView({
  systems,
  effectiveMeasures: effectiveMeasuresProp,
  instruments = [],
  effectiveMeasuresPerInstrument = {},
  marginLeft = LAYOUT.MARGIN_LEFT,
  timelineHeight,
  pageWidth,
  timeSignature,
  timeSignatureMode,
  pedagogicalTimeSigDenominatorType = 'rhythm',
  pedagogicalTimeSigDenominatorColor = '#1a1a1a',
  pedagogicalTimeSigDenominatorInstrument = 'handbell',
  pedagogicalTimeSigDenominatorEmoji = '🥁',
  staffLines = 5,
  staffSpace: staffSpaceProp,
  clefType = 'treble',
  keySignature = 'C',
  notationMode, // 'traditional' | 'vabanotatsioon'
  joClefStaffPosition,
  relativeNotationShowKeySignature = false,
  relativeNotationShowTraditionalClef = false,
  onJoClefPositionChange,
  joClefFocused = false,
  onJoClefFocus,
  layoutLineBreakBefore = [],
  showLayoutBreakIcons = false,
  onToggleLineBreakAfter,
  translateLabel,
  showBarNumbers = true,
  barNumberSize = 11,
  showRhythmSyllables = false,
  showAllNoteLabels = false,
  enableEmojiOverlays = true,
  noteheadShape = 'oval',
  noteheadEmoji = '♪',
  chords = [],
  isNoteSelected,
  onNoteClick,
  onNoteMouseDown,
  onNoteMouseEnter,
  onNotePitchChange,
  onNoteBeatChange,
  canHandDragNotes = false,
  onNoteTeacherLabelChange,
  onNoteLabelClick,
  getPitchY, // (pitch, octave) => Y relative to staff center (Timeline arvutab JO/viiulivõtme järgi)
  getPitchFromY, // (staffLocalY) => { pitch, octave } for drag-to-change-pitch
  timelineSvgRef,
  isFirstInBraceGroup = false,
  braceGroupSize = 0,
  lyricFontFamily = TEXT_FONT_FAMILY,
  lyricFontSize = 12,
  lyricLineYOffset = 0,
  isHorizontal = false,
  a4PageHeight = 400,
  getStaffHeight = () => 140,
  showStaffSpacerHandles = false,
  onStaffSpacerMouseDown, // (systemIndex) => (e) => { ... } – ridade vertikaalne liigutamine (Layout)
  instrument = 'piano',
  instrumentRange = null,
  instrumentNotationVariant = 'standard',
  instrumentConfig = {},
  linkedNotationByStaffId = null,
  /** Lingitud iirivile augudiagramm: 1 = vaikimisi, suurem = suurem (projekti seade). */
  tinWhistleLinkedFingeringScale = 1,
  connectedBarlines = false,
  staffIndexInScore = 0,
  /** Traditsioonivaates: süsteemi kõrgus (ühendusjooned) — arvutusallikas `src/layout/traditionalMultiStaffGeometry.js`. */
  systemTotalHeight,
  themeColors,
  onRemoveRepeatMark, // (measureIndex, markType: 'repeatStart'|'repeatEnd'|'segno'|'coda'|'volta1'|'volta2') => void
}) {
  const spacing = staffSpaceProp ?? STAFF_SPACE;
  const isVabanotatsioon = notationMode === 'vabanotatsioon';
  const keySignatureInfo = getKeySignatureInfo(keySignature);
  const centerY = timelineHeight / 2;
  const timeSigTextColor = themeColors?.textColor ?? '#333';
  const timeSigNoteFill = themeColors?.noteFill ?? '#333';
  const [, setOptionalFontVersion] = useState(0);
  const [noteDrag, setNoteDrag] = useState(null); // { noteIndex, staffY } when dragging a note to change pitch
  const [noteBeatDrag, setNoteBeatDrag] = useState(null); // { noteIndex, startClientX } when hand tool dragging note to new beat
  const lastPitchRef = useRef(null); // avoid duplicate updates when pitch unchanged
  const tinWhistleFontFamily = hasBundledOptionalFont('TinWhistleTab') ? 'TinWhistleTab' : 'Noto Sans';
  const recorderFontFamily = hasBundledOptionalFont('RecorderFont') ? 'RecorderFont' : 'Noto Sans';
  const tinWhistleFingeringScale = typeof tinWhistleLinkedFingeringScale === 'number' && Number.isFinite(tinWhistleLinkedFingeringScale) && tinWhistleLinkedFingeringScale > 0
    ? Math.min(20, Math.max(0.35, tinWhistleLinkedFingeringScale))
    : 1;
  const instrumentRangeMidi = React.useMemo(() => {
    return resolveInstrumentRangeMidi(instrument, keySignature, instrumentRange);
  }, [instrument, keySignature, instrumentRange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOptionalFontsChanged = () => setOptionalFontVersion((v) => v + 1);
    window.addEventListener('noodimeister-optional-fonts-changed', handleOptionalFontsChanged);
    return () => window.removeEventListener('noodimeister-optional-fonts-changed', handleOptionalFontsChanged);
  }, []);

  // Layout: must be before measureLayout useMemo (which uses effectiveMarginLeft)
  const staffLeft = (isFirstInBraceGroup && braceGroupSize >= 2) ? STAFF_LEFT_WITH_BRACE : STAFF_LEFT_WITHOUT_BRACE;
  const clefX = staffLeft + GAP_BEFORE_CLEF_PX;
  const timeSigWidthPx = 28;
  const ksFontForLayout = getGlyphFontSize(spacing);
  const keySigStepPx = getKeySignatureStepPx(ksFontForLayout);
  const actualTraditionalKeySigCount = isVabanotatsioon ? 0 : keySignatureInfo.count;
  const keySigWidthWorstCase = estimateKeySignatureWidthPx(actualTraditionalKeySigCount, ksFontForLayout);
  const pedagogicalLeftPrefixWorstCase =
    LAYOUT.CLEF_WIDTH +
    getPedagogicalRelativeKeySignatureWidthPx(7, ksFontForLayout) +
    getJoClefPixelWidth(spacing);
  const traditionalLeftPrefixWorstCase =
    LAYOUT.CLEF_WIDTH +
    keySigWidthWorstCase +
    (keySigWidthWorstCase > 0 ? TIME_SIG_SPACING.GAP_AFTER_KEY_SIG_BEFORE_TIME_SIG_PX : 0);
  const minContentStart =
    staffLeft +
    1 +
    (isVabanotatsioon ? pedagogicalLeftPrefixWorstCase : traditionalLeftPrefixWorstCase) +
    timeSigWidthPx +
    2;
  const effectiveMarginLeft = Math.max(marginLeft, minContentStart);

  // Measure layout for getBeatFromX (first system only; notation starts at effectiveMarginLeft after clef/key/time sig)
  const measureLayout = React.useMemo(() => {
    const sys = systems?.[0];
    if (!sys || !effectiveMeasuresProp) return [];
    const mw = sys.measureWidths ?? [];
    const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
    const left = effectiveMarginLeft;
    return sys.measureIndices.map((measureIdx, j) => {
      const measure = effectiveMeasuresProp[measureIdx];
      if (!measure) return null;
      const xStart = left + mw.slice(0, j).reduce((a, b) => a + b, 0);
      const xEnd = xStart + (mw[j] ?? 0);
      const startBeat = measure.startBeat;
      const endBeat = measure.startBeat + (measure.beatCount ?? beatsPerMeasure);
      return { xStart, xEnd, startBeat, endBeat };
    }).filter(Boolean);
  }, [systems, effectiveMeasuresProp, effectiveMarginLeft, timeSignature]);

  const getBeatFromX = React.useCallback((x) => {
    for (const m of measureLayout) {
      if (x >= m.xStart && x <= m.xEnd) {
        const t = (m.xEnd - m.xStart) > 0 ? (x - m.xStart) / (m.xEnd - m.xStart) : 0;
        return m.startBeat + t * (m.endBeat - m.startBeat);
      }
    }
    if (measureLayout.length > 0) return measureLayout[0].startBeat;
    return 0;
  }, [measureLayout]);

  useEffect(() => {
    if (!noteBeatDrag || typeof onNoteBeatChange !== 'function' || !timelineSvgRef?.current) return;
    const { noteIndex } = noteBeatDrag;
    const onMove = () => {};
    const onUp = (e) => {
      const svg = timelineSvgRef.current;
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = 0;
        const local = pt.matrixTransform(svg.getScreenCTM().inverse());
        const beat = getBeatFromX(local.x);
        onNoteBeatChange(noteIndex, beat);
      }
      setNoteBeatDrag(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [noteBeatDrag, onNoteBeatChange, getBeatFromX, timelineSvgRef]);

  useEffect(() => {
    if (!noteDrag || typeof onNotePitchChange !== 'function' || typeof getPitchFromY !== 'function' || !timelineSvgRef?.current) return;
    const { noteIndex, staffY } = noteDrag;
    const onMove = (e) => {
      const rect = timelineSvgRef.current.getBoundingClientRect();
      const yInSvg = e.clientY - rect.top;
      const staffLocalY = yInSvg - staffY;
      const pitchInfo = getPitchFromY(staffLocalY);
      if (pitchInfo && (lastPitchRef.current?.pitch !== pitchInfo.pitch || lastPitchRef.current?.octave !== pitchInfo.octave)) {
        lastPitchRef.current = pitchInfo;
        onNotePitchChange(noteIndex, pitchInfo.pitch, pitchInfo.octave);
      }
    };
    const onUp = () => {
      setNoteDrag(null);
      lastPitchRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [noteDrag, onNotePitchChange, getPitchFromY, timelineSvgRef]);
  const staffLinePositions = getStaffLinePositions(centerY, staffLines, spacing);
  // Leland: Treble on B line (traditional-method placement). Bass: F line (index 1).
  const trebleGLine = staffLinePositions[TREBLE_CLEF_LINE_INDEX];
  const bassFLine = staffLinePositions[1];    // F3
  const middleLineY = getMiddleStaffLineY(centerY, staffLines, spacing);
  // C clef: alto = middle line (index 2), tenor = one line up (index 1). Middle arrow of cClef sits on this line.
  const cClefAltoLine = staffLinePositions[2];
  const cClefTenorLine = staffLinePositions[1];
  const resolvePitchY = (pitch, octave) => (typeof getPitchY === 'function' ? getPitchY(pitch, octave) : centerY);
  const clefFontSize = spacing * 4; // Leland: 4× staff-space
  const firstLineY = staffLinePositions[0];
  const lastLineY = staffLinePositions[staffLinePositions.length - 1];

  const multiStaff = Array.isArray(instruments) && instruments.length > 0;
  const effectiveMeasures = multiStaff ? null : effectiveMeasuresProp;

  // JO-võti: ankur ja abijooned. Kordub IGA rea alguses.
  const joKeyY = getYFromStaffPosition(joClefStaffPosition, centerY, 5, spacing);
  const showTraditionalKeySignature = !isVabanotatsioon && !!keySignature && keySignature !== 'C';
  const showRelativeKeySignature = isVabanotatsioon && relativeNotationShowKeySignature && !!keySignature && keySignature !== 'C';
  const shouldDrawAnyKeySignature = showTraditionalKeySignature || showRelativeKeySignature;

  const staffList = multiStaff ? instruments : [{ id: '_single', name: '', clef: clefType }];

  const showTinWhistleLinkedFingeringForInst = (instRow) => {
    if (!multiStaff) {
      const tw = instrument === 'tin-whistle' || String(instrument || '').startsWith('tin-whistle-');
      return tw && instrumentNotationVariant === 'fingering';
    }
    const iid = instRow?.instrumentId;
    if (!iid) return false;
    const tw = iid === 'tin-whistle' || String(iid).startsWith('tin-whistle-');
    if (!tw) return false;
    const cfg = instrumentConfig?.[iid];
    return !!(cfg?.type === 'wind' && cfg?.fingering && linkedNotationByStaffId?.[instRow.id]);
  };
  const showRecorderLinkedFingeringForInst = (instRow) => {
    if (!multiStaff) {
      return instrument === 'recorder' && instrumentNotationVariant === 'fingering';
    }
    const iid = instRow?.instrumentId;
    if (iid !== 'recorder') return false;
    const cfg = instrumentConfig?.[iid];
    return !!(cfg?.type === 'wind' && cfg?.fingering && linkedNotationByStaffId?.[instRow.id]);
  };

  /** System bracket (Leland): bracketTop + vertical line + bracketBottom when multiple staves and connected barlines */
  const showSystemBracket = connectedBarlines && staffIndexInScore === 0 && typeof systemTotalHeight === 'number' && systemTotalHeight > 0;
  /** Right of staff-spacer handle (14px) so bracket is not covered when handles are shown. */
  const systemBracketX = 17;
  const systemBracketCapSize = 14;
  const smuflMusicFontStack = "'Leland', 'Bravura', serif";

  return (
    <g className="traditional-notation">
      {systems.map((sys) => {
        const pageIndex = isHorizontal ? Math.floor(sys.yOffset / a4PageHeight) : 0;
        const groupTransform = isHorizontal && pageWidth ? `translate(${pageIndex * pageWidth}, ${-pageIndex * a4PageHeight})` : undefined;
        /** Top/bottom staff lines for full system (all staves); used for bracket + connected barlines — not per-row `staffY`. */
        const systemTopStaffLineY = sys.yOffset + firstLineY;
        const systemBottomStaffLineY =
          sys.yOffset + (staffList.length - 1) * timelineHeight + lastLineY;
        const bracketTopY = systemTopStaffLineY;
        const bracketBottomY = systemBottomStaffLineY;
        return (
          <g key={sys.systemIndex} transform={groupTransform}>
            {/* Spacer handle first so system bracket (SMuFL) paints on top and stays visible */}
            {showStaffSpacerHandles && typeof onStaffSpacerMouseDown === 'function' && (
              <rect
                className="staff-spacer-handle"
                x={0}
                y={sys.yOffset}
                width={14}
                height={timelineHeight * (multiStaff ? staffList.length : 1)}
                fill="#e5e7eb"
                stroke="#9ca3af"
                strokeWidth={1}
                rx={2}
                style={{ cursor: 'ns-resize' }}
                onMouseDown={onStaffSpacerMouseDown(sys.systemIndex)}
              />
            )}
            {showSystemBracket && (
              <g aria-hidden="true">
                <SmuflGlyph
                  x={systemBracketX}
                  y={bracketTopY}
                  glyph={SMUFL_GLYPH.bracketTop}
                  fontSize={systemBracketCapSize}
                  fill="#1a1a1a"
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  style={{ fontFamily: smuflMusicFontStack }}
                />
                <line
                  x1={systemBracketX}
                  y1={bracketTopY + systemBracketCapSize}
                  x2={systemBracketX}
                  y2={bracketBottomY - systemBracketCapSize}
                  stroke="#1a1a1a"
                  strokeWidth={Math.max(2, spacing * 0.2)}
                />
                <SmuflGlyph
                  x={systemBracketX}
                  y={bracketBottomY}
                  glyph={SMUFL_GLYPH.bracketBottom}
                  fontSize={systemBracketCapSize}
                  fill="#1a1a1a"
                  textAnchor="middle"
                  dominantBaseline="text-after-edge"
                  style={{ fontFamily: smuflMusicFontStack }}
                />
              </g>
            )}
            {sys.pageBreakBefore && (
              <line x1={0} y1={sys.yOffset - PAGE_BREAK_GAP / 2} x2={pageWidth || 800} y2={sys.yOffset - PAGE_BREAK_GAP / 2} stroke="#c4b896" strokeWidth={1} strokeDasharray="4 4" />
            )}
            {/* Piano Grand Staff brace (Leland SMuFL brace) – connects treble and bass staves */}
            {isFirstInBraceGroup && braceGroupSize >= 2 && !multiStaff && (() => {
              const staffH = getStaffHeight();
              const grandGap = Math.max(80, Math.min(100, 90));
              const braceH = braceGroupSize * staffH + grandGap;
              const top = sys.yOffset + 2;
              const bottom = sys.yOffset + braceH - 2;
              const braceCenterY = (top + bottom) / 2;
              const braceFontSize = Math.max(40, bottom - top);
              const braceX = 14;
              return (
                <g aria-hidden="true">
                  <SmuflGlyph
                    x={braceX}
                    y={braceCenterY}
                    glyph={SMUFL_GLYPH.brace}
                    fontSize={braceFontSize}
                    fill="#1a1a1a"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  />
                </g>
              );
            })()}

            {staffList.map((inst, staffIndex) => {
              /** Second+ staves in a combined system must not each draw full-height barlines (staffIndexInScore stays 0). */
              const drawConnectedBarlinesHere =
                !(connectedBarlines && staffIndexInScore > 0) &&
                (!connectedBarlines || !multiStaff || staffIndex === 0);
              const staffY = sys.yOffset + staffIndex * timelineHeight;
              const staffCenterY = timelineHeight / 2;
              const staffFirstLineY = staffLinePositions[0];
              const staffLastLineY = staffLinePositions[staffLinePositions.length - 1];
              const instClef = inst.clef ?? clefType;
              const instMeasures = multiStaff ? (effectiveMeasuresPerInstrument[inst.id] ?? []) : effectiveMeasures;
              const staffResolvePitchY = multiStaff
                ? (pitch, octave) => getVerticalPosition(pitch, octave, instClef, { centerY: staffCenterY, staffSpace: spacing, keySignature })
                : resolvePitchY;

              return (
                <g key={inst.id + staffIndex}>
                  {/* 5-liiniline noodijoonestik (staff lines start at staffLeft; order: bracket, brace, staff, 1px gap, clef) */}
                  {staffLinePositions.map((y, index) => (
                    <line
                      key={`staff-${sys.systemIndex}-${staffIndex}-${index}`}
                      x1={staffLeft}
                      y1={staffY + y}
                      x2={effectiveMarginLeft + (sys.measureWidths ?? []).reduce((a, b) => a + b, 0)}
                      y2={staffY + y}
                      stroke="#000"
                      strokeWidth={getStaffLineThickness(spacing)}
                    />
                  ))}

                  {/* Üks noodivõti per staff — sama clefX kui ühe rea traditsioonivaates (ei ole eraldi “nime veergu”). */}
                  {staffLines === 5 && (
                    (() => {
                      if (multiStaff) {
                        const clefY = instClef === 'treble' ? staffY + trebleGLine : instClef === 'bass' ? staffY + bassFLine : instClef === 'tenor' ? staffY + cClefTenorLine : staffY + cClefAltoLine;
                        return (
                          <StaffClefSymbol
                            key={`clef-${sys.systemIndex}-${staffIndex}-${instClef}`}
                            x={clefX}
                            y={clefY}
                            height={clefFontSize}
                            clefType={instClef}
                            fill="#000"
                            staffSpace={spacing}
                          />
                        );
                      }
                      let g = [];
                      if (isVabanotatsioon) {
                        let currentX = clefX;
                        const joClefCenterY = staffY + joKeyY;
                        const { above: ledgerAbove, below: ledgerBelow } = getLedgerLineCountExact(joKeyY, firstLineY, lastLineY, spacing);
                        const joClefWidthPx = getJoClefPixelWidth(spacing);
                        /* Järjekord: trad. võti (kui lubatud) → võtmemärk (kui lubatud) → JO-võti → taktimõõt (eraldi kiht). */
                        if (relativeNotationShowTraditionalClef) {
                          const tradY = clefType === 'treble' ? staffY + trebleGLine : clefType === 'bass' ? staffY + bassFLine : clefType === 'tenor' ? staffY + cClefTenorLine : staffY + cClefAltoLine;
                          g.push(<StaffClefSymbol key="trad-clef" x={currentX} y={tradY} height={clefFontSize} clefType={clefType} fill="#000" staffSpace={spacing} />);
                          currentX += LAYOUT.CLEF_WIDTH;
                        }
                        if (relativeNotationShowKeySignature && keySignatureInfo.count > 0 && keySignatureInfo.kind) {
                          const ksGlyph =
                            keySignatureInfo.kind === 'flat' ? SMUFL_GLYPH.accidentalFlat : SMUFL_GLYPH.accidentalSharp;
                          const ksCount = keySignatureInfo.count;
                          const ksFont = getGlyphFontSize(spacing);
                          for (let i = 0; i < ksCount; i += 1) {
                            const staffPos = getKeySignatureStaffPosition(clefType, keySignatureInfo.kind, i);
                            const glyphY =
                              staffY +
                              getYFromStaffPosition(staffPos, centerY, staffLines, spacing) +
                              getKeySignatureVerticalDyPx(clefType, keySignatureInfo.kind, i, spacing);
                            g.push(
                              <SmuflGlyph
                                key={`ks-${i}`}
                                x={currentX + TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX + i * keySigStepPx}
                                y={glyphY}
                                glyph={ksGlyph}
                                fontSize={ksFont}
                                fill="#1a1a1a"
                              />
                            );
                          }
                          currentX +=
                            TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX +
                            Math.max(0, ksCount - 1) * keySigStepPx +
                            Math.round(ksFont * 0.35);
                        }
                        const joClefEl = (
                          <JoClefSymbol
                            x={currentX}
                            centerY={joClefCenterY}
                            staffSpacing={spacing}
                            stroke="#000"
                            ledgerLinesAbove={ledgerAbove}
                            ledgerLinesBelow={ledgerBelow}
                            firstLineY={staffY + firstLineY}
                            lastLineY={staffY + lastLineY}
                          />
                        );
                        const isFirstSystem = sys.systemIndex === 0;
                        const canFocus = isFirstSystem && typeof onJoClefFocus === 'function';
                        g.push(
                          <g
                            key="jo-clef"
                            data-jo-clef
                            style={{ cursor: canFocus ? 'pointer' : undefined }}
                            title={canFocus ? (joClefFocused ? 'Kasuta nooleklahve ↑ ja ↓ JO-võtme nihutamiseks. Escape = lõpeta.' : 'Klõpsa JO-võtit, seejärel nooltega ↑↓ nihuta võtit.') : undefined}
                            onClick={canFocus ? (e) => { e.stopPropagation(); onJoClefFocus(true); } : undefined}
                          >
                            {joClefEl}
                            {joClefFocused && isFirstSystem && (
                              <rect x={currentX - 2} y={joClefCenterY - spacing * 2 - 4} width={joClefWidthPx + 4} height={spacing * 4 + 8} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="4 2" rx="2" />
                            )}
                          </g>
                        );
                        return <g>{g}</g>;
                      }
                      const clefY = clefType === 'treble' ? staffY + trebleGLine : clefType === 'bass' ? staffY + bassFLine : clefType === 'tenor' ? staffY + cClefTenorLine : staffY + cClefAltoLine;
                      const symbols = [];
                      symbols.push(
                        <StaffClefSymbol
                          key={`clef-${sys.systemIndex}-${staffIndex}-${clefType}`}
                          x={clefX}
                          y={clefY}
                          height={clefFontSize}
                          clefType={clefType}
                          fill="#000"
                          staffSpace={spacing}
                        />
                      );
                      if (showTraditionalKeySignature && keySignatureInfo.count > 0 && keySignatureInfo.kind) {
                        const keySigStartX = clefX + LAYOUT.CLEF_WIDTH + TIME_SIG_SPACING.KEY_SIG_FIRST_CENTER_OFFSET_PX;
                        const keySigGlyph =
                          keySignatureInfo.kind === 'flat' ? SMUFL_GLYPH.accidentalFlat : SMUFL_GLYPH.accidentalSharp;
                        const ksFontSize = getGlyphFontSize(spacing);
                        for (let i = 0; i < keySignatureInfo.count; i += 1) {
                          const staffPos = getKeySignatureStaffPosition(clefType, keySignatureInfo.kind, i);
                          const glyphY =
                            staffY +
                            getYFromStaffPosition(staffPos, centerY, staffLines, spacing) +
                            getKeySignatureVerticalDyPx(clefType, keySignatureInfo.kind, i, spacing);
                          symbols.push(
                            <SmuflGlyph
                              key={`ks-trad-${sys.systemIndex}-${staffIndex}-${i}`}
                              x={keySigStartX + i * keySigStepPx}
                              y={glyphY}
                              glyph={keySigGlyph}
                              fontSize={ksFontSize}
                              fill="#1a1a1a"
                            />
                          );
                        }
                      }
                      return <g>{symbols}</g>;
                    })()
                  )}

                  {/* Taktinumber rea alguses: clef'i ees ja ülemise noodijoone kohal */}
                  {showBarNumbers && staffIndex === 0 && sys.measureIndices.length > 0 && (
                    <text
                      x={Math.max(6, clefX - 8)}
                      y={staffY + firstLineY - 21}
                      fontSize={25}
                      fontWeight="bold"
                      fill="#555"
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fontFamily="sans-serif"
                    >
                      {sys.measureIndices[0] + 1}
                    </text>
                  )}

                  {/* Time signature only on first system (first bar); after clef and key marks */}
                  {sys.systemIndex === 0 && staffIndex === 0 && (
                    (() => {
                      const keySigCount = shouldDrawAnyKeySignature ? keySignatureInfo.count : 0;
                      const ksFont = getGlyphFontSize(spacing);
                      const timeSigX = isVabanotatsioon
                        ? getPedagogicalTimeSignatureX({
                            clefX,
                            clefColumnWidth: LAYOUT.CLEF_WIDTH,
                            showTraditionalClef: relativeNotationShowTraditionalClef,
                            keySigCount: showRelativeKeySignature ? keySignatureInfo.count : 0,
                            ksFontSize: ksFont,
                            joClefWidthPx: getJoClefPixelWidth(spacing),
                            measureStartX: effectiveMarginLeft,
                          })
                        : getTraditionalTimeSignatureX({
                            clefX,
                            clefWidth: LAYOUT.CLEF_WIDTH,
                            keySigCount,
                            ksFontSize: ksFont,
                            measureStartX: effectiveMarginLeft,
                          });
                      return (
                        <g transform={`translate(${timeSigX}, ${staffY})`}>{renderTimeSignature(timeSignature, timeSignatureMode, centerY, timeSigTextColor, timeSigNoteFill, 0, { denominatorType: pedagogicalTimeSigDenominatorType, denominatorColor: pedagogicalTimeSigDenominatorColor, denominatorInstrument: pedagogicalTimeSigDenominatorInstrument, denominatorEmoji: pedagogicalTimeSigDenominatorEmoji })}</g>
                      );
                    })()
                  )}

                  {/* Taktid: jooned, akordid, nootid (per staff) */}
                  {Array.isArray(instMeasures) && (() => {
                    const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
                    return sys.measureIndices.map((measureIdx, j) => {
                      const measure = instMeasures[measureIdx];
                      if (!measure) return null;
                const prevMeasureInSystem = j > 0 ? instMeasures[sys.measureIndices[j - 1]] : null;
                const nextMeasureInSystem = j < sys.measureIndices.length - 1 ? instMeasures[sys.measureIndices[j + 1]] : null;
                const leftBarlineRepeat = getLeftBarlineRepeatRender({
                  measureIndexInSystem: j,
                  measure,
                  prevMeasureInSystem,
                });
                const drawRepeatEndGlyphRight = shouldDrawRepeatEndGlyphOnRight(measure, nextMeasureInSystem);
                const prevIdxForRepeatPair = j > 0 ? sys.measureIndices[j - 1] : null;
                const measureWidths = sys.measureWidths ?? sys.measureIndices.map(() => sys.measureWidth ?? beatsPerMeasure * 80);
                const measureWidth = measureWidths[j] ?? (sys.measureWidth ?? beatsPerMeasure * 80);
                const measureX = effectiveMarginLeft + measureWidths.slice(0, j).reduce((a, b) => a + b, 0);
                const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
                const beatWidth = measureWidth / beatsInMeasure;

                const getSlotsPerBeat = (beatIndex) => {
                  const beatStart = measure.startBeat + beatIndex;
                  const beatEnd = beatStart + 1;
                  const notesInBeat = measure.notes.filter(n => n.beat >= beatStart && n.beat < beatEnd);
                  if (notesInBeat.length === 0) return 1;
                  const minDur = Math.min(...notesInBeat.map(n => n.duration));
                  return Math.max(1, Math.round(1 / minDur));
                };
                const getNoteSlotCenterX = (note) => {
                  const beatInMeasure = note.beat - measure.startBeat;
                  const beatIndex = Math.floor(beatInMeasure);
                  const posInBeat = beatInMeasure - beatIndex;
                  const slotsPerBeat = getSlotsPerBeat(beatIndex);
                  const slotIndex = Math.min(Math.floor(posInBeat * slotsPerBeat), slotsPerBeat - 1);
                  const slotCenter = (slotIndex + 0.5) / slotsPerBeat;
                  return measureX + (beatIndex + slotCenter) * beatWidth;
                };
                const noteXOverrides = new Map();
                const simultaneousBeatGroups = new Map();
                for (let idx = 0; idx < measure.notes.length; idx += 1) {
                  const n = measure.notes[idx];
                  if (!n || n.isRest || typeof n.beat !== 'number') continue;
                  // Quantize beat key for stable grouping of truly simultaneous notes.
                  const beatKey = Math.round((n.beat - measure.startBeat) * 1024) / 1024;
                  if (!simultaneousBeatGroups.has(beatKey)) simultaneousBeatGroups.set(beatKey, []);
                  simultaneousBeatGroups.get(beatKey).push(idx);
                }
                const chordHorizontalShiftPx = ensureGlyphHorizontalGapPx(spacing * 0.75);
                const secondIntervalThresholdPx = spacing * 0.75;
                simultaneousBeatGroups.forEach((indices) => {
                  if (!Array.isArray(indices) || indices.length < 2) return;
                  const sorted = [...indices].sort((a, b) => {
                    const na = measure.notes[a];
                    const nb = measure.notes[b];
                    const pyA = na?.pitch && typeof na?.octave === 'number' ? staffResolvePitchY(na.pitch, na.octave) : staffCenterY;
                    const pyB = nb?.pitch && typeof nb?.octave === 'number' ? staffResolvePitchY(nb.pitch, nb.octave) : staffCenterY;
                    return pyA - pyB;
                  });
                  // MuseScore/Finale/Sibelius style: seconds on same beat interlock into two columns.
                  let prevPitchY = null;
                  let column = 0;
                  for (const noteIdxInMeasure of sorted) {
                    const n = measure.notes[noteIdxInMeasure];
                    const py = n?.pitch && typeof n?.octave === 'number' ? staffResolvePitchY(n.pitch, n.octave) : staffCenterY;
                    if (prevPitchY != null && Math.abs(py - prevPitchY) < secondIntervalThresholdPx) {
                      column = column === 0 ? 1 : 0;
                    } else {
                      column = 0;
                    }
                    if (column === 1) noteXOverrides.set(noteIdxInMeasure, chordHorizontalShiftPx);
                    prevPitchY = py;
                  }
                });
                const getRenderedNoteCenterX = (note, noteIdx) => {
                  const baseX = getNoteSlotCenterX(note);
                  return baseX + (noteXOverrides.get(noteIdx) ?? 0);
                };

                /** Käsikellad: pedagoogika — ära kasuta keskjoonest tulenevat varre suunda (varred alati üles). */
                const isHandbellsStaff = String((multiStaff ? inst?.instrumentId : instrument) || '') === 'handbells';

                const noteheadRx = getNoteheadRx(spacing);
                const beamGroupsRaw = computeBeamGroups(measure.notes, measure.startBeat, timeSignature);
                const beamGroups = beamGroupsRaw.map((gr) => {
                  const noteXs = new Array(measure.notes.length);
                  const noteCys = new Array(measure.notes.length);
                  for (let k = gr.start; k <= gr.end; k++) {
                    const n = measure.notes[k];
                    noteXs[k] = getRenderedNoteCenterX(n, k);
                    const py = n.pitch && typeof n.octave === 'number' ? staffResolvePitchY(n.pitch, n.octave) : staffCenterY;
                    noteCys[k] = py;
                  }
                  // VexFlow/MuseScore: alla keskmise joone = vars üles; üle keskmise = vars alla. Käsikellad: alati üles.
                  let stemUp;
                  if (isHandbellsStaff) {
                    stemUp = true;
                  } else {
                    stemUp = noteCys[gr.start] > middleLineY;
                    if (gr.end >= gr.start) {
                      let sum = 0;
                      let count = 0;
                      for (let k = gr.start; k <= gr.end; k++) {
                        if (typeof noteCys[k] === 'number') {
                          sum += noteCys[k];
                          count++;
                        }
                      }
                      const avg = count > 0 ? (sum / count) : middleLineY;
                      stemUp = avg > middleLineY;
                    }
                  }
                  const geom = computeBeamGeometry(gr, measure.notes, noteXs, noteCys, stemUp, spacing);
                  return { ...gr, ...geom, noteXs, noteCys };
                });
                const getBeamGroup = (noteIdx) => beamGroups.find(g => noteIdx >= g.start && noteIdx <= g.end);
                const connectedY1 = systemTopStaffLineY;
                const connectedY2 = systemBottomStaffLineY;
                const barY1 =
                  connectedBarlines && staffIndexInScore === 0 ? connectedY1 : staffY + firstLineY;
                const barY2 =
                  connectedBarlines && staffIndexInScore === 0 ? connectedY2 : staffY + lastLineY;
                const measureRightX = measureX + measureWidth;
                const repeatEndAnchoredToFinalBarline = !!(
                  measure.repeatEnd
                  && drawRepeatEndGlyphRight
                  && measure.barlineFinal
                );
                const finalBarlineGeomForRepeat = repeatEndAnchoredToFinalBarline
                  ? getFinalDoubleBarlineCentersX(measureRightX, spacing)
                  : null;
                const repeatRightGlyphX = finalBarlineGeomForRepeat
                  ? finalBarlineGeomForRepeat.thinCx
                  : measureRightX;
                const repeatRightTextAnchor = 'middle';
                const rowBarTop = staffY + firstLineY;
                const rowBarBottom = staffY + lastLineY;
                const repeatSmufl = getRepeatBarlineSmuflPlacement({
                  barTopY: rowBarTop,
                  barBottomY: rowBarBottom,
                  staffSpace: spacing,
                });

                return (
                  <g key={measureIdx}>
                    {measureWidth < (LAYOUT.MEASURE_MIN_WIDTH || 28) && (
                      <rect x={measureX - 1} y={staffY + firstLineY - 2} width={measureWidth + 2} height={lastLineY - firstLineY + 4} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" rx={2} />
                    )}
                    {showLayoutBreakIcons && typeof onToggleLineBreakAfter === 'function' && (
                      <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleLineBreakAfter(measureIdx); }} style={{ pointerEvents: 'auto' }} title={translateLabel ? translateLabel('layout.lineBreakAfter') : 'Reavahetus'}>
                        <rect x={measureX + measureWidth / 2 - 10} y={staffY - 18} width={20} height={16} rx={3} fill={layoutLineBreakBefore.includes(measureIdx + 1) ? '#f59e0b' : '#fef3c7'} stroke="#d97706" strokeWidth={1.2} />
                        <path d={`M ${measureX + measureWidth / 2 - 4} ${staffY - 10} L ${measureX + measureWidth / 2} ${staffY - 14} L ${measureX + measureWidth / 2 + 4} ${staffY - 10}`} fill="none" stroke="#92400e" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    )}
                    {(
                      <>
                        {/* Left barline: E040 / E042 (Leland); ühine loogika repeatBarlineResolve */}
                        {leftBarlineRepeat.variant === 'both' ? (
                          <g
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => {
                              e.stopPropagation();
                              if (prevIdxForRepeatPair != null) onRemoveRepeatMark(prevIdxForRepeatPair, 'repeatEnd');
                              onRemoveRepeatMark(measureIdx, 'repeatStart');
                            } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph
                              glyph={leftBarlineRepeat.glyph}
                              x={measureX}
                              y={repeatSmufl.y}
                              fontSize={repeatSmufl.fontSize}
                              fill="#1a1a1a"
                              textAnchor="middle"
                              dominantBaseline={repeatSmufl.dominantBaseline}
                              fontFamily={SMUFL_MUSIC_FONT_FAMILY}
                            />
                            {onRemoveRepeatMark && (
                              <rect x={measureX - spacing * 2} y={staffY + firstLineY - spacing} width={spacing * 4} height={lastLineY - firstLineY + spacing * 2} fill="transparent" />
                            )}
                          </g>
                        ) : leftBarlineRepeat.variant === 'start' ? (
                          <g
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'repeatStart'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph
                              glyph={leftBarlineRepeat.glyph}
                              x={measureX}
                              y={repeatSmufl.y}
                              fontSize={repeatSmufl.fontSize}
                              fill="#1a1a1a"
                              textAnchor="middle"
                              dominantBaseline={repeatSmufl.dominantBaseline}
                              fontFamily={SMUFL_MUSIC_FONT_FAMILY}
                            />
                            {onRemoveRepeatMark && (
                              <rect x={measureX - spacing * 2} y={staffY + firstLineY - spacing} width={spacing * 2} height={lastLineY - firstLineY + spacing * 2} fill="transparent" />
                            )}
                          </g>
                        ) : leftBarlineRepeat.variant === 'barline' && drawConnectedBarlinesHere ? (
                          <line
                            x1={measureX}
                            y1={barY1}
                            x2={measureX}
                            y2={barY2}
                            stroke="#1a1a1a"
                            strokeWidth={getThinBarlineThickness(spacing)}
                          />
                        ) : null}
                        {/* Right barline: E041 kui pole ühendatud E042-ga järgmise takti vasakul */}
                        {measure.repeatEnd && drawRepeatEndGlyphRight ? (
                          <g
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'repeatEnd'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph
                              glyph={SMUFL_GLYPH.repeatRight}
                              x={repeatRightGlyphX}
                              y={repeatSmufl.y}
                              fontSize={repeatSmufl.fontSize}
                              fill="#1a1a1a"
                              textAnchor={repeatRightTextAnchor}
                              dominantBaseline={repeatSmufl.dominantBaseline}
                              fontFamily={SMUFL_MUSIC_FONT_FAMILY}
                            />
                            {repeatEndAnchoredToFinalBarline && drawConnectedBarlinesHere && (
                              <line
                                x1={finalBarlineGeomForRepeat.thickCx}
                                y1={barY1}
                                x2={finalBarlineGeomForRepeat.thickCx}
                                y2={barY2}
                                stroke="#1a1a1a"
                                strokeWidth={finalBarlineGeomForRepeat.thickW}
                              />
                            )}
                            {onRemoveRepeatMark && (
                              <rect
                                x={Math.min(repeatRightGlyphX, measureRightX) - spacing * 2}
                                y={staffY + firstLineY - spacing}
                                width={Math.abs(measureRightX - repeatRightGlyphX) + spacing * 4}
                                height={lastLineY - firstLineY + spacing * 2}
                                fill="transparent"
                              />
                            )}
                          </g>
                        ) : drawConnectedBarlinesHere && measureIdx === sys.measureIndices[sys.measureIndices.length - 1] ? (
                          (measureIdx === instMeasures.length - 1 || measure.barlineFinal) ? (
                            (() => {
                              const { thinCx, thickCx, thinW, thickW } = getFinalDoubleBarlineCentersX(measureX + measureWidth, spacing);
                              const y1b = barY1;
                              const y2b = barY2;
                              return (
                            <g>
                              <line
                                x1={thinCx}
                                y1={y1b}
                                x2={thinCx}
                                y2={y2b}
                                stroke="#1a1a1a"
                                strokeWidth={thinW}
                              />
                              <line
                                x1={thickCx}
                                y1={y1b}
                                x2={thickCx}
                                y2={y2b}
                                stroke="#1a1a1a"
                                strokeWidth={thickW}
                              />
                            </g>
                              );
                            })()
                          ) : (
                            <line
                              x1={measureX + measureWidth}
                              y1={barY1}
                              x2={measureX + measureWidth}
                              y2={barY2}
                              stroke="#1a1a1a"
                              strokeWidth={getThinBarlineThickness(spacing)}
                            />
                          )
                        ) : drawConnectedBarlinesHere && measure.barlineFinal ? (
                          (() => {
                            const { thinCx, thickCx, thinW, thickW } = getFinalDoubleBarlineCentersX(measureX + measureWidth, spacing);
                            const y1b = barY1;
                            const y2b = barY2;
                            return (
                          <g>
                            <line
                              x1={thinCx}
                              y1={y1b}
                              x2={thinCx}
                              y2={y2b}
                              stroke="#1a1a1a"
                              strokeWidth={thinW}
                            />
                            <line
                              x1={thickCx}
                              y1={y1b}
                              x2={thickCx}
                              y2={y2b}
                              stroke="#1a1a1a"
                              strokeWidth={thickW}
                            />
                          </g>
                            );
                          })()
                        ) : null}
                      </>
                    )}
                    {/* Segno, coda: 1px above barline; volta. All clickable to remove. */}
                    {staffIndexInScore === 0 && (() => {
                      const placement = getRepeatMarkPlacement({ measureX, staffY, firstLineY, spacing });
                      const parts = [];
                      if (measure.segno) {
                        parts.push(
                          <g
                            key="segno"
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'segno'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph glyph={SMUFL_GLYPH.segno} x={measureX + spacing * 0.5} y={placement.segnoCodaY} fontSize={placement.fontSize} fill="#1a1a1a" />
                            {onRemoveRepeatMark && <rect x={measureX} y={placement.segnoCodaY - placement.hitH / 2} width={placement.hitW} height={placement.hitH} fill="transparent" />}
                          </g>
                        );
                      }
                      if (measure.coda) {
                        parts.push(
                          <g
                            key="coda"
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'coda'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph glyph={SMUFL_GLYPH.coda} x={measureX + spacing * 0.5} y={placement.segnoCodaY} fontSize={placement.fontSize} fill="#1a1a1a" />
                            {onRemoveRepeatMark && <rect x={measureX} y={placement.segnoCodaY - placement.hitH / 2} width={placement.hitW} height={placement.hitH} fill="transparent" />}
                          </g>
                        );
                      }
                      if (measure.volta1 || measure.volta2) {
                        const key = measure.volta2 ? 'volta2' : 'volta1';
                        const num = measure.volta2 ? '2' : '1';
                        parts.push(
                          <g
                            key="volta"
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, key); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <text x={placement.voltaTextX} y={placement.voltaTextY} textAnchor="start" fontSize={Math.round(spacing * 1.1)} fontWeight="bold" fill="#1a1a1a" fontFamily={TEXT_FONT_FAMILY}>{num}.</text>
                            {onRemoveRepeatMark && <rect x={measureX} y={placement.voltaTextY - spacing * 0.8} width={placement.hitW} height={placement.hitH} fill="transparent" />}
                          </g>
                        );
                      }
                      return parts.length ? <g key="repeatMarks">{parts}</g> : null;
                    })()}
                    {chords.filter(c => c.beatPosition >= measure.startBeat && c.beatPosition < measure.endBeat).map((chord) => {
                      const chordX = measureX + (chord.beatPosition - measure.startBeat) * beatWidth;
                      const useFigurations = (instrument === 'harpsichord' || instrument === 'organ') && instrumentNotationVariant === 'figuredBass' && chord.figuredBass;
                      return (
                        <g key={chord.id}>
                          <text x={chordX} y={staffY + firstLineY - 18} textAnchor="start" fontSize="14" fontWeight="bold" fill="#1a1a1a" fontFamily="sans-serif">{chord.chord}</text>
                          {chord.figuredBass && (useFigurations
                            ? renderFiguredBassFigurations(chord.figuredBass, { x: chordX, y: staffY + firstLineY - 4, fontSize: 11, fill: '#555' })
                            : <text x={chordX} y={staffY + firstLineY - 4} textAnchor="start" fontSize="11" fill="#555" fontFamily="serif">{chord.figuredBass}</text>
                          )}
                        </g>
                      );
                    })}
                    {measure.notes.map((note, noteIdx) => {
                      const noteX = getRenderedNoteCenterX(note, noteIdx);
                      let globalNoteIndex = 0;
                      for (let i = 0; i < measureIdx; i++) globalNoteIndex += (instMeasures[i]?.notes?.length ?? 0);
                      globalNoteIndex += noteIdx;
                      const pitchY = note.pitch && typeof note.octave === 'number' ? staffResolvePitchY(note.pitch, note.octave) : staffCenterY;
                      const noteY = staffY + pitchY;
                      const beamGroup = getBeamGroup(noteIdx);
                      const stemUp = beamGroup
                        ? beamGroup.stemUp
                        : isHandbellsStaff
                          ? true
                          : (pitchY > middleLineY);
                      const canDragPitch = !note.isRest && typeof onNotePitchChange === 'function' && typeof getPitchFromY === 'function' && !canHandDragNotes;
                      const canDragBeat = canHandDragNotes && typeof onNoteBeatChange === 'function';
                      const noteGroupProps = {
                        onClick: (e) => { e.stopPropagation(); onNoteClick?.(globalNoteIndex); },
                        onMouseDown: (e) => {
                          if (typeof onNoteMouseDown === 'function' && e.shiftKey) {
                            onNoteMouseDown(globalNoteIndex, e);
                            return;
                          }
                          if (canDragBeat && e.button === 0) {
                            e.stopPropagation();
                            setNoteBeatDrag({ noteIndex: globalNoteIndex, startClientX: e.clientX });
                            return;
                          }
                          if (!canDragPitch) return;
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          lastPitchRef.current = { pitch: note.pitch, octave: note.octave };
                          setNoteDrag({ noteIndex: globalNoteIndex, staffY });
                        },
                        onMouseEnter: typeof onNoteMouseEnter === 'function' ? (e) => onNoteMouseEnter(globalNoteIndex, e) : undefined,
                        style: { cursor: (onNoteClick || canDragPitch || canDragBeat) ? 'pointer' : undefined }
                      };
                      const restLabelY = staffY + lastLineY + spacing * 1.8;

                      if (note.isRest) {
                        const drawRestGlyph = shouldDrawRestGlyph(measure.notes, noteIdx);
                        const restSyllable = drawRestGlyph && showRhythmSyllables ? getRhythmSyllableForNote(note) : '';
                        const dur = note.durationLabel || '1/4';
                        const restAnchorY =
                          dur === '1/1'
                            ? staffY + staffLinePositions[1] // whole rest hangs from 2nd line (from top)
                            : dur === '1/2'
                              ? staffY + staffLinePositions[2] // half rest sits on middle line
                              : staffY + staffCenterY;
                        return (
                          <g key={noteIdx} {...noteGroupProps}>
                            {drawRestGlyph && renderStandardRest(note, noteX, restAnchorY, spacing)}
                            {drawRestGlyph && note.isDotted && (
                              <SmuflGlyph
                                x={getAugmentationDotXFromRestCenter(noteX, spacing)}
                                y={staffY + getRestAugmentationDotPitchY(firstLineY, spacing)}
                                glyph={SMUFL_GLYPH.augmentationDot}
                                fontSize={getGlyphFontSize(spacing)}
                                fill="var(--note-fill, #1a1a1a)"
                                dominantBaseline="central"
                              />
                            )}
                            {restSyllable && <RhythmSyllableLabel x={noteX} y={restLabelY} text={restSyllable} staffSpace={spacing} />}
                            {!drawRestGlyph && (
                              <rect
                                x={noteX - spacing * 2.25}
                                y={restAnchorY - spacing * 2.25}
                                width={spacing * 4.5}
                                height={spacing * 4.5}
                                fill="transparent"
                              />
                            )}
                          </g>
                        );
                      }

                      const isSelected = isNoteSelected ? isNoteSelected(globalNoteIndex) : false;
                      const resolvedAccidental = (note.accidental !== undefined && note.accidental !== null)
                        ? note.accidental
                        : getAccidentalForPitchInKey(note.pitch, keySignature);
                      const noteMidi = toNoteMidi(note.pitch, note.octave, resolvedAccidental);
                      const isOutOfRange = isMidiOutOfInstrumentRange(noteMidi, instrumentRangeMidi);
                      const isHandbellsInstrument = isHandbellsStaff;
                      const handbellColor = getSchoolHandbellColor(note.pitch, resolvedAccidental || 0);
                      const noteFillColor = isOutOfRange ? OUT_OF_RANGE_COLOR : (isHandbellsInstrument ? handbellColor : 'var(--note-fill, #1a1a1a)');
                      const ledgerHalfWidth = getLedgerHalfWidth(spacing);
                      const { above: nLedgerAbove, below: nLedgerBelow } = getLedgerLineCountExact(pitchY, firstLineY, lastLineY, spacing);
                      const glyph = getNoteheadGlyph(note.durationLabel, noteheadShape, noteheadEmoji);
                      const stemLenDefault = getStemLength(spacing);
                      const stemStrokeW = getStemThickness(spacing);
                      const stemX = getStemCenterXFromNoteCenter(noteX, spacing, stemUp);
                      const stemY1 = noteY;
                      const stemLen = beamGroup ? (beamGroup.stemLengths[noteIdx - beamGroup.start] ?? stemLenDefault) : stemLenDefault;
                      const stemY2 = stemUp ? (stemY1 - stemLen) : (stemY1 + stemLen);
                      const flagCount = beamGroup ? 0 : getFlagCount(note.durationLabel);
                      const rhythmType = smuflPrecomposedTypeForDurationLabel(note.durationLabel);
                      const precomposedGlyph = smuflPrecomposedNote(rhythmType, stemUp, true);
                      const useLelandPrecomposedRhythm =
                        !beamGroup &&
                        noteheadShape === 'oval' &&
                        precomposedGlyph != null;
                      const glyphFontSize = getGlyphFontSize(spacing);

                      return (
                        <g key={noteIdx} {...noteGroupProps}>
                          {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                            <line key={`la-${i}`} x1={noteX - ledgerHalfWidth} y1={staffY + firstLineY - (i + 1) * spacing} x2={noteX + ledgerHalfWidth} y2={staffY + firstLineY - (i + 1) * spacing} stroke="#333" strokeWidth={getLegerLineThickness(spacing)} />
                          ))}
                          {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                            <line key={`lb-${i}`} x1={noteX - ledgerHalfWidth} y1={staffY + lastLineY + (i + 1) * spacing} x2={noteX + ledgerHalfWidth} y2={staffY + lastLineY + (i + 1) * spacing} stroke="#333" strokeWidth={getLegerLineThickness(spacing)} />
                          ))}
                          {isSelected && <rect x={noteX - 18} y={noteY - 22} width={36} height={44} fill="#93c5fd" opacity="0.3" rx="4" />}
                          {(note.accidental === 1 || note.accidental === -1 || (note.accidental === 0 && getAccidentalForPitchInKey(note.pitch, keySignature) !== 0)) && (
                            <text x={noteX - (noteheadRx + ensureMinGlyphHorizontalGapPx(spacing * 0.5))} y={noteY} textAnchor="middle" dominantBaseline="central" fontSize={Math.round(spacing * 1.4)} fill={noteFillColor} fontFamily="serif">{note.accidental === 1 ? '♯' : note.accidental === -1 ? '♭' : '♮'}</text>
                          )}
                          {useLelandPrecomposedRhythm ? (
                            <SmuflGlyph
                              x={noteX}
                              y={noteY}
                              glyph={precomposedGlyph}
                              fontSize={glyphFontSize}
                              fill={noteFillColor}
                              dominantBaseline="central"
                            />
                          ) : (
                            <>
                              {isHandbellsInstrument ? (
                                <HandbellIcon x={noteX} y={noteY} size={Math.max(14, spacing * 1.75)} fill={noteFillColor} />
                              ) : glyph ? (
                                <SmuflGlyph
                                  x={noteX}
                                  y={noteY}
                                  glyph={glyph}
                                  fontSize={glyphFontSize}
                                  fill={noteFillColor}
                                  dominantBaseline="central"
                                />
                              ) : (
                                <text x={noteX} y={noteY} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(18, glyphFontSize)} fill={noteFillColor}>{noteheadEmoji}</text>
                              )}
                              {/* Talatud / erikujulised pead: noodipea + vars + SMuFL lipud (valmisnooti pole x/ruut/triangle) */}
                              {note.durationLabel !== '1/1' && (
                                <g>
                                  <line
                                    x1={stemX}
                                    y1={stemY1}
                                    x2={stemX}
                                    y2={stemY2}
                                    stroke={noteFillColor}
                                    strokeWidth={stemStrokeW}
                                    strokeLinecap="butt"
                                  />
                                  {flagCount > 0 && (
                                    <SmuflStemFlags
                                      stemX={stemX}
                                      stemEndY={stemY2}
                                      staffSpace={spacing}
                                      stemUp={stemUp}
                                      count={flagCount}
                                      fill={noteFillColor}
                                    />
                                  )}
                                </g>
                              )}
                            </>
                          )}
                          {beamGroup && noteIdx === beamGroup.start && (() => {
                            const thick = getBeamThickness(spacing);
                            const gap = getBeamGap(spacing);
                            const offset = thick + gap;
                            const dir = beamGroup.stemUp ? -1 : 1;
                            const slope = beamGroup.beamSlope ?? 0;
                            const xs = beamGroup.stemXsInGroup;
                            const sw = beamGroup.stemW ?? getStemThickness(spacing);
                            const beams = [];
                            for (let b = beamGroup.numBeams - 1; b >= 0; b--) {
                              let xL = beamGroup.beamXLeft;
                              let xR = beamGroup.beamXRight;
                              if (b >= 1 && beamGroup.beamLevels && xs?.length) {
                                const idxMin = beamGroup.beamLevels.findIndex((lev) => lev >= b + 1);
                                const idxMax = beamGroup.beamLevels.length - 1 - [...beamGroup.beamLevels].reverse().findIndex((lev) => lev >= b + 1);
                                if (idxMin >= 0 && idxMax >= 0) {
                                  xL = xs[idxMin] - sw / 2;
                                  xR = xs[idxMax] + sw / 2;
                                }
                              }
                              const swap = beamGroup.mixedBeamStackSwap;
                              const dy = (swap ? beamGroup.numBeams - 1 - b : b) * offset * dir;
                              const yL =
                                staffY +
                                beamLineYAtX(beamGroup.beamY1, slope, beamGroup.xLeft, xL, dy);
                              const yR =
                                staffY +
                                beamLineYAtX(beamGroup.beamY1, slope, beamGroup.xLeft, xR, dy);
                              beams.push(
                                <line
                                  key={b}
                                  x1={xL}
                                  y1={yL}
                                  x2={xR}
                                  y2={yR}
                                  stroke="#1a1a1a"
                                  strokeWidth={thick}
                                  strokeLinecap="butt"
                                />
                              );
                            }
                            return <g>{beams}</g>;
                          })()}
                          {note.isDotted && (() => {
                            const dotX = getAugmentationDotXFromNoteCenter(noteX, spacing);
                            const dotPitchY = getAugmentationDotCenterPitchY(pitchY, firstLineY, spacing);
                            const dotY = staffY + dotPitchY;
                            return (
                              <SmuflGlyph
                                key="aug-dot"
                                x={dotX}
                                y={dotY}
                                glyph={SMUFL_GLYPH.augmentationDot}
                                fontSize={glyphFontSize}
                                fill={noteFillColor}
                                dominantBaseline="central"
                              />
                            );
                          })()}
                          {(note.lyric != null && String(note.lyric).trim() !== '') && (
                            <text x={noteX} y={staffY + lastLineY + (Math.max(1, Number(lyricFontSize)) || 12) * 1.5 + (lyricLineYOffset || 0)} textAnchor="middle" fontSize={Math.max(1, Number(lyricFontSize)) || 12} fill="#333" fontFamily={lyricFontFamily}>{note.lyric}</text>
                          )}
                          {(note.lyric2 != null && String(note.lyric2).trim() !== '') && (
                            <text x={noteX} y={staffY + lastLineY + (Math.max(1, Number(lyricFontSize)) || 12) * 2.8 + (lyricLineYOffset || 0)} textAnchor="middle" fontSize={Math.max(1, Number(lyricFontSize)) || 12} fill="#555" fontFamily={lyricFontFamily}>{note.lyric2}</text>
                          )}
                          {showRhythmSyllables && (() => {
                            const labelY = staffY + lastLineY + spacing * 1.8;
                            if (beamGroup && noteIdx === beamGroup.start) {
                              const groupNotes = measure.notes.slice(beamGroup.start, beamGroup.end + 1);
                              const syllable = getRhythmSyllableForNote(note, { beamGroupNotes: groupNotes });
                              const xCenter = (beamGroup.beamXLeft + beamGroup.beamXRight) / 2;
                              return <RhythmSyllableLabel key="syl" x={xCenter} y={labelY} text={syllable} staffSpace={spacing} />;
                            }
                            if (!beamGroup) {
                              const syllable = getRhythmSyllableForNote(note);
                              return <RhythmSyllableLabel key="syl" x={noteX} y={labelY} text={syllable} staffSpace={spacing} />;
                            }
                            return null;
                          })()}
                          {enableEmojiOverlays && (isVabanotatsioon || true) && (() => {
                            const labelAboveY = staffY + pitchY - spacing * 2.2;
                            const hasCustom = note.teacherLabel != null && note.teacherLabel !== '';
                            const displayText = hasCustom ? expandEmojiShortcuts(note.teacherLabel) : (showAllNoteLabels && isVabanotatsioon ? getJoName(note.pitch, note.octave, keySignature) : '');
                            const canEdit = typeof onNoteLabelClick === 'function';
                            return (
                              <g key="teacher-label" data-teacher-label style={{ cursor: canEdit ? 'pointer' : undefined }} onClick={canEdit ? (ev) => { ev.stopPropagation(); onNoteLabelClick(globalNoteIndex); } : undefined} title={canEdit ? (translateLabel ? translateLabel('teacher.noteLabelHint') : null) || 'Klõpsa valimiseks' : undefined}>
                                {displayText ? <text x={noteX} y={labelAboveY} textAnchor="middle" dominantBaseline="auto" fontSize={Math.max(10, spacing * 1.0)} fill="#333" fontFamily="sans-serif" fontWeight="600">{displayText}</text> : <rect x={noteX - 14} y={labelAboveY - 12} width={28} height={14} fill="transparent" />}
                              </g>
                            );
                          })()}
                          {showTinWhistleLinkedFingeringForInst(inst) && note.pitch && typeof note.octave === 'number' && (() => {
                            const effectivePitch = pitchWithAccidental(note.pitch, resolvedAccidental);
                            const fingeringPattern = getTinWhistleFingeringPattern(effectivePitch, note.octave);
                            const baseTinWhistleFingeringY = staffY + lastLineY + spacing * (showRhythmSyllables ? 2.35 : 1.55);
                            const tinStructuralBottom = getTinWhistleStructuralBottomGlobalY({
                              noteY,
                              staffY,
                              spacing,
                              stemUp,
                              stemY2,
                              durationLabel: note.durationLabel,
                              beamGroup,
                              noteIdx,
                            });
                            const hasBeamBelow =
                              beamGroup &&
                              noteIdx >= beamGroup.start &&
                              noteIdx <= beamGroup.end &&
                              !beamGroup.stemUp;
                            const fingeringLabelY = Math.max(
                              baseTinWhistleFingeringY,
                              getTinWhistleTopHoleCenterYMinFromStructuralBottom(
                                tinStructuralBottom,
                                spacing,
                                tinWhistleFingeringScale,
                                hasBeamBelow ? TIN_WHISTLE_BEAM_TO_RING_GAP_MIN_PX : undefined,
                              ),
                            );
                            if (fingeringPattern) {
                              return (
                                <TinWhistleFingeringSvg
                                  key="tinwhistle-fingering-svg"
                                  x={noteX}
                                  y={fingeringLabelY}
                                  staffSpace={spacing}
                                  pattern={fingeringPattern}
                                  scale={tinWhistleFingeringScale}
                                />
                              );
                            }
                            // Fallback (rare accidental/out-of-map note): keep legacy text marker.
                            const fallbackName = `${effectivePitch}${note.octave}`;
                            return (
                              <text
                                key="tinwhistle-fingering-fallback"
                                x={noteX}
                                y={fingeringLabelY}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fontSize={Math.max(10, spacing * 1.1 * tinWhistleFingeringScale)}
                                fill="var(--note-fill, #1a1a1a)"
                                fontFamily={tinWhistleFontFamily}
                              >
                                {fallbackName}
                              </text>
                            );
                          })()}
                          {showRecorderLinkedFingeringForInst(inst) && note.pitch && typeof note.octave === 'number' && (() => {
                            const char = getRecorderFingeringChar(note.pitch, note.octave);
                            if (!char) return null;
                            const fingeringLabelY = staffY + lastLineY + spacing * (showRhythmSyllables ? 2.6 : 1.8);
                            return (
                              <text
                                key="recorder-fingering"
                                x={noteX}
                                y={fingeringLabelY}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fontSize={Math.max(12, spacing * 1.4)}
                                fill="var(--note-fill, #1a1a1a)"
                                fontFamily={recorderFontFamily}
                              >
                                {char}
                              </text>
                            );
                          })()}
                        </g>
                      );
                    })}
                  </g>
                );
              });
            })()}

                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
