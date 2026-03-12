/**
 * Figuurnotatsiooni vaade – TÄIELIKULT ERALDI traditsioonilisest vaatest.
 * Siin JO-võtit EI kuvata. Kasutatakse ainult taktikaste, rütmifiguure ja oktaavipõhiseid kujundeid (rist, ruut, ring jne).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFigureSymbol, getFigureColor } from '../utils/figurenotes';
import { RhythmSyllableLabel } from '../components/RhythmSyllableLabel';
import { getRhythmSyllableForNote } from '../notation/rhythmSyllables';
import { getFigureNoteWidth, FIGURE_BASE_WIDTH } from '../layout/LayoutEngine';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { smuflNoteheadForType } from '../notation/smufl/glyphs';
import { getShapePathsByOctave, getFigureStyle } from '../constants/FigureNotesLibrary';
import { getChordMidiNotes } from '../musical/chordPlayback';

const LAYOUT = { MARGIN_LEFT: 60, MEASURE_MIN_WIDTH: 28 };
const FIGURE_START_PADDING = 8;
const PAGE_BREAK_GAP = 80;
/** Reference size (px) for which bar line and padding design values were chosen. */
const NOTATION_SIZE_REF = 75;

function getFigurenoteTextColor(pitch) {
  const p = String(pitch || '').toUpperCase();
  return (p === 'A' || p === 'E' || p === 'B') ? '#000000' : '#ffffff';
}

const CHORD_ROOT_COLORS = {
  C: '#ef4444', // red
  D: '#92400e', // brown
  E: '#f97316', // orange
  F: '#22c55e', // green
  G: '#3b82f6', // blue
  A: '#a855f7', // purple
  B: '#6b7280'  // gray
};

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getChordColor(chordSymbol) {
  if (!chordSymbol) return '#e5e7eb';
  const s = String(chordSymbol).trim();
  if (!s) return '#e5e7eb';
  const rootChar = s.charAt(0).toUpperCase();
  return CHORD_ROOT_COLORS[rootChar] || '#e5e7eb';
}

