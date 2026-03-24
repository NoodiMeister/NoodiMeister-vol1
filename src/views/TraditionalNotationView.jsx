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
import { expandEmojiShortcuts } from '../utils/emojiShortcuts';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH, NOTEHEAD_SHAPE_GLYPH, smuflRestForDurationLabel, smuflTimeSigDigitsForNumber } from '../notation/smufl/glyphs';
import { TIME_SIG_LAYOUT, getTraditionalTimeSignatureX } from '../notation/TimeSignatureLayout';
import {
  getStaffLinePositions,
  getYFromStaffPosition,
  getLedgerLineCountExact,
  getNoteheadRx,
  getLedgerHalfWidth,
  getVerticalPosition,
  getStemLength,
  getStaffLineThickness,
  getLegerLineThickness,
  getStemThickness,
  getThinBarlineThickness,
} from '../notation/StaffConstants';
import { getGlyphFontSize, TEXT_FONT_FAMILY, getThickBarlineThickness, BARLINE_SEPARATION } from '../notation/musescoreStyle';
import {
  computeBeamGroups,
  computeBeamGeometry,
  getBeamThickness,
  getBeamGap,
} from '../notation/BeamCalculation';
import { renderFiguredBassFigurations } from '../notation/figuredBassFigurations';
import { hasBundledOptionalFont } from '../export/exportFontAssets';

const LAYOUT = { MARGIN_LEFT: 60, CLEF_WIDTH: 45, MEASURE_MIN_WIDTH: 28 };

/** Leland thinThickBarlineSeparation: kaks selget joont (õhuke, siis paks), keskpunktid taktirea lõpus. */
function getFinalDoubleBarlineCentersX (rightEdgeX, staffSpace) {
  const thinW = getThinBarlineThickness(staffSpace);
  const thickW = getThickBarlineThickness(staffSpace);
  const gap = BARLINE_SEPARATION * staffSpace;
  const thickCx = rightEdgeX;
  const thinCx = thickCx - (thickW / 2 + gap + thinW / 2);
  return { thinCx, thickCx, thinW, thickW };
}
const PAGE_BREAK_GAP = 80;
const STAFF_SPACE = 10;
/** Left edge of staff lines: after system bracket + instrument brace (piano). Clef is 1px to the right. */
const STAFF_LEFT_WITH_BRACE = 44;
const STAFF_LEFT_WITHOUT_BRACE = 10;
const GAP_BEFORE_CLEF_PX = 6;
/** Treble clef anchor moved one staff line upward for current score alignment. */
const TREBLE_CLEF_LINE_INDEX = 2; // 0=top line ... 4=bottom line

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

/** Tin whistle fingering: note name for tab (a, b, c, d, e, f, g, c#). */
function getTinWhistleNotationName(pitch, octave) {
  if (!pitch || typeof octave !== 'number') return '';
  const letter = pitch.replace(/[#b]/, '');
  const lower = { C: 'c', D: 'd', E: 'e', F: 'f', G: 'g', A: 'a', B: 'b' }[letter] || 'c';
  return pitch.includes('#') ? lower + '#' : lower;
}

/** Recorder (soprano C) fingering: note name for RecorderFont finger table (C, D, E, F, G, A, B, C#, etc.). */
function getRecorderFingeringChar(pitch, octave) {
  if (!pitch || typeof octave !== 'number') return '';
  const letter = pitch.replace(/[#b]/, '');
  const base = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' }[letter] || 'C';
  return pitch.includes('#') ? base + '#' : pitch.includes('b') ? base + 'b' : base;
}

function Flags({ stemX, stemEndY, staffSpace, stemUp, count = 1 }) {
  const elements = [];
  const strokeW = getStemThickness(staffSpace);
  const flagGap = staffSpace * 0.8;
  for (let i = 0; i < count; i++) {
    const yOffset = i * flagGap * (stemUp ? 1 : -1);
    const startY = stemEndY + yOffset;
    const curve = stemUp
      ? `M ${stemX} ${startY} c ${staffSpace * 0.8} ${staffSpace * 0.2} ${staffSpace * 1.2} ${staffSpace * 1.5} ${staffSpace * 1.2} ${staffSpace * 2.5}`
      : `M ${stemX} ${startY} c ${staffSpace * 0.8} ${-staffSpace * 0.2} ${staffSpace * 1.2} ${-staffSpace * 1.5} ${staffSpace * 1.2} ${-staffSpace * 2.5}`;
    elements.push(
      <path
        key={i}
        d={curve}
        fill="none"
        stroke="var(--note-fill, #1a1a1a)"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
    );
  }
  return <g>{elements}</g>;
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

function renderTimeSignature(timeSignature, timeSignatureMode, centerY, textColor = '#333', noteFill = '#333', x = 45) {
  const L = TIME_SIG_LAYOUT;
  const y = centerY - 2;
  const extraVerticalGapPx = 5;
  const halfGap = extraVerticalGapPx / 2;
  const yLine = y + L.Y_LINE;
  const fNum = 52;
  const fDen = 52;
  const fDenFallback = 50;
  const numeratorDigits = <TimeSigDigits x={x} y={y + L.Y_NUM - halfGap - 10} fontSize={fNum} number={timeSignature.beats} fill={textColor} />;
  if (timeSignatureMode === 'pedagogical') {
    const stemX = x + L.STEM_X_OFFSET;
    const getNoteSymbolForDenominator = () => {
      const noteX = x + L.NOTE_X_OFFSET;
      const noteY = y + L.NOTE_Y;
      const stemY1 = y + L.STEM_Y1;
      const stemY2 = y + L.STEM_Y2;
      switch (timeSignature.beatUnit) {
        case 1: return <ellipse cx={noteX} cy={noteY} rx={L.WHOLE_RX} ry={L.WHOLE_RY} fill="none" stroke={textColor} strokeWidth="1.5" />;
        case 2: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill="none" stroke={textColor} strokeWidth="1.5" /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /></>);
        case 4: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill={noteFill} /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /></>);
        case 8: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill={noteFill} /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /><path d={`M ${stemX} ${stemY2} Q ${stemX - 6} ${stemY2 - 2} ${stemX} ${stemY2 - 5}`} fill={noteFill} /></>);
        case 16: return (<><ellipse cx={noteX} cy={noteY} rx={L.ELLIPSE_RX} ry={L.ELLIPSE_RY} fill={noteFill} /><line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={textColor} strokeWidth="1.5" /><path d={`M ${stemX} ${stemY2} Q ${stemX - 6} ${stemY2 - 2} ${stemX} ${stemY2 - 5} M ${stemX} ${stemY2 - 3} Q ${stemX - 6} ${stemY2 - 5} ${stemX} ${stemY2 - 8}`} fill={noteFill} /></>);
        default: return <TimeSigDigits x={noteX} y={stemY2} fontSize={fDenFallback} number={timeSignature.beatUnit} fill={textColor} />;
      }
    };
    return (<g><g stroke="none">{numeratorDigits}</g><line x1={x - L.LINE_HALF} y1={yLine} x2={x + L.LINE_HALF} y2={yLine} stroke={textColor} strokeWidth="1.5" />{getNoteSymbolForDenominator()}</g>);
  }
  return (
    <g>
      {numeratorDigits}
      <line x1={x - L.LINE_HALF} y1={yLine} x2={x + L.LINE_HALF} y2={yLine} stroke={textColor} strokeWidth="1.5" />
      <TimeSigDigits x={x} y={y + L.Y_DEN + halfGap} fontSize={fDen} number={timeSignature.beatUnit} fill={textColor} />
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
      fontSize={staffSpace * 4.5}
      fill="var(--note-fill, #1a1a1a)"
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
  instrumentNotationVariant = 'standard',
  connectedBarlines = false,
  staffIndexInScore = 0,
  systemTotalHeight,
  themeColors,
  onRemoveRepeatMark, // (measureIndex, markType: 'repeatStart'|'repeatEnd'|'segno'|'coda'|'volta1'|'volta2') => void
}) {
  const spacing = staffSpaceProp ?? STAFF_SPACE;
  const centerY = timelineHeight / 2;
  const timeSigTextColor = themeColors?.textColor ?? '#333';
  const timeSigNoteFill = themeColors?.noteFill ?? '#333';
  const [, setOptionalFontVersion] = useState(0);
  const [noteDrag, setNoteDrag] = useState(null); // { noteIndex, staffY } when dragging a note to change pitch
  const [noteBeatDrag, setNoteBeatDrag] = useState(null); // { noteIndex, startClientX } when hand tool dragging note to new beat
  const lastPitchRef = useRef(null); // avoid duplicate updates when pitch unchanged
  const tinWhistleFontFamily = hasBundledOptionalFont('TinWhistleTab') ? 'TinWhistleTab' : 'Noto Sans';
  const recorderFontFamily = hasBundledOptionalFont('RecorderFont') ? 'RecorderFont' : 'Noto Sans';

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
  const minContentStart = staffLeft + 1 + LAYOUT.CLEF_WIDTH + 1 + 24 + timeSigWidthPx + 2;
  const effectiveMarginLeft = Math.max(marginLeft, minContentStart);

  // Measure layout for getBeatFromX (first system only; notation starts at effectiveMarginLeft after clef/key/time sig)
  const measureLayout = React.useMemo(() => {
    const sys = systems?.[0];
    if (!sys || !effectiveMeasuresProp) return [];
    const mw = sys.measureWidths ?? [];
    const beatsPerMeasure = timeSignature?.beats ?? 4;
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
  const middleLineY = centerY;
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
  const isVabanotatsioon = notationMode === 'vabanotatsioon';

  const staffList = multiStaff ? instruments : [{ id: '_single', name: '', clef: clefType }];

  /** System bracket (Leland): bracketTop + vertical line + bracketBottom when multiple staves and connected barlines */
  const showSystemBracket = connectedBarlines && staffIndexInScore === 0 && typeof systemTotalHeight === 'number' && systemTotalHeight > 0;
  const systemBracketX = 10;
  const systemBracketCapSize = 14;

  return (
    <g className="traditional-notation">
      {systems.map((sys) => {
        const pageIndex = isHorizontal ? Math.floor(sys.yOffset / a4PageHeight) : 0;
        const groupTransform = isHorizontal && pageWidth ? `translate(${pageIndex * pageWidth}, ${-pageIndex * a4PageHeight})` : undefined;
        const bracketTopY = sys.yOffset;
        const bracketBottomY = sys.yOffset + systemTotalHeight;
        return (
          <g key={sys.systemIndex} transform={groupTransform}>
            {/* System bracket from Leland (SMuFL bracketTop + line + bracketBottom) – groups all parts in one system */}
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
                />
              </g>
            )}
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

                  {/* Partii rida: instrumendi nimi vasakul, siis noodivõti */}
                  {multiStaff && inst.name && (
                    <text
                      x={4}
                      y={staffY + staffCenterY}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fontSize={Math.max(10, spacing * 1.2)}
                      fontFamily="sans-serif"
                      fontWeight="600"
                      fill="#333"
                    >
                      {inst.name}
                    </text>
                  )}
                  {/* Üks noodivõti per staff (1px from left edge of staff; order: staff, 1px gap, clef, key marks if on, time sig first bar only, repeat, notation) */}
                  {staffLines === 5 && (
                    (() => {
                      const nameWidth = multiStaff ? 50 : 0;
                      const clefXStaff = clefX + nameWidth;
                      if (multiStaff) {
                        const clefY = instClef === 'treble' ? staffY + trebleGLine : instClef === 'bass' ? staffY + bassFLine : instClef === 'tenor' ? staffY + cClefTenorLine : staffY + cClefAltoLine;
                        return (
                          <StaffClefSymbol
                            key={`clef-${sys.systemIndex}-${staffIndex}-${instClef}`}
                            x={clefXStaff}
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
                        let currentX = clefXStaff;
                        const joClefCenterY = staffY + joKeyY;
                        const { above: ledgerAbove, below: ledgerBelow } = getLedgerLineCountExact(joKeyY, firstLineY, lastLineY, spacing);
                        const joClefWidthPx = getJoClefPixelWidth(spacing);
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
                              <rect x={currentX - 2} y={joClefCenterY - spacing * 2 - 4} width={24} height={spacing * 4 + 8} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="4 2" rx="2" />
                            )}
                          </g>
                        );
                        currentX += LAYOUT.CLEF_WIDTH;
                        if (relativeNotationShowTraditionalClef) {
                          const tradY = clefType === 'treble' ? staffY + trebleGLine : clefType === 'bass' ? staffY + bassFLine : clefType === 'tenor' ? staffY + cClefTenorLine : staffY + cClefAltoLine;
                          g.push(<StaffClefSymbol key="trad-clef" x={currentX} y={tradY} height={clefFontSize} clefType={clefType} fill="#000" staffSpace={spacing} />);
                          currentX += LAYOUT.CLEF_WIDTH;
                        }
                        if (relativeNotationShowKeySignature && keySignature && keySignature !== 'C') {
                          const sharpCount = { G: 1, D: 2, A: 3, E: 4, B: 5 }[keySignature] || 0;
                          const flatCount = { F: 1, Bb: 2, Eb: 3 }[keySignature] || 0;
                          const sym = flatCount ? '♭' : '♯';
                          for (let i = 0; i < (sharpCount || flatCount); i++) {
                            g.push(<text key={`ks-${i}`} x={currentX + i * 10} y={staffY + centerY - 8} fontSize="20" fontFamily="serif" fill="#333" textAnchor="middle" dominantBaseline="middle">{sym}</text>);
                          }
                          currentX += Math.max(sharpCount, flatCount) * 12;
                        }
                        return <g>{g}</g>;
                      }
                      const clefY = clefType === 'treble' ? staffY + trebleGLine : clefType === 'bass' ? staffY + bassFLine : clefType === 'tenor' ? staffY + cClefTenorLine : staffY + cClefAltoLine;
                      return (
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
                      const sharpCount = (relativeNotationShowKeySignature && keySignature && keySignature !== 'C') ? ({ G: 1, D: 2, A: 3, E: 4, B: 5 }[keySignature] || 0) : 0;
                      const flatCount = (relativeNotationShowKeySignature && keySignature && keySignature !== 'C') ? ({ F: 1, Bb: 2, Eb: 3 }[keySignature] || 0) : 0;
                      const keySigCount = Math.max(sharpCount, flatCount);
                      const timeSigX = getTraditionalTimeSignatureX({
                        staffLeft,
                        clefWidth: LAYOUT.CLEF_WIDTH,
                        keySigCount,
                        extraLeft: multiStaff ? 50 : 0,
                        measureStartX: effectiveMarginLeft,
                      });
                      return (
                        <g transform={`translate(${timeSigX}, ${staffY})`}>{renderTimeSignature(timeSignature, timeSignatureMode, centerY, timeSigTextColor, timeSigNoteFill, 0)}</g>
                      );
                    })()
                  )}

                  {/* Taktid: jooned, akordid, nootid (per staff) */}
                  {Array.isArray(instMeasures) && (() => {
                    const beatsPerMeasure = timeSignature?.beats ?? 4;
                    return sys.measureIndices.map((measureIdx, j) => {
                      const measure = instMeasures[measureIdx];
                      if (!measure) return null;
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

                const noteheadRx = getNoteheadRx(spacing);
                const beamGroupsRaw = computeBeamGroups(measure.notes, measure.startBeat, timeSignature);
                const beamGroups = beamGroupsRaw.map((gr) => {
                  const noteXs = [];
                  const noteCys = [];
                  for (let k = gr.start; k <= gr.end; k++) {
                    const n = measure.notes[k];
                    noteXs.push(getNoteSlotCenterX(n));
                    const py = n.pitch && typeof n.octave === 'number' ? staffResolvePitchY(n.pitch, n.octave) : staffCenterY;
                    noteCys.push(py);
                  }
                  // VexFlow/MuseScore reegel: alla keskmise joone = vars üles; üle keskmise joone = vars alla.
                  let stemUp = noteCys[0] > middleLineY;
                  if (noteCys.length > 0) {
                    const avg = noteCys.reduce((s, cy) => s + cy, 0) / noteCys.length;
                    stemUp = avg > middleLineY;
                  }
                  const geom = computeBeamGeometry(gr, measure.notes, noteXs, noteCys, stemUp, spacing);
                  return { ...gr, ...geom, noteXs, noteCys };
                });
                const getBeamGroup = (noteIdx) => beamGroups.find(g => noteIdx >= g.start && noteIdx <= g.end);

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
                    {!(connectedBarlines && staffIndexInScore > 0) && (
                      <>
                        {/* Left barline: turn into repeat-start symbol when measure.repeatStart (including first bar of line) */}
                        {measure.repeatStart ? (
                          <g
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'repeatStart'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph
                              glyph={SMUFL_GLYPH.repeatLeft}
                              x={measureX}
                              y={connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY)) / 2 : staffY + (firstLineY + lastLineY) / 2}
                              fontSize={getGlyphFontSize(spacing) * (connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY - firstLineY)) / (lastLineY - firstLineY) : 1)}
                              fill="#1a1a1a"
                              textAnchor="end"
                            />
                            {onRemoveRepeatMark && (
                              <rect x={measureX - spacing * 2} y={staffY + firstLineY - spacing} width={spacing * 2} height={lastLineY - firstLineY + spacing * 2} fill="transparent" />
                            )}
                          </g>
                        ) : j !== 0 ? (
                          <line
                            x1={measureX}
                            y1={connectedBarlines && staffIndexInScore === 0 ? 0 : staffY + firstLineY}
                            x2={measureX}
                            y2={connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY)) : staffY + lastLineY}
                            stroke="#1a1a1a"
                            strokeWidth={getThinBarlineThickness(spacing)}
                          />
                        ) : null}
                        {/* Right barline: turn into repeat-end symbol when measure.repeatEnd */}
                        {measure.repeatEnd ? (
                          <g
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'repeatEnd'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph
                              glyph={SMUFL_GLYPH.repeatRight}
                              x={measureX + measureWidth}
                              y={connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY)) / 2 : staffY + (firstLineY + lastLineY) / 2}
                              fontSize={getGlyphFontSize(spacing) * (connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY - firstLineY)) / (lastLineY - firstLineY) : 1)}
                              fill="#1a1a1a"
                              textAnchor="start"
                            />
                            {onRemoveRepeatMark && (
                              <rect x={measureX + measureWidth} y={staffY + firstLineY - spacing} width={spacing * 2} height={lastLineY - firstLineY + spacing * 2} fill="transparent" />
                            )}
                          </g>
                        ) : measureIdx === sys.measureIndices[sys.measureIndices.length - 1] ? (
                          (measureIdx === instMeasures.length - 1 || measure.barlineFinal) ? (
                            (() => {
                              const { thinCx, thickCx, thinW, thickW } = getFinalDoubleBarlineCentersX(measureX + measureWidth, spacing);
                              const y1b = connectedBarlines && staffIndexInScore === 0 ? 0 : staffY + firstLineY;
                              const y2b = connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY)) : staffY + lastLineY;
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
                              y1={connectedBarlines && staffIndexInScore === 0 ? 0 : staffY + firstLineY}
                              x2={measureX + measureWidth}
                              y2={connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY)) : staffY + lastLineY}
                              stroke="#1a1a1a"
                              strokeWidth={getThinBarlineThickness(spacing)}
                            />
                          )
                        ) : measure.barlineFinal ? (
                          (() => {
                            const { thinCx, thickCx, thinW, thickW } = getFinalDoubleBarlineCentersX(measureX + measureWidth, spacing);
                            const y1b = connectedBarlines && staffIndexInScore === 0 ? 0 : staffY + firstLineY;
                            const y2b = connectedBarlines && staffIndexInScore === 0 ? (systemTotalHeight ?? (staffY + lastLineY)) : staffY + lastLineY;
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
                      const fs = getGlyphFontSize(spacing);
                      const barlineTopY = staffY + firstLineY;
                      const gapPx = 1;
                      const segnoCodaY = barlineTopY - gapPx - (fs * 0.9 * 0.5);
                      const hitW = spacing * 2.5;
                      const hitH = spacing * 2;
                      const parts = [];
                      if (measure.segno) {
                        parts.push(
                          <g
                            key="segno"
                            onClick={typeof onRemoveRepeatMark === 'function' ? (e) => { e.stopPropagation(); onRemoveRepeatMark(measureIdx, 'segno'); } : undefined}
                            style={{ cursor: onRemoveRepeatMark ? 'pointer' : undefined }}
                            pointerEvents={onRemoveRepeatMark ? 'auto' : 'none'}
                          >
                            <SmuflGlyph glyph={SMUFL_GLYPH.segno} x={measureX + spacing * 0.5} y={segnoCodaY} fontSize={fs * 0.9} fill="#1a1a1a" />
                            {onRemoveRepeatMark && <rect x={measureX} y={segnoCodaY - hitH / 2} width={hitW} height={hitH} fill="transparent" />}
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
                            <SmuflGlyph glyph={SMUFL_GLYPH.coda} x={measureX + spacing * 0.5} y={segnoCodaY} fontSize={fs * 0.9} fill="#1a1a1a" />
                            {onRemoveRepeatMark && <rect x={measureX} y={segnoCodaY - hitH / 2} width={hitW} height={hitH} fill="transparent" />}
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
                            <text x={measureX + spacing * 0.3} y={staffY + firstLineY - spacing * 1.2} textAnchor="start" fontSize={Math.round(spacing * 1.1)} fontWeight="bold" fill="#1a1a1a" fontFamily={TEXT_FONT_FAMILY}>{num}.</text>
                            {onRemoveRepeatMark && <rect x={measureX} y={staffY + firstLineY - spacing * 2} width={hitW} height={hitH} fill="transparent" />}
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
                      const noteX = getNoteSlotCenterX(note);
                      let globalNoteIndex = 0;
                      for (let i = 0; i < measureIdx; i++) globalNoteIndex += (instMeasures[i]?.notes?.length ?? 0);
                      globalNoteIndex += noteIdx;
                      const pitchY = note.pitch && typeof note.octave === 'number' ? staffResolvePitchY(note.pitch, note.octave) : staffCenterY;
                      const noteY = staffY + pitchY;
                      const beamGroup = getBeamGroup(noteIdx);
                      const stemUp = beamGroup ? beamGroup.stemUp : (pitchY > middleLineY);
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
                        const restSyllable = showRhythmSyllables ? getRhythmSyllableForNote(note) : '';
                        const dur = note.durationLabel || '1/4';
                        const restAnchorY =
                          dur === '1/1'
                            ? staffY + staffLinePositions[1] // whole rest hangs from 2nd line (from top)
                            : dur === '1/2'
                              ? staffY + staffLinePositions[2] // half rest sits on middle line
                              : staffY + staffCenterY;
                        return (
                          <g key={noteIdx} {...noteGroupProps}>
                            {renderStandardRest(note, noteX, restAnchorY, spacing)}
                            {restSyllable && <RhythmSyllableLabel x={noteX} y={restLabelY} text={restSyllable} staffSpace={spacing} />}
                          </g>
                        );
                      }

                      const isSelected = isNoteSelected ? isNoteSelected(globalNoteIndex) : false;
                      const ledgerHalfWidth = getLedgerHalfWidth(spacing);
                      const { above: nLedgerAbove, below: nLedgerBelow } = getLedgerLineCountExact(pitchY, firstLineY, lastLineY, spacing);
                      const glyph = getNoteheadGlyph(note.durationLabel, noteheadShape, noteheadEmoji);
                      const lelandSize = Math.max(18, spacing * 4.2);
                      const stemLenDefault = getStemLength(spacing);
                      const stemStrokeW = getStemThickness(spacing);
                      const stemX = stemUp ? (noteX + noteheadRx - stemStrokeW / 2) : (noteX - noteheadRx + stemStrokeW / 2);
                      const stemY1 = noteY;
                      const stemLen = beamGroup ? (beamGroup.stemLengths[noteIdx - beamGroup.start] ?? stemLenDefault) : stemLenDefault;
                      const stemY2 = stemUp ? (stemY1 - stemLen) : (stemY1 + stemLen);
                      const flagCount = beamGroup ? 0 : getFlagCount(note.durationLabel);

                      return (
                        <g key={noteIdx} {...noteGroupProps}>
                          {nLedgerAbove > 0 && Array.from({ length: nLedgerAbove }, (_, i) => (
                            <line key={`la-${i}`} x1={noteX - ledgerHalfWidth} y1={staffY + firstLineY - (i + 1) * spacing} x2={noteX + ledgerHalfWidth} y2={staffY + firstLineY - (i + 1) * spacing} stroke="#333" strokeWidth={getLegerLineThickness(spacing)} />
                          ))}
                          {nLedgerBelow > 0 && Array.from({ length: nLedgerBelow }, (_, i) => (
                            <line key={`lb-${i}`} x1={noteX - ledgerHalfWidth} y1={staffY + lastLineY + (i + 1) * spacing} x2={noteX + ledgerHalfWidth} y2={staffY + lastLineY + (i + 1) * spacing} stroke="#333" strokeWidth={getLegerLineThickness(spacing)} />
                          ))}
                          {isSelected && <rect x={noteX - 18} y={noteY - 22} width={36} height={44} fill="#93c5fd" opacity="0.3" rx="4" />}
                          {(note.accidental === 1 || note.accidental === -1) && (
                            <text x={noteX - (noteheadRx + spacing * 0.5)} y={noteY} textAnchor="middle" dominantBaseline="central" fontSize={Math.round(spacing * 1.4)} fill="#1a1a1a" fontFamily="serif">{note.accidental === 1 ? '♯' : '♭'}</text>
                          )}
                          {glyph ? (
                            <SmuflGlyph
                              x={noteX}
                              y={noteY}
                              glyph={glyph}
                              fontSize={lelandSize}
                              fill="var(--note-fill, #1a1a1a)"
                              dominantBaseline="central"
                            />
                          ) : (
                            <text x={noteX} y={noteY} textAnchor="middle" dominantBaseline="central" fontSize={lelandSize} fill="var(--note-fill, #1a1a1a)">{noteheadEmoji}</text>
                          )}
                          {/* Vars + lipud (talatud nootidel lipud peidetud, vars ulatub talani) */}
                          {note.durationLabel !== '1/1' && (
                            <g>
                              <line
                                x1={stemX}
                                y1={stemY1}
                                x2={stemX}
                                y2={stemY2}
                                stroke="var(--note-fill, #1a1a1a)"
                                strokeWidth={stemStrokeW}
                                strokeLinecap="butt"
                              />
                              {flagCount > 0 && (
                                <Flags
                                  stemX={stemX}
                                  stemEndY={stemY2}
                                  staffSpace={spacing}
                                  stemUp={stemUp}
                                  count={flagCount}
                                />
                              )}
                            </g>
                          )}
                          {beamGroup && noteIdx === beamGroup.start && (() => {
                            const thick = getBeamThickness(spacing);
                            const gap = getBeamGap(spacing);
                            const offset = thick + gap;
                            const y1 = staffY + beamGroup.beamY1;
                            const y2 = staffY + beamGroup.beamY2;
                            const dir = beamGroup.stemUp ? -1 : 1;
                            const beams = [];
                            for (let b = 0; b < beamGroup.numBeams; b++) {
                              let xL = beamGroup.xLeft;
                              let xR = beamGroup.xRight;
                              if (b >= 1 && beamGroup.beamLevels && beamGroup.noteXs) {
                                const idxMin = beamGroup.beamLevels.findIndex((lev) => lev >= b + 1);
                                const idxMax = beamGroup.beamLevels.length - 1 - [...beamGroup.beamLevels].reverse().findIndex((lev) => lev >= b + 1);
                                if (idxMin >= 0 && idxMax >= 0) {
                                  xL = beamGroup.noteXs[idxMin];
                                  xR = beamGroup.noteXs[idxMax];
                                }
                              }
                              const dy = b * offset * dir;
                              beams.push(
                                <line
                                  key={b}
                                  x1={xL}
                                  y1={y1 + dy}
                                  x2={xR}
                                  y2={y2 + dy}
                                  stroke="#1a1a1a"
                                  strokeWidth={thick}
                                  strokeLinecap="round"
                                />
                              );
                            }
                            return <g>{beams}</g>;
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
                              const xCenter = (beamGroup.xLeft + beamGroup.xRight) / 2;
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
                          {instrument === 'tin-whistle' && instrumentNotationVariant === 'fingering' && note.pitch && typeof note.octave === 'number' && (() => {
                            const name = getTinWhistleNotationName(note.pitch, note.octave);
                            if (!name) return null;
                            const fingeringLabelY = staffY + lastLineY + spacing * (showRhythmSyllables ? 2.6 : 1.8);
                            return (
                              <text
                                key="tinwhistle-fingering"
                                x={noteX}
                                y={fingeringLabelY}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fontSize={Math.max(12, spacing * 1.4)}
                                fill="var(--note-fill, #1a1a1a)"
                                fontFamily={tinWhistleFontFamily}
                              >
                                {name}
                              </text>
                            );
                          })()}
                          {instrument === 'recorder' && instrumentNotationVariant === 'fingering' && note.pitch && typeof note.octave === 'number' && (() => {
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