function getChordToneNames(chordSymbol) {
  try {
    const midiNotes = getChordMidiNotes(chordSymbol);
    if (!Array.isArray(midiNotes) || midiNotes.length === 0) return [];
    return midiNotes.map((n) => {
      const pc = ((Number(n) % 12) + 12) % 12;
      return PITCH_CLASS_NAMES[pc] || '';
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/** Reference size used when design was at 16px; scale = size/16. */
const TIME_SIG_REF = 16;

function renderTimeSignature(timeSignature, timeSignatureMode, centerY, notationSize = TIME_SIG_REF, textColor = '#333', noteFill = '#333') {
  const scale = notationSize / TIME_SIG_REF;
  const x = 45;
  const y = centerY;
  const fNum = Math.round(18 * scale);
  const fDen = Math.round(18 * scale);
  const fDenFallback = Math.round(16 * scale);
  const lineHalf = 10 * scale;
  const yNum = y - 8 * scale;
  const yLine = y + 2 * scale;
  const yDen = y + 20 * scale;
  const stemOff = 4 * scale;
  const noteY = y + 18 * scale;
  const stemLen = 20 * scale;
  const strokeW = Math.max(1, 1.5 * scale);
  if (timeSignatureMode === 'pedagogical') {
    const stemX = x - stemOff;
    const getNoteSymbolForDenominator = () => {
      const noteX = x;
      const r1 = 5 * scale; const r1y = 3 * scale;
      const r2 = 4 * scale; const r2y = 2.5 * scale;
      const q = 6 * scale;
      switch (timeSignature.beatUnit) {
        case 1:
          return <ellipse cx={noteX} cy={noteY} rx={r1} ry={r1y} fill="none" stroke={textColor} strokeWidth={strokeW} />;
        case 2:
          return (<><ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill="none" stroke={textColor} strokeWidth={strokeW} /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + stemLen} stroke={textColor} strokeWidth={strokeW} /></>);
        case 4:
          return (<><ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill={noteFill} /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + stemLen} stroke={textColor} strokeWidth={strokeW} /></>);
        case 8:
          return (<><ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill={noteFill} /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + stemLen} stroke={textColor} strokeWidth={strokeW} /><path d={`M ${stemX} ${noteY + stemLen} Q ${stemX - q} ${noteY + stemLen - 2} ${stemX} ${noteY + stemLen - 5}`} fill={noteFill} /></>);
        case 16:
          return (<><ellipse cx={noteX} cy={noteY} rx={r2} ry={r2y} fill={noteFill} /><line x1={stemX} y1={noteY} x2={stemX} y2={noteY + stemLen} stroke={textColor} strokeWidth={strokeW} /><path d={`M ${stemX} ${noteY + stemLen} Q ${stemX - q} ${noteY + stemLen - 2} ${stemX} ${noteY + stemLen - 5} M ${stemX} ${noteY + stemLen - 3} Q ${stemX - q} ${noteY + stemLen - 5} ${stemX} ${noteY + stemLen - 8}`} fill={noteFill} /></>);
        default:
          return <text x={noteX} y={noteY + stemLen} textAnchor="middle" fontSize={fDenFallback} fontWeight="bold" fill={textColor}>{timeSignature.beatUnit}</text>;
      }
    };
    return (<g><text x={x} y={yNum} textAnchor="middle" fontSize={fNum} fontWeight="bold" fill={textColor}>{timeSignature.beats}</text><line x1={x - lineHalf} y1={yLine} x2={x + lineHalf} y2={yLine} stroke={textColor} strokeWidth={strokeW} />{getNoteSymbolForDenominator()}</g>);
  }
  return (
    <g>
      <text x={x} y={yNum} textAnchor="middle" fontSize={fNum} fontWeight="bold" fill={textColor}>{timeSignature.beats}</text>
      <line x1={x - lineHalf} y1={yLine} x2={x + lineHalf} y2={yLine} stroke={textColor} strokeWidth={strokeW} />
      <text x={x} y={yDen} textAnchor="middle" fontSize={fDen} fontWeight="bold" fill={textColor}>{timeSignature.beatUnit}</text>
    </g>
  );
}

export function FigurenotesView({
  systems,
  effectiveMeasures,
  marginLeft = LAYOUT.MARGIN_LEFT,
  timelineHeight,
  chordLineGap = 0,
  chordLineHeight = 0,
  chordBlocksEnabled = false,
  pageWidth,
  timeSignature,
  timeSignatureMode,
  layoutLineBreakBefore = [],
  showLayoutBreakIcons = false,
  onToggleLineBreakAfter,
  translateLabel,
  showBarNumbers = true,
  chords = [],
  figurenotesSize = 16,
  figurenotesStems = false,
  timeSignatureSize,
  keySignature = 'C',
  isNoteSelected,
  onNoteClick,
  onNoteMouseDown,
  onNoteMouseEnter,
  onNoteBeatChange,
  canHandDragNotes = false,
  timelineSvgRef,
  onBeatSlotClick,
  showRhythmSyllables = false,
  lyricFontFamily = 'sans-serif',
  lyricLineYOffset = 0,
  isHorizontal = false,
  a4PageHeight = 400,
  pageFlowDirection = 'vertical',
  figureBaseWidth = FIGURE_BASE_WIDTH,
  showStaffSpacerHandles = false,
  onStaffSpacerMouseDown,
  themeColors,
}) {
  /** Melody row height (beat-box); chord line sits below with chordLineGap and height chordLineHeight (half of melody when in chord mode). */
  const melodyRowHeight = timelineHeight;
  const centerY = melodyRowHeight / 2;
  const beatsPerMeasure = timeSignature?.beats ?? 4;
  const timeSigTextColor = themeColors?.textColor ?? '#333';
  const timeSigNoteFill = themeColors?.noteFill ?? '#333';

  /** Scale beat-box padding and barlines with Noodigraafika suurus so they match note size. */
  const notationScale = Math.max(0.5, figurenotesSize / NOTATION_SIZE_REF);
  const padVertical = Math.max(2, Math.round(4 * notationScale));
  const barLineInset = Math.max(2, Math.round(5 * notationScale));
  const barLineWidth = Math.max(2, Math.round(5 * notationScale));

  const [noteBeatDrag, setNoteBeatDrag] = useState(null);
  const measureLayout = useMemo(() => {
    const sys = systems?.[0];
    if (!sys || !effectiveMeasures?.length) return [];
    const mw = sys.measureWidths ?? [];
    return sys.measureIndices.map((measureIdx, j) => {
      const measure = effectiveMeasures[measureIdx];
      if (!measure) return null;
      const xStart = marginLeft + mw.slice(0, j).reduce((a, b) => a + b, 0);
      const xEnd = xStart + (mw[j] ?? 0);
      const startBeat = measure.startBeat;
      const endBeat = measure.endBeat ?? measure.startBeat + beatsPerMeasure;
      return { xStart, xEnd, startBeat, endBeat };
    }).filter(Boolean);
  }, [systems, effectiveMeasures, marginLeft, beatsPerMeasure]);
  const getBeatFromX = useCallback((x) => {
    for (const m of measureLayout) {
      if (x >= m.xStart && x <= m.xEnd) {
        const t = (m.xEnd - m.xStart) > 0 ? (x - m.xStart) / (m.xEnd - m.xStart) : 0;
        return m.startBeat + t * (m.endBeat - m.startBeat);
      }
    }
    return measureLayout.length > 0 ? measureLayout[0].startBeat : 0;
  }, [measureLayout]);
  useEffect(() => {
    if (!noteBeatDrag || typeof onNoteBeatChange !== 'function' || !timelineSvgRef?.current) return;
    const { noteIndex } = noteBeatDrag;
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

  return (
    <>
      {systems.map((sys) => {
        const pageIndex = isHorizontal ? Math.floor(sys.yOffset / a4PageHeight) : 0;
        const groupTransform = isHorizontal && pageWidth ? `translate(${pageIndex * pageWidth}, ${-pageIndex * a4PageHeight})` : undefined;
        return (
          <g key={sys.systemIndex} transform={groupTransform}>
            {showStaffSpacerHandles && typeof onStaffSpacerMouseDown === 'function' && (
              <rect
                x={0}
                y={sys.yOffset}
                width={14}
                height={melodyRowHeight + chordLineGap + chordLineHeight}
                fill="#e5e7eb"
                stroke="#9ca3af"
                strokeWidth={1}
                rx={2}
                style={{ cursor: 'ns-resize' }}
                onMouseDown={(e) => onStaffSpacerMouseDown(sys.systemIndex)(e)}
              />
            )}
            {sys.pageBreakBefore && (
              <line x1={0} y1={sys.yOffset - PAGE_BREAK_GAP / 2} x2={pageWidth || 800} y2={sys.yOffset - PAGE_BREAK_GAP / 2} stroke="#c4b896" strokeWidth={1} strokeDasharray="4 4" />
            )}

            {/* Taktide number – JO-võtit ei ole; skaleeritud figurenotesSize-ga, max 12px */}
            {showBarNumbers && sys.measureIndices.length > 0 && (
              <text x={20} y={sys.yOffset + Math.max(10, barLineInset + 4)} fontSize={Math.min(12, Math.round(10 * (figurenotesSize / 16)))} fontWeight="bold" fill="#555" textAnchor="middle" fontFamily="sans-serif">
                {sys.measureIndices[0] + 1}
              </text>
            )}

            {sys.systemIndex === 0 && (
              <g transform={`translate(0, ${sys.yOffset})`}>{renderTimeSignature(timeSignature, timeSignatureMode, centerY, timeSignatureSize ?? 16, timeSigTextColor, timeSigNoteFill)}</g>
            )}

            {sys.measureIndices.map((measureIdx, j) => {
              const measure = effectiveMeasures[measureIdx];
              if (!measure) return null;
              const measureWidths = sys.measureWidths ?? sys.measureIndices.map(() => sys.measureWidth ?? beatsPerMeasure * 80);
              const measureWidth = measureWidths[j] ?? (sys.measureWidth ?? beatsPerMeasure * 80);
              const measureX = marginLeft + measureWidths.slice(0, j).reduce((a, b) => a + b, 0);
              const beatsInMeasure = measure.beatCount ?? beatsPerMeasure;
              const beatWidth = measureWidth / beatsInMeasure;

              /** Interpret duration as beats (1=quarter, 0.5=eighth) or measure fraction (0.125=eighth in 4/4). */
              const durationInBeats = (d) => (d > 0 && d < 0.5 ? d * (beatsInMeasure || 4) : d);
              const getSlotsPerBeat = (beatIndex) => {
                const beatStart = measure.startBeat + beatIndex;
                const beatEnd = beatStart + 1;
                const notesInBeat = measure.notes.filter(n => n.beat >= beatStart && n.beat < beatEnd);
                if (notesInBeat.length === 0) return 1;
                const minDur = Math.min(...notesInBeat.map(n => n.duration));
                const minDurBeats = durationInBeats(minDur);
                return Math.max(1, Math.round(1 / minDurBeats));
              };
              /** Slot index by position within beat (order when sorted by beat). */
              const getSlotIndexInBeat = (note) => {
                const beatIndex = Math.floor(note.beat - measure.startBeat);
                const beatStart = measure.startBeat + beatIndex;
                const beatEnd = beatStart + 1;
                const notesInBeat = measure.notes
                  .filter(n => n.beat >= beatStart && n.beat < beatEnd)
                  .sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));
                const idx = notesInBeat.findIndex(n => n === note);
                return idx >= 0 ? idx : 0;
              };
              const getNoteSlotCenterX = (note) => {
                const beatInMeasure = note.beat - measure.startBeat;
                const beatIndex = Math.floor(beatInMeasure);
                const slotsPerBeat = getSlotsPerBeat(beatIndex);
                const slotIndex = getSlotIndexInBeat(note);
                const slotCenter = (Math.min(slotIndex, slotsPerBeat - 1) + 0.5) / slotsPerBeat;
                return measureX + (beatIndex + slotCenter) * beatWidth;
              };
              const getRestBoxWidth = (note) => {
                const beatInMeasure = note.beat - measure.startBeat;
                const beatIndex = Math.floor(beatInMeasure);
                const slotsPerBeat = getSlotsPerBeat(beatIndex);
                return beatWidth / slotsPerBeat;
              };

              const boxHeight = timelineHeight - 2 * padVertical;
              /** User-chosen notation size (px). Shapes are never stretched or capped by beat width — kept intact. */
              const figureSizeBase = Math.max(12, Math.min(96, figurenotesSize));
              const figureSizeBaseForMeasure = figureSizeBase;

              /** Scale figure when shorter than quarter so multiple notes fit in one beat: eighth = 0.5, 16th/32nd = 0.25. */
              const getFigureScaleForDuration = (durLabel) => {
                if (durLabel === '1/8') return 0.5;
                if (durLabel === '1/16' || durLabel === '1/32') return 0.25;
                return 1;
              };

              /* Bottom of beat box row for long-duration rectangle (so long notes don't overlap barlines). */
              const beatBoxBottomY = sys.yOffset + melodyRowHeight - padVertical;

              /** Duration in beats for long rectangle: 1/4=1, 1/2=2, 1/1=4. */
              const getDurationInBeats = (durLabel) => {
                if (durLabel === '1/1') return 4;
                if (durLabel === '1/2') return 2;
                if (durLabel === '1/4') return 1;
                if (durLabel === '1/8') return 0.5;
                if (durLabel === '1/16' || durLabel === '1/32') return 0.25;
                return 1;
              };

              const renderFigurenote = (note, x, y, noteIndex, noteWidth, figureSize, longRectEndX = null) => {
                const pitch = String(note.pitch || '').toUpperCase().replace('H', 'B');
                const style = getFigureStyle(note.pitch, note.octave);
                const shapePaths = getShapePathsByOctave(note.octave);
                const size = figureSize ?? figureSizeBase;
                const isSelected = isNoteSelected ? isNoteSelected(noteIndex) : false;
                const dur = note.durationLabel || '1/4';
                const smuflType =
                  dur === '1/1' ? 'whole'
                    : dur === '1/2' ? 'half'
                      : dur === '1/8' ? 'eighth'
                        : dur === '1/16' || dur === '1/32' ? 'sixteenth'
                          : 'quarter';
                /* Long rhythm (1/2, 1/1): rectangle from center of figure until end of last beat (e.g. half note → end of 2nd beat). */
                const hasTail = dur === '1/2' || dur === '1/1';
                const tailSize = hasTail ? size / 2 : 0;
                const figureCenterX = x;
                const longRectWidth = (hasTail && typeof longRectEndX === 'number' && longRectEndX > figureCenterX)
                  ? longRectEndX - figureCenterX
                  : 0;
                const stemLength = 26;
                const stemX = figureCenterX + size / 2 + 1;
                const stemY1 = y;
                const stemY2 = y - stemLength;
                const textColor = getFigurenoteTextColor(note.pitch);
                const r = size / 2;
                const strokeShape = isSelected ? '#2563eb' : '#000';
                const strokeWShape = isSelected ? 3 : 2;

                const fill = style.fill ?? '#C7BAB7';
                const effectiveStroke = style.stroke ?? 'none';
                const effectiveStrokeWidth = style.strokeWidth ?? 0;

                /* Long-duration rectangle: left at middle of figure, width to end of last beat (e.g. half note → end of 2nd beat), at bottom of beat box, under figure layer. */
                const longDurationRectEl = hasTail && longRectWidth > 0 && (
                  <rect
                    x={figureCenterX}
                    y={beatBoxBottomY - tailSize}
                    width={longRectWidth}
                    height={tailSize}
                    fill={fill}
                    stroke={effectiveStroke}
                    strokeWidth={effectiveStrokeWidth}
                    vectorEffect="non-scaling-stroke"
                  />
                );

                /* Quarter (1/4) and all durations: use a square SVG and preserve aspect ratio so shapes
                   are never stretched — perfect circle, square, X, or triangle (not oval/rectangular). */
                const shapeSize = size;
                const svgX = figureCenterX - shapeSize / 2;
                const svgY = y - shapeSize / 2;

                const isBlackFigure = !fill || String(fill).toLowerCase() === '#000000' || String(fill).toLowerCase() === 'black';
                const showWhiteHalo = !!themeColors?.isDark && isBlackFigure;

                const haloEl = showWhiteHalo ? (
                  <circle
                    cx={figureCenterX}
                    cy={y}
                    r={shapeSize / 2 + 4}
                    fill="#ffffff"
                  />
                ) : null;

                const shapeEl = (
                  <svg
                    x={svgX}
                    y={svgY}
                    width={shapeSize}
                    height={shapeSize}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ overflow: 'visible' }}
                  >
                    {shapePaths.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill={fill}
                        stroke={effectiveStroke}
                        strokeWidth={effectiveStrokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                );

                return (
                  <g>
                    {/* Long-duration bar: rectangle at bottom of beat box, slightly under figure layer */}
                    {longDurationRectEl}
                    {/* Pedagoogiline aluskiht: SMuFL notehead (Leland) */}
                    <SmuflGlyph
                      x={figureCenterX}
                      y={y}
                      glyph={smuflNoteheadForType(smuflType)}
                      fontSize={size * 1.35}
                      fill="var(--note-fill, #1a1a1a)"
                      style={{ opacity: 0.18 }}
                    />
                    {haloEl}
                    {shapeEl}
                    <text x={figureCenterX} y={y} textAnchor="middle" dominantBaseline="central" fill={textColor} fontSize={Math.max(8, size * 0.5)} fontWeight="bold">
                      {String(note.pitch || '').toUpperCase().replace('H', 'B')}
                    </text>
                    {figurenotesStems && dur !== '1/1' && (
                      <g stroke="#1a1a1a" fill="#1a1a1a" strokeWidth="1.8">
                        <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} />
                        {dur === '1/8' && <path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" />}
                        {dur === '1/16' && (<><path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" /><path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill="#1a1a1a" /></>)}
                        {dur === '1/32' && (<><path d={`M ${stemX} ${stemY2} Q ${stemX + 8} ${stemY2 + 4} ${stemX} ${stemY2 + 8}`} fill="#1a1a1a" /><path d={`M ${stemX} ${stemY2 + 6} Q ${stemX + 8} ${stemY2 + 10} ${stemX} ${stemY2 + 14}`} fill="#1a1a1a" /><path d={`M ${stemX} ${stemY2 + 12} Q ${stemX + 8} ${stemY2 + 16} ${stemX} ${stemY2 + 20}`} fill="#1a1a1a" /></>)}
                      </g>
                    )}
                    {(note.accidental === 1 || note.accidental === -1) && (() => {
                      const arrowY = y - size / 2 - Math.max(8, size * 0.4);
                      const arrowLen = Math.max(14, size * 0.85);
                      const head = Math.max(5, size * 0.32);
                      const strokeW2 = Math.max(1.5, size * 0.1);
                      const stroke = '#1a1a1a';
                      if (note.accidental === 1) {
                        // Sharp: diagonal arrow up-right (↗)
                        return (<g stroke={stroke} fill="none" strokeWidth={strokeW2} strokeLinecap="round" strokeLinejoin="round"><line x1={figureCenterX - arrowLen / 2} y1={arrowY + arrowLen / 2} x2={figureCenterX + arrowLen / 2} y2={arrowY - arrowLen / 2} /><path d={`M ${figureCenterX + arrowLen / 2} ${arrowY - arrowLen / 2} L ${figureCenterX + arrowLen / 2 - head} ${arrowY - arrowLen / 2 + head * 0.6} M ${figureCenterX + arrowLen / 2} ${arrowY - arrowLen / 2} L ${figureCenterX + arrowLen / 2 - head * 0.6} ${arrowY - arrowLen / 2 + head}`} /></g>);
                      }
                      // Flat: diagonal arrow to the left (↖)
                      return (<g stroke={stroke} fill="none" strokeWidth={strokeW2} strokeLinecap="round" strokeLinejoin="round"><line x1={figureCenterX + arrowLen / 2} y1={arrowY + arrowLen / 2} x2={figureCenterX - arrowLen / 2} y2={arrowY - arrowLen / 2} /><path d={`M ${figureCenterX - arrowLen / 2} ${arrowY - arrowLen / 2} L ${figureCenterX - arrowLen / 2 + head} ${arrowY - arrowLen / 2 + head * 0.6} M ${figureCenterX - arrowLen / 2} ${arrowY - arrowLen / 2} L ${figureCenterX - arrowLen / 2 + head * 0.6} ${arrowY - arrowLen / 2 + head}`} /></g>);
                    })()}
                    {isSelected && <circle cx={figureCenterX} cy={y} r={size / 2 + 4} fill="none" stroke="#2563eb" strokeWidth="2" opacity="0.5" />}
                  </g>
                );
              };

              const handleBeatSlot = (beatIndex, e) => {
                if (typeof onBeatSlotClick !== 'function') return;
                e.stopPropagation();
                e.preventDefault?.();
                const beatPosition = measure.startBeat + beatIndex;
                onBeatSlotClick(beatPosition);
              };

              return (
                <g key={measureIdx}>
                  {/* Taktikast + löögivõre */}
                  <rect x={measureX} y={sys.yOffset + padVertical} width={measureWidth} height={boxHeight} fill="transparent" stroke="#c8c8c8" strokeWidth="1.5" />
                  {Array.from({ length: Math.max(0, Math.ceil(beatsInMeasure) - 1) }, (_, b) => (
                    <line key={`beat-${b}`} x1={measureX + (b + 1) * beatWidth} y1={sys.yOffset + padVertical} x2={measureX + (b + 1) * beatWidth} y2={sys.yOffset + melodyRowHeight - padVertical} stroke="#e0e0e0" strokeWidth="1" />
                  ))}
                  {/* Tahvel/sõrm: puudeala löögikastidele – noodi lisamine soovitud löögile */}
                  {onBeatSlotClick && Array.from({ length: Math.ceil(beatsInMeasure) }, (_, beatIndex) => (
                    <rect
                      key={`beat-hit-${beatIndex}`}
                      x={measureX + beatIndex * beatWidth}
                      y={sys.yOffset + padVertical}
                      width={beatWidth}
                      height={boxHeight}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onPointerDown={(e) => handleBeatSlot(beatIndex, e)}
                    />
                  ))}
                  {measureWidth < (LAYOUT.MEASURE_MIN_WIDTH || 28) && (
                    <rect x={measureX - 1} y={sys.yOffset + 2} width={measureWidth + 2} height={melodyRowHeight - 2 * padVertical} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" rx={2} />
                  )}
                  {showLayoutBreakIcons && typeof onToggleLineBreakAfter === 'function' && (
                    <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleLineBreakAfter(measureIdx); }} style={{ pointerEvents: 'auto' }} title={translateLabel ? translateLabel('layout.lineBreakAfter') : 'Reavahetus selle takti järel'}>
                      <rect x={measureX + measureWidth / 2 - 10} y={sys.yOffset - 18} width={20} height={16} rx={3} fill={layoutLineBreakBefore.includes(measureIdx + 1) ? '#f59e0b' : '#fef3c7'} stroke="#d97706" strokeWidth={1.2} />
                      <path d={`M ${measureX + measureWidth / 2 - 4} ${sys.yOffset - 10} L ${measureX + measureWidth / 2} ${sys.yOffset - 14} L ${measureX + measureWidth / 2 + 4} ${sys.yOffset - 10}`} fill="none" stroke="#92400e" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                  {j !== 0 && <line x1={measureX} y1={sys.yOffset + barLineInset} x2={measureX} y2={sys.yOffset + melodyRowHeight - barLineInset} stroke="#1a1a1a" strokeWidth={barLineWidth} />}
                  {measureIdx === sys.measureIndices[sys.measureIndices.length - 1] && (
                    <line x1={measureX + measureWidth} y1={sys.yOffset + barLineInset} x2={measureX + measureWidth} y2={sys.yOffset + melodyRowHeight - barLineInset} stroke="#1a1a1a" strokeWidth={barLineWidth} />
                  )}
                  {/* Chord line: half-height row below melody; chords drawn in that row */}
                  {chordLineHeight > 0 && j === 0 && (
                    <rect
                      x={marginLeft}
                      y={sys.yOffset + melodyRowHeight + chordLineGap}
                      width={measureWidths.reduce((a, b) => a + b, 0)}
                      height={chordLineHeight}
                      fill="rgba(0,0,0,0.03)"
                      stroke="#e8e8e8"
                      strokeWidth={1}
                      rx={2}
                    />
                  )}
                  {chords
                    .filter((c) => c.beatPosition >= measure.startBeat && c.beatPosition < measure.endBeat)
                    .map((chord) => {
                      const chordX = measureX + (chord.beatPosition - measure.startBeat) * beatWidth;
                      const chordY = chordLineHeight > 0
                        ? sys.yOffset + melodyRowHeight + chordLineGap + chordLineHeight / 2
                        : sys.yOffset + padVertical + 4;
                      const chordFontSizeBase = Math.round(14 * (figurenotesSize / 16));
                      const chordFontSize = chordLineHeight > 0
                        ? Math.min(chordLineHeight * 0.6, chordFontSizeBase)
                        : chordFontSizeBase;

                      if (!chordBlocksEnabled || chordLineHeight <= 0) {
                        return (
                          <g key={chord.id}>
                            <text
                              x={chordX}
                              y={chordY}
                              textAnchor="start"
                              dominantBaseline="middle"
                              fontSize={chordFontSize}
                              fontWeight="bold"
                              fill="#1a1a1a"
                              fontFamily="sans-serif"
                            >
                              {chord.chord}
                            </text>
                            {chord.figuredBass && (
                              <text
                                x={chordX}
                                y={chordY + chordFontSize * 0.85}
                                textAnchor="start"
                                dominantBaseline="middle"
                                fontSize={Math.round(chordFontSize * 0.75)}
                                fill="#555"
                                fontFamily="serif"
                              >
                                {chord.figuredBass}
                              </text>
                            )}
                          </g>
                        );
                      }

                      // Chord blocks mode: one-beat colored rectangle with chord name and tone spelling.
                      const rectGap = 2;
                      const rectWidth = Math.max(0, beatWidth - rectGap);
                      const rectX = chordX;
                      const chordRowTop = sys.yOffset + melodyRowHeight + chordLineGap;
                      const rectY = chordRowTop + 2;
                      const rectH = Math.max(0, chordLineHeight - 4);
                      const fill = getChordColor(chord.chord);
                      const tones = getChordToneNames(chord.chord);
                      const textX = rectX + 4;
                      const mainTextY = chordRowTop + chordLineHeight * 0.45;
                      const tonesFontSize = Math.max(8, Math.round(chordFontSize * 0.6));

                      return (
                        <g key={chord.id}>
                          <rect
                            x={rectX}
                            y={rectY}
                            width={rectWidth}
                            height={rectH}
                            fill={fill}
                            stroke="#111827"
                            strokeWidth={0.8}
                            rx={3}
                          />
                          <text
                            x={textX}
                            y={mainTextY}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fontSize={chordFontSize}
                            fontWeight="bold"
                            fill="#ffffff"
                            fontFamily="sans-serif"
                          >
                            {chord.chord}
                          </text>
                          {tones.length > 0 && (
                            <text
                              x={textX}
                              y={mainTextY + tonesFontSize}
                              textAnchor="start"
                              dominantBaseline="hanging"
                              fontSize={tonesFontSize}
                              fill="#f9fafb"
                              fontFamily="monospace"
                            >
                              {tones.join(' ')}
                            </text>
                          )}
                          {chord.figuredBass && (
                            <text
                              x={rectX + rectWidth - 4}
                              y={rectY + rectH - 3}
                              textAnchor="end"
                              fontSize={Math.max(8, Math.round(chordFontSize * 0.6))}
                              fill="#111827"
                              fontFamily="serif"
                            >
                              {chord.figuredBass}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  {(() => {
                    // Shorter-than-quarter notes in the same beat: place so that
                    // right edge of one shape + 1px gap + left edge of next shape (repeated for every short note).
                    const compactCenters = new Map();
                    const notesByBeat = new Map();
                    measure.notes.forEach((note, idx) => {
                      if (note.isRest) return;
                      const durLabel = note.durationLabel || '1/4';
                      const durBeats = typeof note.duration === 'number' ? note.duration : getDurationInBeats(durLabel);
                      if (durBeats >= 1) return; // only shorter than quarter
                      const beatInMeasure = note.beat - measure.startBeat;
                      const beatIndex = Math.floor(beatInMeasure);
                      if (!notesByBeat.has(beatIndex)) notesByBeat.set(beatIndex, []);
                      const scale = getFigureScaleForDuration(durLabel);
                      const figureSize = figureSizeBaseForMeasure * scale;
                      notesByBeat.get(beatIndex).push({ note, idx, figureSize });
                    });
                    notesByBeat.forEach((group, beatIndex) => {
                      if (!group || group.length <= 1) return;
                      group.sort((a, b) => (a.note.beat ?? 0) - (b.note.beat ?? 0) || a.idx - b.idx);
                      const beatLeft = measureX + beatIndex * beatWidth;
                      let leftEdge = beatLeft + 1; // left edge of first short note in this beat
                      group.forEach(({ idx, figureSize }) => {
                        const center = leftEdge + figureSize / 2;
                        compactCenters.set(idx, center);
                        const rightEdge = leftEdge + figureSize;
                        leftEdge = rightEdge + 1; // 1px gap, then left edge of next shape
                      });
                    });

                    return measure.notes.map((note, noteIdx) => {
                      const dur = note.durationLabel || '1/4';
                      const scale = getFigureScaleForDuration(dur);
                      const figureSize = figureSizeBaseForMeasure * scale;
                      const defaultCenterX = getNoteSlotCenterX(note);
                      const figureCenterX = compactCenters.has(noteIdx) ? compactCenters.get(noteIdx) : defaultCenterX;
                      const noteWidth = getRestBoxWidth(note);

                      let globalNoteIndex = 0;
                      for (let i = 0; i < measureIdx; i++) globalNoteIndex += effectiveMeasures[i].notes.length;
                      globalNoteIndex += noteIdx;
                      const noteY = sys.yOffset + centerY;
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
                          if (typeof onNoteMouseDown === 'function') onNoteMouseDown(globalNoteIndex, e);
                        },
                        onMouseEnter: typeof onNoteMouseEnter === 'function' ? (e) => onNoteMouseEnter(globalNoteIndex, e) : undefined,
                        style: { cursor: (onNoteClick || onNoteMouseDown || canDragBeat) ? 'pointer' : undefined }
                      };
                      if (note.isRest) {
                        const restLabelY = sys.yOffset + centerY + 20;
                        const restSyllable = showRhythmSyllables ? getRhythmSyllableForNote(note) : '';
                        if (!figurenotesStems) {
                          const zSize = Math.min(noteWidth * 0.55, 26);
                          return (<g key={noteIdx} {...noteGroupProps}><text x={figureCenterX} y={sys.yOffset + centerY + zSize * 0.2} textAnchor="middle" fontSize={zSize} fontWeight="bold" fill="#1a1a1a" fontFamily="serif">Z</text>{restSyllable && <RhythmSyllableLabel x={figureCenterX} y={restLabelY} text={restSyllable} staffSpace={10} />}</g>);
                        }
                        return (<g key={noteIdx} {...noteGroupProps}>{restSyllable && <RhythmSyllableLabel x={figureCenterX} y={restLabelY} text={restSyllable} staffSpace={10} />}</g>);
                      }
                      const accidentalNudge = (note.accidental === 1 || note.accidental === -1) ? (note.accidental === 1 ? 1 : -1) * Math.max(2, figureSize * 0.2) : 0;
                      const figureX = figureCenterX + accidentalNudge;
                      const labelFontSize = Math.max(8, Math.round(figureSize * 0.625));
                      const labelY = noteY + figureSize * 0.5 + labelFontSize;
                      const bandLeft = figureCenterX - noteWidth / 2;
                      const bandY = sys.yOffset + padVertical + 2;
                      const bandH = melodyRowHeight - 2 * (padVertical + 2);
                      const bandColor = getFigureColor(note.pitch);
                      const isDarkTheme = !!themeColors?.isDark;
                      const pitchLabel = String(note.pitch || '').toUpperCase().replace('H', 'B');
                      const isGNote = pitchLabel.startsWith('G');
                      const durLabel = note.durationLabel || '1/4';
                      const noteDurationBeats = typeof note.duration === 'number' ? note.duration : getDurationInBeats(durLabel);
                      const isLongerThanQuarter = noteDurationBeats > 1;
                      const showBand = isDarkTheme && isGNote && isLongerThanQuarter;
                      /* Long-duration rectangle: from center of figure to end of last beat (e.g. half note → end of 2nd beat). */
                      const endBeat = Math.min(note.beat + noteDurationBeats, measure.endBeat ?? measure.startBeat + beatsInMeasure);
                      const longRectEndX = (durLabel === '1/2' || durLabel === '1/1')
                        ? Math.min(measureX + measureWidth, measureX + (endBeat - measure.startBeat) * beatWidth)
                        : null;
                      return (
                        <g key={noteIdx} {...noteGroupProps}>
                          {showBand && (
                            <rect x={bandLeft} y={bandY} width={noteWidth} height={bandH} fill={bandColor} opacity="0.2" rx="2" />
                          )}
                          {renderFigurenote(note, figureX, noteY, globalNoteIndex, noteWidth, figureSize, longRectEndX)}
                          {(note.lyric != null && String(note.lyric).trim() !== '') && (
                            <text x={figureX} y={labelY + Math.round(14 * (figurenotesSize / 16)) + (lyricLineYOffset || 0)} textAnchor="middle" fontSize={Math.round(11 * (figurenotesSize / 16))} fill="#333" fontFamily={lyricFontFamily}>{note.lyric}</text>
                          )}
                          {(note.lyric2 != null && String(note.lyric2).trim() !== '') && (
                            <text x={figureX} y={labelY + Math.round(28 * (figurenotesSize / 16)) + (lyricLineYOffset || 0)} textAnchor="middle" fontSize={Math.round(11 * (figurenotesSize / 16))} fill="#555" fontFamily={lyricFontFamily}>{note.lyric2}</text>
                          )}
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
    </>
  );
}
